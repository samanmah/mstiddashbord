import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  jalaliStringToDate,
  normalizeText,
  type WbsNodeComputedDto,
  type WbsNodeDto,
  WbsNodeType,
  WeightSource,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  validateWeightSum,
  wouldCreateHierarchyCycle,
} from './calc/control-calc';
import { ProjectControlCalculationService } from './project-control-calculation.service';
import { ProjectControlService } from './project-control.service';
import {
  type BulkWbsDto,
  type CreateWbsNodeDto,
  type ReorderDto,
  type ReparentDto,
  type UpdateWbsNodeDto,
} from './dto/project-control.dto';
import { mapWbsNode } from './wbs.mapper';

type WbsNodeRow = Prisma.WbsNodeGetPayload<Record<string, never>>;

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return jalaliStringToDate(value);
}

function toDecimal(value: string | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return value as unknown as Prisma.Decimal;
}

@Injectable()
export class WbsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly control: ProjectControlService,
    private readonly calc: ProjectControlCalculationService,
  ) {}

  private async loadActiveNodes(controlPlanId: string): Promise<WbsNodeRow[]> {
    return this.prisma.wbsNode.findMany({
      where: { controlPlanId, deletedAt: null },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  /** فهرست تخت WBS (Frontend خودش درخت را می‌سازد) + مقادیر محاسبه‌شده. */
  async list(projectId: string): Promise<WbsNodeComputedDto[]> {
    const plan = await this.control.requireActivePlan(projectId);
    const [nodes, deps] = await Promise.all([
      this.loadActiveNodes(plan.id),
      this.prisma.taskDependency.findMany({ where: { controlPlanId: plan.id } }),
    ]);
    const computed = this.calc.compute(nodes, deps, { statusDate: plan.statusDate });
    return nodes.map((n) => ({
      ...mapWbsNode(n),
      computed: computed.get(n.id)!,
    }));
  }

  async getOne(projectId: string, nodeId: string): Promise<WbsNodeDto> {
    const plan = await this.control.requireActivePlan(projectId);
    const node = await this.prisma.wbsNode.findFirst({
      where: { id: nodeId, controlPlanId: plan.id, deletedAt: null },
    });
    if (!node) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'نود WBS یافت نشد.' });
    }
    return mapWbsNode(node);
  }

  async children(projectId: string, nodeId: string): Promise<WbsNodeDto[]> {
    const plan = await this.control.requireActivePlan(projectId);
    const rows = await this.prisma.wbsNode.findMany({
      where: { controlPlanId: plan.id, parentId: nodeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(mapWbsNode);
  }

  async ancestors(projectId: string, nodeId: string): Promise<WbsNodeDto[]> {
    const plan = await this.control.requireActivePlan(projectId);
    const node = await this.prisma.wbsNode.findFirst({
      where: { id: nodeId, controlPlanId: plan.id, deletedAt: null },
    });
    if (!node) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'نود WBS یافت نشد.' });
    }
    const ids = node.materializedPath.split('/').filter((x) => x && x !== nodeId);
    if (ids.length === 0) return [];
    const rows = await this.prisma.wbsNode.findMany({
      where: { id: { in: ids }, controlPlanId: plan.id, deletedAt: null },
    });
    // preserve path order
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((x): x is WbsNodeRow => Boolean(x)).map(mapWbsNode);
  }

  async create(
    projectId: string,
    dto: CreateWbsNodeDto,
    ctx: AuditContext,
  ): Promise<WbsNodeDto> {
    const plan = await this.control.requireActivePlan(projectId);

    let parent: WbsNodeRow | null = null;
    if (dto.parentId) {
      parent = await this.prisma.wbsNode.findFirst({
        where: { id: dto.parentId, controlPlanId: plan.id, deletedAt: null },
      });
      if (!parent) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'نود والد نامعتبر است.',
        });
      }
    }

    const id = randomUUID();
    const depth = parent ? parent.depth + 1 : 1;
    const materializedPath = parent ? `${parent.materializedPath}/${id}` : id;

    const created = await this.prisma.wbsNode.create({
      data: {
        id,
        projectId,
        controlPlanId: plan.id,
        parentId: dto.parentId ?? null,
        code: dto.code ?? null,
        title: dto.title.trim(),
        normalizedTitle: normalizeText(dto.title),
        sourceRawTitle: dto.title,
        description: dto.description?.trim() ?? null,
        depth,
        materializedPath,
        nodeType: dto.nodeType ?? WbsNodeType.TASK,
        isSummary: dto.nodeType === WbsNodeType.SUMMARY_TASK || dto.nodeType === WbsNodeType.WORK_PACKAGE,
        isMilestone: dto.nodeType === WbsNodeType.MILESTONE,
        sortOrder: dto.sortOrder ?? 0,
        plannedStart: toDate(dto.plannedStart) ?? null,
        plannedFinish: toDate(dto.plannedFinish) ?? null,
        actualStart: toDate(dto.actualStart) ?? null,
        actualFinish: toDate(dto.actualFinish) ?? null,
        deadline: toDate(dto.deadline) ?? null,
        plannedDurationMinutes: dto.plannedDurationMinutes ?? null,
        percentComplete: dto.percentComplete ?? null,
        physicalProgress: dto.physicalProgress ?? null,
        plannedProgressOverride: dto.plannedProgressOverride ?? null,
        weight: dto.weight ?? null,
        weightSource: dto.weightSource ?? (dto.weight != null ? WeightSource.EXPLICIT : WeightSource.NONE),
        budgetAmount: toDecimal(dto.budgetAmount) ?? null,
        ownerText: dto.ownerText?.trim() ?? null,
        definitionOfDone: dto.definitionOfDone?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        statusOverride: dto.statusOverride ?? null,
      },
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'WbsNode',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapWbsNode(created),
    });
    return mapWbsNode(created);
  }

  async update(
    projectId: string,
    nodeId: string,
    dto: UpdateWbsNodeDto,
    ctx: AuditContext,
  ): Promise<WbsNodeDto> {
    const plan = await this.control.requireActivePlan(projectId);
    const existing = await this.prisma.wbsNode.findFirst({
      where: { id: nodeId, controlPlanId: plan.id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'نود WBS یافت نشد.' });
    }
    if (dto.version != null && dto.version !== existing.version) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این نود توسط کاربر دیگری تغییر کرده است. لطفاً صفحه را تازه‌سازی کنید.',
      });
    }

    const data: Prisma.WbsNodeUpdateInput = {
      code: dto.code === undefined ? undefined : dto.code,
      title: dto.title?.trim(),
      normalizedTitle: dto.title ? normalizeText(dto.title) : undefined,
      description: dto.description === undefined ? undefined : (dto.description?.trim() ?? null),
      nodeType: dto.nodeType,
      plannedStart: toDate(dto.plannedStart),
      plannedFinish: toDate(dto.plannedFinish),
      actualStart: toDate(dto.actualStart),
      actualFinish: toDate(dto.actualFinish),
      deadline: toDate(dto.deadline),
      plannedDurationMinutes: dto.plannedDurationMinutes,
      percentComplete: dto.percentComplete,
      physicalProgress: dto.physicalProgress,
      plannedProgressOverride: dto.plannedProgressOverride,
      weight: dto.weight,
      weightSource: dto.weightSource,
      budgetAmount: toDecimal(dto.budgetAmount),
      ownerText: dto.ownerText === undefined ? undefined : (dto.ownerText?.trim() ?? null),
      definitionOfDone:
        dto.definitionOfDone === undefined ? undefined : (dto.definitionOfDone?.trim() ?? null),
      notes: dto.notes === undefined ? undefined : (dto.notes?.trim() ?? null),
      statusOverride: dto.statusOverride === undefined ? undefined : (dto.statusOverride ?? null),
      sortOrder: dto.sortOrder,
      version: { increment: 1 },
    };

    const updated = await this.prisma.wbsNode.update({ where: { id: nodeId }, data });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'WbsNode',
      entityId: nodeId,
      action: AuditAction.UPDATE,
      oldValue: mapWbsNode(existing),
      newValue: mapWbsNode(updated),
    });
    return mapWbsNode(updated);
  }

  /** حذف نرم به‌همراه تمام نوادگان. */
  async remove(projectId: string, nodeId: string, ctx: AuditContext): Promise<void> {
    const plan = await this.control.requireActivePlan(projectId);
    const existing = await this.prisma.wbsNode.findFirst({
      where: { id: nodeId, controlPlanId: plan.id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'نود WBS یافت نشد.' });
    }
    if (existing.nodeType === WbsNodeType.PROJECT) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'نود ریشهٔ پروژه قابل حذف نیست.',
      });
    }
    const now = new Date();
    await this.prisma.wbsNode.updateMany({
      where: {
        controlPlanId: plan.id,
        deletedAt: null,
        OR: [{ id: nodeId }, { materializedPath: { startsWith: `${existing.materializedPath}/` } }],
      },
      data: { deletedAt: now },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'WbsNode',
      entityId: nodeId,
      action: AuditAction.DELETE,
      oldValue: mapWbsNode(existing),
    });
  }

  async reorder(projectId: string, dto: ReorderDto, ctx: AuditContext): Promise<void> {
    const plan = await this.control.requireActivePlan(projectId);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.wbsNode.updateMany({
          where: { id: item.nodeId, controlPlanId: plan.id, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'WbsNode',
      action: AuditAction.UPDATE,
      newValue: { reorder: dto.items.length },
    });
  }

  async reparent(projectId: string, dto: ReparentDto, ctx: AuditContext): Promise<WbsNodeDto> {
    const plan = await this.control.requireActivePlan(projectId);
    const nodes = await this.loadActiveNodes(plan.id);
    const node = nodes.find((n) => n.id === dto.nodeId);
    if (!node) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'نود WBS یافت نشد.' });
    }
    const newParentId = dto.newParentId ?? null;
    if (newParentId && !nodes.some((n) => n.id === newParentId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'نود والد جدید نامعتبر است.',
      });
    }
    if (
      wouldCreateHierarchyCycle(
        dto.nodeId,
        newParentId,
        nodes.map((n) => ({ id: n.id, parentId: n.parentId })),
      )
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'این جابه‌جایی باعث ایجاد چرخه در ساختار WBS می‌شود.',
      });
    }

    const parent = newParentId ? nodes.find((n) => n.id === newParentId)! : null;
    const newDepth = parent ? parent.depth + 1 : 1;
    const newPath = parent ? `${parent.materializedPath}/${node.id}` : node.id;

    const oldPathPrefix = `${node.materializedPath}/`;
    const descendants = nodes.filter((n) => n.materializedPath.startsWith(oldPathPrefix));
    const depthDelta = newDepth - node.depth;

    await this.prisma.$transaction(async (tx) => {
      await tx.wbsNode.update({
        where: { id: node.id },
        data: {
          parentId: newParentId,
          depth: newDepth,
          materializedPath: newPath,
          sortOrder: dto.sortOrder ?? node.sortOrder,
          version: { increment: 1 },
        },
      });
      for (const d of descendants) {
        await tx.wbsNode.update({
          where: { id: d.id },
          data: {
            depth: d.depth + depthDelta,
            materializedPath: d.materializedPath.replace(node.materializedPath, newPath),
          },
        });
      }
    });

    const updated = await this.prisma.wbsNode.findUniqueOrThrow({ where: { id: node.id } });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'WbsNode',
      entityId: node.id,
      action: AuditAction.UPDATE,
      oldValue: { parentId: node.parentId, materializedPath: node.materializedPath },
      newValue: { parentId: newParentId, materializedPath: newPath },
    });
    return mapWbsNode(updated);
  }

  /**
   * ذخیرهٔ گروهی (Inline bulk edit): آیتم‌های دارای id به‌روزرسانی و بدون id ایجاد می‌شوند.
   * برای ساخت درخت کامل از فایل، از Importer استفاده کنید.
   */
  async bulkUpsert(
    projectId: string,
    dto: BulkWbsDto,
    ctx: AuditContext,
  ): Promise<WbsNodeComputedDto[]> {
    const plan = await this.control.requireActivePlan(projectId);
    const existing = await this.loadActiveNodes(plan.id);
    const existingIds = new Set(existing.map((n) => n.id));

    for (const item of dto.items) {
      if (item.id) {
        if (!existingIds.has(item.id)) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: `نود ${item.id} یافت نشد.`,
          });
        }
        await this.update(projectId, item.id, item, ctx);
      } else {
        await this.create(projectId, item, ctx);
      }
    }
    return this.list(projectId);
  }

  /** اعتبارسنجی ساختار: توازن وزن هر Parent + کیفیت داده. */
  async validate(projectId: string): Promise<{
    isValid: boolean;
    unbalancedParents: { parentId: string | null; total: number; difference: number }[];
    warnings: string[];
  }> {
    const plan = await this.control.requireActivePlan(projectId);
    const nodes = await this.loadActiveNodes(plan.id);
    const childrenOf = new Map<string, WbsNodeRow[]>();
    for (const n of nodes) {
      if (n.parentId) {
        const list = childrenOf.get(n.parentId) ?? [];
        list.push(n);
        childrenOf.set(n.parentId, list);
      }
    }
    const unbalancedParents: { parentId: string | null; total: number; difference: number }[] = [];
    for (const [parentId, kids] of childrenOf) {
      const anyWeight = kids.some((k) => k.weight != null && k.weight > 0);
      if (!anyWeight) continue;
      const res = validateWeightSum(kids.map((k) => k.weight));
      if (!res.isBalanced) {
        unbalancedParents.push({ parentId, total: res.total, difference: res.difference });
      }
    }
    const warnings: string[] = [];
    if (unbalancedParents.length > 0) {
      warnings.push(`${unbalancedParents.length} والد دارای مجموع وزن نامتوازن است.`);
    }
    return { isValid: unbalancedParents.length === 0, unbalancedParents, warnings };
  }
}
