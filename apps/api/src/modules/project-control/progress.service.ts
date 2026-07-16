import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AuditAction,
  ControlNodeStatus,
  ErrorCode,
  jalaliStringToDate,
  type ProgressUpdateDto,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ProjectControlService } from './project-control.service';
import { type CreateProgressDto } from './dto/project-control.dto';
import { mapProgressUpdate } from './wbs.mapper';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly control: ProjectControlService,
  ) {}

  async list(projectId: string): Promise<ProgressUpdateDto[]> {
    await this.control.requireActivePlan(projectId);
    const rows = await this.prisma.progressUpdate.findMany({
      where: { projectId },
      orderBy: { reportingDate: 'desc' },
      take: 500,
    });
    return rows.map(mapProgressUpdate);
  }

  async history(projectId: string, nodeId: string): Promise<ProgressUpdateDto[]> {
    await this.control.requireActivePlan(projectId);
    const rows = await this.prisma.progressUpdate.findMany({
      where: { projectId, nodeId },
      orderBy: { reportingDate: 'asc' },
    });
    return rows.map(mapProgressUpdate);
  }

  /**
   * ثبت پیشرفت + به‌روزرسانی نود (percentComplete/physical/actualCost/...) در Transaction.
   * محاسبهٔ Rollup در زمان خواندن Dashboard/WBS انجام می‌شود (Backend-side).
   */
  async create(
    projectId: string,
    dto: CreateProgressDto,
    ctx: AuditContext,
  ): Promise<ProgressUpdateDto> {
    const plan = await this.control.requireActivePlan(projectId);
    const node = await this.prisma.wbsNode.findFirst({
      where: { id: dto.nodeId, controlPlanId: plan.id, deletedAt: null },
    });
    if (!node) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'نود WBS نامعتبر است.',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.progressUpdate.create({
        data: {
          projectId,
          nodeId: dto.nodeId,
          reportingDate: jalaliStringToDate(dto.reportingDate),
          actualPercent: dto.actualPercent,
          physicalProgress: dto.physicalProgress ?? null,
          financialProgress: dto.financialProgress ?? null,
          actualCost: (dto.actualCost as unknown as Prisma.Decimal | null) ?? null,
          remainingDurationMinutes: dto.remainingDurationMinutes ?? null,
          forecastFinish: dto.forecastFinish ? jalaliStringToDate(dto.forecastFinish) : null,
          status: dto.status ?? ControlNodeStatus.UNKNOWN,
          comment: dto.comment?.trim() ?? null,
          evidenceUrl: dto.evidenceUrl?.trim() ?? null,
          createdByUserId: ctx.userId ?? null,
        },
      });
      // آخرین گزارش، مقدار نود را نیز به‌روز می‌کند تا Rollup صحیح باشد.
      await tx.wbsNode.update({
        where: { id: dto.nodeId },
        data: {
          percentComplete: dto.actualPercent,
          physicalProgress: dto.physicalProgress ?? undefined,
          financialProgress: dto.financialProgress ?? undefined,
          actualCost: (dto.actualCost as unknown as Prisma.Decimal | undefined) ?? undefined,
          remainingDurationMinutes: dto.remainingDurationMinutes ?? undefined,
          forecastFinish: dto.forecastFinish ? jalaliStringToDate(dto.forecastFinish) : undefined,
          statusOverride:
            dto.status && dto.status !== ControlNodeStatus.UNKNOWN ? dto.status : undefined,
          version: { increment: 1 },
        },
      });
      return rec;
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProgressUpdate',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapProgressUpdate(created),
    });
    return mapProgressUpdate(created);
  }

  async bulk(
    projectId: string,
    items: CreateProgressDto[],
    ctx: AuditContext,
  ): Promise<ProgressUpdateDto[]> {
    const out: ProgressUpdateDto[] = [];
    for (const item of items) {
      out.push(await this.create(projectId, item, ctx));
    }
    return out;
  }
}
