import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  jalaliStringToDate,
  WbsNodeType,
  WeightSource,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { type EnableControlDto } from './dto/project-control.dto';
import { mapControlPlan } from './wbs.mapper';

type ControlPlanRow = Prisma.ProjectControlPlanGetPayload<Record<string, never>>;

@Injectable()
export class ProjectControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** بارگذاری پروژه یا خطای NotFound. */
  async requireProject(projectId: string): Promise<{ id: string; projectControlEnabled: boolean; activeControlPlanId: string | null }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectControlEnabled: true, activeControlPlanId: true },
    });
    if (!project) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
    }
    return project;
  }

  /** Plan فعال پروژه یا خطا در صورت غیرفعال بودن Project Control. */
  async requireActivePlan(projectId: string): Promise<ControlPlanRow> {
    const project = await this.requireProject(projectId);
    if (!project.projectControlEnabled || !project.activeControlPlanId) {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'کنترل پروژهٔ پیشرفته برای این پروژه فعال نشده است.',
      });
    }
    const plan = await this.prisma.projectControlPlan.findFirst({
      where: { id: project.activeControlPlanId, projectId, isActive: true },
    });
    if (!plan) {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'برنامهٔ کنترل فعال یافت نشد.',
      });
    }
    return plan;
  }

  async getActivePlanOrNull(projectId: string): Promise<ControlPlanRow | null> {
    const project = await this.requireProject(projectId);
    if (!project.projectControlEnabled || !project.activeControlPlanId) return null;
    return this.prisma.projectControlPlan.findFirst({
      where: { id: project.activeControlPlanId, projectId, isActive: true },
    });
  }

  /**
   * فعال‌سازی کنترل پروژهٔ پیشرفته: ساخت ProjectControlPlan فعال + Root Node.
   * فقط PROJECT_EDITOR (در Controller اعمال می‌شود). Idempotent نسبت به فعال بودن قبلی نیست:
   * اگر Plan فعال وجود دارد خطا می‌دهد.
   */
  async enableControl(projectId: string, dto: EnableControlDto, ctx: AuditContext) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, titleFa: true, projectControlEnabled: true, activeControlPlanId: true },
    });
    if (!project) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
    }
    if (project.projectControlEnabled && project.activeControlPlanId) {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'کنترل پروژه قبلاً برای این پروژه فعال شده است.',
      });
    }

    const statusDate = jalaliStringToDate(dto.statusDate);
    const currency = dto.currency ?? 'IRR';

    const result = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.projectControlPlan.create({
        data: {
          projectId,
          title: dto.title.trim(),
          description: dto.description?.trim() ?? null,
          statusDate,
          periodUnit: dto.periodUnit ?? 'MONTH',
          currency,
          timezone: 'Asia/Tehran',
          isActive: true,
          version: 1,
          createdByUserId: ctx.userId ?? null,
          updatedByUserId: ctx.userId ?? null,
        },
      });

      const rootId = randomUUID();
      await tx.wbsNode.create({
        data: {
          id: rootId,
          projectId,
          controlPlanId: plan.id,
          parentId: null,
          title: project.titleFa,
          normalizedTitle: project.titleFa,
          depth: 0,
          materializedPath: rootId,
          nodeType: WbsNodeType.PROJECT,
          isSummary: true,
          weightSource: WeightSource.NONE,
          sortOrder: 0,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          projectControlEnabled: true,
          activeControlPlanId: plan.id,
          controlStatusDate: statusDate,
          controlCurrency: currency,
        },
      });

      return plan;
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProjectControlPlan',
      entityId: result.id,
      action: AuditAction.CREATE,
      newValue: mapControlPlan(result),
    });

    return mapControlPlan(result);
  }
}
