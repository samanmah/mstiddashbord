import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ErrorCode, jalaliStringToDate } from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { ProjectControlService } from './project-control.service';
import { type CreateBaselineDto } from './dto/project-control.dto';

@Injectable()
export class BaselinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly control: ProjectControlService,
  ) {}

  async list(projectId: string) {
    const plan = await this.control.requireActivePlan(projectId);
    return this.prisma.projectBaseline.findMany({
      where: { controlPlanId: plan.id },
      orderBy: { baselineNumber: 'desc' },
    });
  }

  /** ساخت Baseline + Snapshot از تمام نودهای فعال، در Transaction. */
  async create(projectId: string, dto: CreateBaselineDto, ctx: AuditContext) {
    const plan = await this.control.requireActivePlan(projectId);
    const nodes = await this.prisma.wbsNode.findMany({
      where: { controlPlanId: plan.id, deletedAt: null },
    });
    const last = await this.prisma.projectBaseline.findFirst({
      where: { controlPlanId: plan.id },
      orderBy: { baselineNumber: 'desc' },
    });
    const baselineNumber = (last?.baselineNumber ?? 0) + 1;

    const baseline = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectBaseline.create({
        data: {
          projectId,
          controlPlanId: plan.id,
          title: dto.title.trim(),
          baselineNumber,
          statusDate: jalaliStringToDate(dto.statusDate),
          isActive: false,
          createdByUserId: ctx.userId ?? null,
        },
      });
      if (nodes.length > 0) {
        await tx.baselineNodeSnapshot.createMany({
          data: nodes.map((n) => ({
            baselineId: created.id,
            nodeId: n.id,
            plannedStart: n.plannedStart,
            plannedFinish: n.plannedFinish,
            plannedDurationMinutes: n.plannedDurationMinutes,
            budgetAmount: n.budgetAmount,
            weight: n.weight,
            percentCompleteAtBaseline: n.percentComplete,
          })),
        });
      }
      return created;
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProjectBaseline',
      entityId: baseline.id,
      action: AuditAction.CREATE,
      newValue: { baselineNumber, title: baseline.title, nodeCount: nodes.length },
    });
    return baseline;
  }

  async activate(projectId: string, id: string, ctx: AuditContext) {
    const plan = await this.control.requireActivePlan(projectId);
    const baseline = await this.prisma.projectBaseline.findFirst({
      where: { id, controlPlanId: plan.id },
    });
    if (!baseline) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Baseline یافت نشد.' });
    }
    await this.prisma.$transaction([
      this.prisma.projectBaseline.updateMany({
        where: { controlPlanId: plan.id },
        data: { isActive: false },
      }),
      this.prisma.projectBaseline.update({ where: { id }, data: { isActive: true } }),
      this.prisma.projectControlPlan.update({
        where: { id: plan.id },
        data: { baselineId: id },
      }),
    ]);
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProjectBaseline',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: { activated: true },
    });
    return this.prisma.projectBaseline.findUniqueOrThrow({ where: { id } });
  }

  async compare(projectId: string, id: string) {
    const plan = await this.control.requireActivePlan(projectId);
    const baseline = await this.prisma.projectBaseline.findFirst({
      where: { id, controlPlanId: plan.id },
      include: { snapshots: true },
    });
    if (!baseline) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Baseline یافت نشد.' });
    }
    const nodes = await this.prisma.wbsNode.findMany({
      where: { controlPlanId: plan.id, deletedAt: null },
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return baseline.snapshots.map((s) => {
      const current = byId.get(s.nodeId);
      return {
        nodeId: s.nodeId,
        title: current?.title ?? null,
        baselinePlannedFinish: s.plannedFinish?.toISOString() ?? null,
        currentPlannedFinish: current?.plannedFinish?.toISOString() ?? null,
        baselineWeight: s.weight,
        currentWeight: current?.weight ?? null,
      };
    });
  }
}
