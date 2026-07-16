import { Injectable } from '@nestjs/common';
import {
  ControlNodeStatus,
  type DataQualityReport,
  dateToJalaliString,
  type NodeComputation,
  type PhaseRollupDto,
  WbsNodeType,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectControlCalculationService } from './project-control-calculation.service';
import { ProjectControlService } from './project-control.service';
import { decimalToString, jalaliOrNull, mapWbsNode } from './wbs.mapper';

type WbsNodeRow = Prisma.WbsNodeGetPayload<Record<string, never>>;

interface LoadedPlan {
  plan: Prisma.ProjectControlPlanGetPayload<Record<string, never>>;
  nodes: WbsNodeRow[];
  deps: Prisma.TaskDependencyGetPayload<Record<string, never>>[];
  computed: Map<string, NodeComputation>;
}

@Injectable()
export class ProjectControlAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly control: ProjectControlService,
    private readonly calc: ProjectControlCalculationService,
  ) {}

  private async load(projectId: string): Promise<LoadedPlan> {
    const plan = await this.control.requireActivePlan(projectId);
    const [nodes, deps] = await Promise.all([
      this.prisma.wbsNode.findMany({
        where: { controlPlanId: plan.id, deletedAt: null },
        orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.taskDependency.findMany({ where: { controlPlanId: plan.id } }),
    ]);
    const computed = this.calc.compute(nodes, deps, { statusDate: plan.statusDate });
    return { plan, nodes, deps, computed };
  }

  private rootNode(nodes: WbsNodeRow[]): WbsNodeRow | undefined {
    return nodes.find((n) => n.nodeType === WbsNodeType.PROJECT) ?? nodes.find((n) => n.depth === 0);
  }

  phaseRollups(nodes: WbsNodeRow[], computed: Map<string, NodeComputation>): PhaseRollupDto[] {
    const phases = nodes
      .filter((n) => n.nodeType === WbsNodeType.PHASE)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const descendantsOf = (path: string): WbsNodeRow[] =>
      nodes.filter((n) => n.materializedPath.startsWith(`${path}/`));

    return phases.map((phase, idx) => {
      const c = computed.get(phase.id);
      const desc = descendantsOf(phase.materializedPath);
      const leaves = desc.filter((d) => (computed.get(d.id)?.isLeaf ?? false));
      const completed = leaves.filter(
        (d) => computed.get(d.id)?.status === ControlNodeStatus.COMPLETED,
      ).length;
      const delayed = leaves.filter(
        (d) => computed.get(d.id)?.status === ControlNodeStatus.DELAYED,
      ).length;
      return {
        nodeId: phase.id,
        code: phase.code,
        title: phase.title,
        order: idx + 1,
        plannedProgress: c?.plannedProgress ?? null,
        actualProgress: c?.actualProgress ?? null,
        variancePercent: c?.scheduleVariancePercent ?? null,
        weight: c?.normalizedWeight ?? null,
        taskCount: leaves.length,
        completedCount: completed,
        delayedCount: delayed,
        status: c?.status ?? ControlNodeStatus.UNKNOWN,
        plannedStart: jalaliOrNull(phase.plannedStart),
        plannedFinish: jalaliOrNull(phase.plannedFinish),
        budgetAmount: decimalToString(phase.budgetAmount),
      };
    });
  }

  dataQuality(nodes: WbsNodeRow[], deps: LoadedPlan['deps']): DataQualityReport {
    const leaves = nodes.filter((n) => n.nodeType !== WbsNodeType.PROJECT);
    const validIds = new Set(nodes.map((n) => n.id));
    return {
      nodesWithoutDates: leaves.filter((n) => !n.plannedStart || !n.plannedFinish).length,
      nodesWithoutWeight: leaves.filter((n) => n.weight == null).length,
      nodesWithoutOwner: leaves.filter((n) => !n.ownerText).length,
      nodesWithoutDod: leaves.filter((n) => !n.definitionOfDone).length,
      invalidDependencies: deps.filter(
        (d) => !validIds.has(d.predecessorNodeId) || !validIds.has(d.successorNodeId),
      ).length,
      unbalancedWeightParents: 0,
      fileConflicts: 0,
      staleData: 0,
    };
  }

  async dashboard(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        titleFa: true,
        titleEn: true,
        projectManager: true,
        budgetBillionRial: true,
      },
    });
    const { plan, nodes, deps, computed } = await this.load(projectId);
    const root = this.rootNode(nodes);
    const rootC = root ? computed.get(root.id) : undefined;

    const phaseRollups = this.phaseRollups(nodes, computed);
    const leaves = nodes.filter((n) => computed.get(n.id)?.isLeaf);

    const criticalTasks = leaves
      .filter((n) => computed.get(n.id)?.isCritical === true)
      .map((n) => ({ ...mapWbsNode(n), computed: computed.get(n.id)! }));
    const delayedTasks = leaves
      .filter((n) => computed.get(n.id)?.status === ControlNodeStatus.DELAYED)
      .map((n) => ({ ...mapWbsNode(n), computed: computed.get(n.id)! }));

    const statusDateMs = plan.statusDate.getTime();
    const upcomingTasks = leaves
      .filter((n) => n.plannedStart && n.plannedStart.getTime() >= statusDateMs)
      .sort((a, b) => (a.plannedStart!.getTime() - b.plannedStart!.getTime()))
      .slice(0, 20)
      .map((n) => ({ ...mapWbsNode(n), computed: computed.get(n.id)! }));

    const milestones = nodes.filter((n) => n.nodeType === WbsNodeType.MILESTONE);
    const milestoneSummary = {
      total: milestones.length,
      completed: milestones.filter((m) => computed.get(m.id)?.status === ControlNodeStatus.COMPLETED)
        .length,
      upcoming: milestones.filter(
        (m) => m.plannedFinish && m.plannedFinish.getTime() >= statusDateMs,
      ).length,
      delayed: milestones.filter((m) => computed.get(m.id)?.status === ControlNodeStatus.DELAYED)
        .length,
    };

    const ownerWorkload = this.ownerWorkload(leaves, computed);

    const [risks, decisions, snapshots] = await Promise.all([
      this.prisma.risk.findMany({ where: { projectId, deletedAt: null }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.decision.findMany({ where: { projectId, deletedAt: null }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.projectScheduleSnapshot.findMany({
        where: { controlPlanId: plan.id },
        orderBy: { reportingDate: 'asc' },
      }),
    ]);

    const budgetTotal = this.sumDecimal(nodes.map((n) => n.budgetAmount));
    const actualCostTotal = this.sumDecimal(nodes.map((n) => n.actualCost));

    const executiveKpis = {
      plannedProgress: rootC?.plannedProgress ?? null,
      actualProgress: rootC?.actualProgress ?? null,
      achievement:
        rootC?.plannedProgress && rootC.plannedProgress > 0 && rootC.actualProgress != null
          ? Math.round((rootC.actualProgress / rootC.plannedProgress) * 10000) / 100
          : null,
      scheduleVariancePercent: rootC?.scheduleVariancePercent ?? null,
      status: rootC?.status ?? ControlNodeStatus.UNKNOWN,
      spi: rootC?.spi ?? null,
      cpi: rootC?.cpi ?? null,
      budgetTotal,
      actualCost: actualCostTotal,
      forecastFinish: root ? jalaliOrNull(root.forecastFinish) : null,
      finishVarianceDays: rootC?.finishVarianceDays ?? null,
      criticalCount: criticalTasks.length,
      overdueCount: delayedTasks.length,
      blockedCount: leaves.filter((n) => computed.get(n.id)?.status === ControlNodeStatus.BLOCKED)
        .length,
      upcomingMilestones: milestoneSummary.upcoming,
    };

    return {
      project,
      controlPlan: {
        id: plan.id,
        title: plan.title,
        statusDate: dateToJalaliString(plan.statusDate),
        currency: plan.currency,
        version: plan.version,
      },
      executiveKpis,
      phaseRollups,
      progressSeries: snapshots.map((s) => ({
        reportingDate: dateToJalaliString(s.reportingDate),
        plannedPercent: s.plannedPercent,
        actualPercent: s.actualPercent,
        physicalPercent: s.physicalPercent,
        financialPercent: s.financialPercent,
      })),
      costSeries: phaseRollups.map((p) => ({
        phase: p.title,
        budget: p.budgetAmount,
      })),
      milestoneSummary,
      criticalTasks,
      delayedTasks,
      upcomingTasks,
      ownerWorkload,
      dataQuality: this.dataQuality(nodes, deps),
      risks,
      decisions,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private ownerWorkload(
    leaves: WbsNodeRow[],
    computed: Map<string, NodeComputation>,
  ): { owner: string; total: number; delayed: number; open: number; avgProgress: number | null }[] {
    const map = new Map<string, { total: number; delayed: number; open: number; progressSum: number; progressCount: number }>();
    for (const n of leaves) {
      const owner = n.ownerText?.trim();
      if (!owner) continue;
      const entry = map.get(owner) ?? { total: 0, delayed: 0, open: 0, progressSum: 0, progressCount: 0 };
      entry.total += 1;
      const c = computed.get(n.id);
      if (c?.status === ControlNodeStatus.DELAYED) entry.delayed += 1;
      if (c?.status !== ControlNodeStatus.COMPLETED) entry.open += 1;
      if (c?.actualProgress != null) {
        entry.progressSum += c.actualProgress;
        entry.progressCount += 1;
      }
      map.set(owner, entry);
    }
    return [...map.entries()].map(([owner, e]) => ({
      owner,
      total: e.total,
      delayed: e.delayed,
      open: e.open,
      avgProgress: e.progressCount > 0 ? Math.round((e.progressSum / e.progressCount) * 100) / 100 : null,
    }));
  }

  private sumDecimal(values: (Prisma.Decimal | null)[]): string | null {
    let hasAny = false;
    let sum = 0;
    for (const v of values) {
      if (v != null) {
        hasAny = true;
        sum += Number(v.toString());
      }
    }
    return hasAny ? String(sum) : null;
  }

  // --- per-endpoint analytics ---

  async phaseRollupEndpoint(projectId: string): Promise<PhaseRollupDto[]> {
    const { nodes, computed } = await this.load(projectId);
    return this.phaseRollups(nodes, computed);
  }

  async dataQualityEndpoint(projectId: string): Promise<DataQualityReport> {
    const { nodes, deps } = await this.load(projectId);
    return this.dataQuality(nodes, deps);
  }

  async criticalPathEndpoint(projectId: string): Promise<WbsNodeDtoComputed[]> {
    const { nodes, computed } = await this.load(projectId);
    return nodes
      .filter((n) => computed.get(n.id)?.isCritical === true)
      .map((n) => ({ ...mapWbsNode(n), computed: computed.get(n.id)! }));
  }

  async sCurve(projectId: string): Promise<Record<string, unknown>[]> {
    const { plan } = await this.load(projectId);
    const snapshots = await this.prisma.projectScheduleSnapshot.findMany({
      where: { controlPlanId: plan.id },
      orderBy: { reportingDate: 'asc' },
    });
    return snapshots.map((s) => ({
      reportingDate: dateToJalaliString(s.reportingDate),
      plannedPhysical: s.plannedPercent,
      actualPhysical: s.actualPercent,
      plannedFinancial: s.financialPercent,
      plannedValue: decimalToString(s.plannedValue),
      earnedValue: decimalToString(s.earnedValue),
      actualCost: decimalToString(s.actualCost),
      spi: s.spi,
      cpi: s.cpi,
    }));
  }

  async gantt(projectId: string): Promise<WbsNodeDtoComputed[]> {
    const { nodes, computed } = await this.load(projectId);
    return nodes.map((n) => ({ ...mapWbsNode(n), computed: computed.get(n.id)! }));
  }
}

type WbsNodeDtoComputed = ReturnType<typeof mapWbsNode> & { computed: NodeComputation };
