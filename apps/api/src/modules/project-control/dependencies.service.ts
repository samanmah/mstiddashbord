import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DependencySource,
  DependencyType,
  ErrorCode,
  type TaskDependencyDto,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { hasDependencyCycle } from './calc/control-calc';
import { ProjectControlService } from './project-control.service';
import {
  type CreateDependencyDto,
  type UpdateDependencyDto,
} from './dto/project-control.dto';
import { mapDependency } from './wbs.mapper';

@Injectable()
export class DependenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly control: ProjectControlService,
  ) {}

  async list(projectId: string): Promise<TaskDependencyDto[]> {
    const plan = await this.control.requireActivePlan(projectId);
    const rows = await this.prisma.taskDependency.findMany({
      where: { controlPlanId: plan.id },
    });
    return rows.map(mapDependency);
  }

  private async assertNodesExist(
    controlPlanId: string,
    ids: string[],
  ): Promise<void> {
    const count = await this.prisma.wbsNode.count({
      where: { id: { in: ids }, controlPlanId, deletedAt: null },
    });
    if (count !== new Set(ids).size) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'نود پیش‌نیاز یا پس‌نیاز نامعتبر است.',
      });
    }
  }

  async create(
    projectId: string,
    dto: CreateDependencyDto,
    ctx: AuditContext,
  ): Promise<TaskDependencyDto> {
    const plan = await this.control.requireActivePlan(projectId);
    if (dto.predecessorNodeId === dto.successorNodeId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'پیش‌نیاز و پس‌نیاز نمی‌توانند یکسان باشند.',
      });
    }
    await this.assertNodesExist(plan.id, [dto.predecessorNodeId, dto.successorNodeId]);

    const existing = await this.prisma.taskDependency.findMany({
      where: { controlPlanId: plan.id },
    });
    const candidate = [
      ...existing.map((e) => ({
        predecessorNodeId: e.predecessorNodeId,
        successorNodeId: e.successorNodeId,
      })),
      { predecessorNodeId: dto.predecessorNodeId, successorNodeId: dto.successorNodeId },
    ];
    if (hasDependencyCycle(candidate)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'این وابستگی باعث ایجاد چرخه در گراف Dependency می‌شود.',
      });
    }

    const created = await this.prisma.taskDependency.create({
      data: {
        projectId,
        controlPlanId: plan.id,
        predecessorNodeId: dto.predecessorNodeId,
        successorNodeId: dto.successorNodeId,
        type: dto.type ?? DependencyType.FS,
        lagMinutes: dto.lagMinutes ?? 0,
        source: dto.source ?? DependencySource.MANUAL,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'TaskDependency',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapDependency(created),
    });
    return mapDependency(created);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateDependencyDto,
    ctx: AuditContext,
  ): Promise<TaskDependencyDto> {
    const plan = await this.control.requireActivePlan(projectId);
    const existing = await this.prisma.taskDependency.findFirst({
      where: { id, controlPlanId: plan.id },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'وابستگی یافت نشد.' });
    }
    const updated = await this.prisma.taskDependency.update({
      where: { id },
      data: { type: dto.type, lagMinutes: dto.lagMinutes, source: dto.source },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'TaskDependency',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapDependency(existing),
      newValue: mapDependency(updated),
    });
    return mapDependency(updated);
  }

  async remove(projectId: string, id: string, ctx: AuditContext): Promise<void> {
    const plan = await this.control.requireActivePlan(projectId);
    const existing = await this.prisma.taskDependency.findFirst({
      where: { id, controlPlanId: plan.id },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'وابستگی یافت نشد.' });
    }
    await this.prisma.taskDependency.delete({ where: { id } });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'TaskDependency',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapDependency(existing),
    });
  }

  async validate(projectId: string): Promise<{ hasCycle: boolean }> {
    const plan = await this.control.requireActivePlan(projectId);
    const rows = await this.prisma.taskDependency.findMany({
      where: { controlPlanId: plan.id },
    });
    return { hasCycle: hasDependencyCycle(rows) };
  }
}
