import { Injectable } from '@nestjs/common';
import {
  type ControlNodeStatus,
  type ControlStatusThresholds,
  type NodeComputation,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import {
  computeStatus,
  criticalPath,
  type CpmEdge,
  earnedValue,
  finishVarianceDays,
  hasDependencyCycle,
  leafActualProgress,
  normalizeWeights,
  plannedProgress,
  rollupProgress,
  scheduleVariancePercent,
} from './calc/control-calc';

type WbsNodeRow = Prisma.WbsNodeGetPayload<Record<string, never>>;
type DependencyRow = Prisma.TaskDependencyGetPayload<Record<string, never>>;

function decToNum(value: Prisma.Decimal | null | undefined): number | null {
  return value == null ? null : Number(value.toString());
}

export interface ComputeOptions {
  statusDate: Date;
  thresholds?: ControlStatusThresholds;
  includeCriticalPath?: boolean;
}

/**
 * سرویس محاسبات کنترل پروژه در سطح درخت WBS.
 * تمام محاسبات bottom-up و Backend-side انجام می‌شوند.
 */
@Injectable()
export class ProjectControlCalculationService {
  /**
   * محاسبهٔ کامل درخت. برمی‌گرداند Map از nodeId به NodeComputation.
   */
  compute(
    nodes: readonly WbsNodeRow[],
    dependencies: readonly DependencyRow[],
    options: ComputeOptions,
  ): Map<string, NodeComputation> {
    const active = nodes.filter((n) => n.isActive && n.deletedAt === null);
    const byId = new Map(active.map((n) => [n.id, n]));
    const childrenOf = new Map<string, WbsNodeRow[]>();
    for (const n of active) {
      if (n.parentId && byId.has(n.parentId)) {
        const list = childrenOf.get(n.parentId) ?? [];
        list.push(n);
        childrenOf.set(n.parentId, list);
      }
    }

    const isLeaf = (id: string): boolean => (childrenOf.get(id)?.length ?? 0) === 0;

    // normalized weight of each node within its parent
    const normalizedWeightOf = new Map<string, number>();
    // root-level nodes (no active parent) treated as siblings
    const roots = active.filter((n) => !n.parentId || !byId.has(n.parentId));
    this.assignNormalizedWeights(roots, normalizedWeightOf);
    for (const [, kids] of childrenOf) {
      this.assignNormalizedWeights(kids, normalizedWeightOf);
    }

    // Bottom-up: sort by depth desc
    const ordered = [...active].sort((a, b) => b.depth - a.depth);

    const actualProgress = new Map<string, number | null>();
    const plannedProgressMap = new Map<string, number | null>();
    const plannedApprox = new Map<string, boolean>();

    for (const n of ordered) {
      if (isLeaf(n.id)) {
        actualProgress.set(
          n.id,
          leafActualProgress({
            physicalProgress: n.physicalProgress,
            percentComplete: n.percentComplete,
          }),
        );
        const pp = plannedProgress({
          override: n.plannedProgressOverride,
          start: n.plannedStart,
          finish: n.plannedFinish,
          statusDate: options.statusDate,
          hasCalendar: Boolean(n.calendarName),
        });
        plannedProgressMap.set(n.id, pp.value);
        plannedApprox.set(n.id, pp.approximate);
      } else {
        const kids = childrenOf.get(n.id) ?? [];
        actualProgress.set(
          n.id,
          rollupProgress(
            kids.map((c) => ({
              progress: actualProgress.get(c.id) ?? null,
              normalizedWeight: normalizedWeightOf.get(c.id) ?? 0,
            })),
          ),
        );
        // planned: prefer own override/dates, else rollup from children
        if (n.plannedProgressOverride != null || (n.plannedStart && n.plannedFinish)) {
          const pp = plannedProgress({
            override: n.plannedProgressOverride,
            start: n.plannedStart,
            finish: n.plannedFinish,
            statusDate: options.statusDate,
            hasCalendar: Boolean(n.calendarName),
          });
          plannedProgressMap.set(n.id, pp.value);
          plannedApprox.set(n.id, pp.approximate);
        } else {
          plannedProgressMap.set(
            n.id,
            rollupProgress(
              kids.map((c) => ({
                progress: plannedProgressMap.get(c.id) ?? null,
                normalizedWeight: normalizedWeightOf.get(c.id) ?? 0,
              })),
            ),
          );
          plannedApprox.set(
            n.id,
            kids.some((c) => plannedApprox.get(c.id)),
          );
        }
      }
    }

    // Critical path (only leaves with duration + dependency edges)
    const criticalSet = new Set<string>();
    const totalFloatMap = new Map<string, number>();
    const freeFloatMap = new Map<string, number>();
    let cpmComputed = false;
    if (options.includeCriticalPath !== false && dependencies.length > 0) {
      const edges: CpmEdge[] = dependencies
        .filter((d) => byId.has(d.predecessorNodeId) && byId.has(d.successorNodeId))
        .map((d) => ({
          predecessorNodeId: d.predecessorNodeId,
          successorNodeId: d.successorNodeId,
          type: d.type,
          lagMinutes: d.lagMinutes,
        }));
      const durableNodes = active.filter(
        (n) => isLeaf(n.id) && (n.plannedDurationMinutes ?? 0) > 0,
      );
      const durableIds = new Set(durableNodes.map((n) => n.id));
      const relevantEdges = edges.filter(
        (e) => durableIds.has(e.predecessorNodeId) && durableIds.has(e.successorNodeId),
      );
      if (relevantEdges.length > 0 && !hasDependencyCycle(relevantEdges)) {
        const cpm = criticalPath(
          durableNodes.map((n) => ({ id: n.id, durationMinutes: n.plannedDurationMinutes ?? 0 })),
          relevantEdges,
        );
        for (const id of cpm.critical) criticalSet.add(id);
        for (const [id, v] of cpm.totalFloat) totalFloatMap.set(id, v);
        for (const [id, v] of cpm.freeFloat) freeFloatMap.set(id, v);
        cpmComputed = true;
      }
    }

    const result = new Map<string, NodeComputation>();
    for (const n of active) {
      const actual = actualProgress.get(n.id) ?? null;
      const planned = plannedProgressMap.get(n.id) ?? null;
      const sv = scheduleVariancePercent(actual, planned);
      const budget = decToNum(n.budgetAmount) ?? decToNum(n.mppCost);
      const ev = earnedValue({
        budget,
        plannedProgress: planned,
        actualProgress: actual,
        actualCost: decToNum(n.actualCost),
      });
      const status: ControlNodeStatus = computeStatus({
        statusOverride: n.statusOverride,
        actualProgress: actual,
        plannedProgress: planned,
        scheduleVariancePercent: sv,
        plannedStart: n.plannedStart,
        plannedFinish: n.plannedFinish,
        statusDate: options.statusDate,
        thresholds: options.thresholds,
      });
      const inCpm = cpmComputed && (totalFloatMap.has(n.id) || criticalSet.has(n.id));
      result.set(n.id, {
        isLeaf: isLeaf(n.id),
        actualProgress: actual,
        plannedProgress: planned,
        plannedProgressApproximate: plannedApprox.get(n.id) ?? false,
        normalizedWeight: normalizedWeightOf.get(n.id) ?? null,
        scheduleVariancePercent: sv,
        finishVarianceDays: finishVarianceDays(n.forecastFinish, n.baselineFinish),
        status,
        bac: ev.bac,
        pv: ev.pv,
        ev: ev.ev,
        ac: ev.ac,
        sv: ev.sv,
        cv: ev.cv,
        spi: ev.spi,
        cpi: ev.cpi,
        isCritical: cpmComputed ? criticalSet.has(n.id) : null,
        totalFloatMinutes: inCpm ? (totalFloatMap.get(n.id) ?? null) : null,
        freeFloatMinutes: inCpm ? (freeFloatMap.get(n.id) ?? null) : null,
      });
    }
    return result;
  }

  private assignNormalizedWeights(
    siblings: readonly WbsNodeRow[],
    target: Map<string, number>,
  ): void {
    if (siblings.length === 0) return;
    const normalized = normalizeWeights(siblings.map((s) => s.weight));
    siblings.forEach((s, i) => target.set(s.id, normalized[i] ?? 0));
  }
}
