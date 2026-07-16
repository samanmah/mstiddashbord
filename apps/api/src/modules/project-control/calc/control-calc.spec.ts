import { ControlNodeStatus, WeightSource } from '@ppm/contracts';
import {
  criticalPath,
  computeStatus,
  deriveWeights,
  earnedValue,
  finishVarianceDays,
  hasDependencyCycle,
  hasHierarchyCycle,
  leafActualProgress,
  normalizeWeights,
  plannedProgress,
  rollupProgress,
  scheduleVariancePercent,
  validateWeightSum,
  wouldCreateHierarchyCycle,
} from './control-calc';

const d = (s: string): Date => new Date(`${s}T12:00:00.000Z`);

describe('control-calc: weights', () => {
  it('validateWeightSum detects balanced/unbalanced', () => {
    expect(validateWeightSum([50, 50]).isBalanced).toBe(true);
    const r = validateWeightSum([50, 40]);
    expect(r.isBalanced).toBe(false);
    expect(r.difference).toBe(-10);
  });

  it('normalizeWeights scales to 100', () => {
    expect(normalizeWeights([1, 1, 2])).toEqual([25, 25, 50]);
  });

  it('normalizeWeights distributes equally when all zero', () => {
    expect(normalizeWeights([0, 0, 0, 0])).toEqual([25, 25, 25, 25]);
  });

  it('deriveWeights prefers explicit, then cost, then duration, then equal', () => {
    expect(deriveWeights([{ explicitWeight: 30 }, { explicitWeight: 10 }]).map((x) => x.source)).toEqual([
      WeightSource.EXPLICIT,
      WeightSource.EXPLICIT,
    ]);
    expect(deriveWeights([{ cost: 100 }, { cost: 300 }])).toEqual([
      { weight: 25, source: WeightSource.COST_DERIVED },
      { weight: 75, source: WeightSource.COST_DERIVED },
    ]);
    expect(deriveWeights([{ durationMinutes: 10 }, { durationMinutes: 10 }]).map((x) => x.source)).toEqual([
      WeightSource.DURATION_DERIVED,
      WeightSource.DURATION_DERIVED,
    ]);
    expect(deriveWeights([{}, {}]).map((x) => x.source)).toEqual([
      WeightSource.EQUAL_DERIVED,
      WeightSource.EQUAL_DERIVED,
    ]);
  });
});

describe('control-calc: progress rollup', () => {
  it('leafActualProgress prioritizes physical then percent then reported', () => {
    expect(leafActualProgress({ physicalProgress: 40, percentComplete: 90 })).toBe(40);
    expect(leafActualProgress({ percentComplete: 90 })).toBe(90);
    expect(leafActualProgress({ lastReportedPercent: 12 })).toBe(12);
    expect(leafActualProgress({})).toBeNull();
  });

  it('rollupProgress = weighted sum of children', () => {
    expect(
      rollupProgress([
        { progress: 100, normalizedWeight: 25 },
        { progress: 0, normalizedWeight: 75 },
      ]),
    ).toBe(25);
  });

  it('rollupProgress ignores null children and returns null if none', () => {
    expect(rollupProgress([{ progress: null, normalizedWeight: 50 }])).toBeNull();
    expect(
      rollupProgress([
        { progress: 50, normalizedWeight: 50 },
        { progress: null, normalizedWeight: 50 },
      ]),
    ).toBe(50);
  });
});

describe('control-calc: planned progress', () => {
  it('uses override when present', () => {
    expect(plannedProgress({ override: 42, statusDate: d('2026-01-01') }).value).toBe(42);
  });
  it('0 before start, 100 after finish, linear between', () => {
    const start = d('2026-01-01');
    const finish = d('2026-01-11');
    expect(plannedProgress({ start, finish, statusDate: d('2025-12-01') }).value).toBe(0);
    expect(plannedProgress({ start, finish, statusDate: d('2026-02-01') }).value).toBe(100);
    expect(plannedProgress({ start, finish, statusDate: d('2026-01-06') }).value).toBe(50);
  });
  it('marks approximate when no calendar', () => {
    const r = plannedProgress({ start: d('2026-01-01'), finish: d('2026-01-11'), statusDate: d('2026-01-06') });
    expect(r.approximate).toBe(true);
  });
  it('returns null when dates missing', () => {
    expect(plannedProgress({ statusDate: d('2026-01-01') }).value).toBeNull();
  });
});

describe('control-calc: variance', () => {
  it('scheduleVariancePercent = actual - planned', () => {
    expect(scheduleVariancePercent(40, 50)).toBe(-10);
    expect(scheduleVariancePercent(null, 50)).toBeNull();
  });
  it('finishVarianceDays', () => {
    expect(finishVarianceDays(d('2026-01-11'), d('2026-01-01'))).toBe(10);
    expect(finishVarianceDays(null, d('2026-01-01'))).toBeNull();
  });
});

describe('control-calc: earned value', () => {
  it('computes EV metrics with valid data', () => {
    const r = earnedValue({ budget: 1000, plannedProgress: 50, actualProgress: 40, actualCost: 500 });
    expect(r.bac).toBe(1000);
    expect(r.pv).toBe(500);
    expect(r.ev).toBe(400);
    expect(r.ac).toBe(500);
    expect(r.sv).toBe(-100);
    expect(r.cv).toBe(-100);
    expect(r.spi).toBe(0.8);
    expect(r.cpi).toBe(0.8);
  });
  it('returns nulls when budget missing (no fake zeros)', () => {
    expect(earnedValue({ plannedProgress: 50, actualProgress: 40, actualCost: 500 }).ev).toBeNull();
  });
  it('handles division by zero (pv=0 -> spi null)', () => {
    const r = earnedValue({ budget: 1000, plannedProgress: 0, actualProgress: 40, actualCost: 0 });
    expect(r.spi).toBeNull();
    expect(r.cpi).toBeNull();
  });
});

describe('control-calc: status', () => {
  const base = { statusDate: d('2026-06-01') };
  it('BLOCKED override wins', () => {
    expect(
      computeStatus({
        ...base,
        statusOverride: ControlNodeStatus.BLOCKED,
        actualProgress: 50,
        plannedProgress: 50,
        scheduleVariancePercent: 0,
      }),
    ).toBe(ControlNodeStatus.BLOCKED);
  });
  it('COMPLETED when actual >= 100', () => {
    expect(
      computeStatus({ ...base, actualProgress: 100, plannedProgress: 90, scheduleVariancePercent: 10 }),
    ).toBe(ControlNodeStatus.COMPLETED);
  });
  it('NOT_STARTED when 0 and start in future', () => {
    expect(
      computeStatus({
        ...base,
        actualProgress: 0,
        plannedProgress: 0,
        scheduleVariancePercent: 0,
        plannedStart: d('2026-12-01'),
      }),
    ).toBe(ControlNodeStatus.NOT_STARTED);
  });
  it('ON_TRACK / AT_RISK / DELAYED thresholds', () => {
    expect(
      computeStatus({ ...base, actualProgress: 48, plannedProgress: 50, scheduleVariancePercent: -2 }),
    ).toBe(ControlNodeStatus.ON_TRACK);
    expect(
      computeStatus({ ...base, actualProgress: 40, plannedProgress: 50, scheduleVariancePercent: -10 }),
    ).toBe(ControlNodeStatus.AT_RISK);
    expect(
      computeStatus({ ...base, actualProgress: 20, plannedProgress: 50, scheduleVariancePercent: -30 }),
    ).toBe(ControlNodeStatus.DELAYED);
  });
});

describe('control-calc: cycles', () => {
  it('detects hierarchy cycle', () => {
    expect(
      hasHierarchyCycle([
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
      ]),
    ).toBe(true);
    expect(
      hasHierarchyCycle([
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
      ]),
    ).toBe(false);
  });
  it('wouldCreateHierarchyCycle detects descendant reparent', () => {
    const nodes = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
    ];
    expect(wouldCreateHierarchyCycle('a', 'c', nodes)).toBe(true);
    expect(wouldCreateHierarchyCycle('c', 'a', nodes)).toBe(false);
  });
  it('detects dependency cycle', () => {
    expect(
      hasDependencyCycle([
        { predecessorNodeId: 'a', successorNodeId: 'b' },
        { predecessorNodeId: 'b', successorNodeId: 'a' },
      ]),
    ).toBe(true);
    expect(
      hasDependencyCycle([
        { predecessorNodeId: 'a', successorNodeId: 'b' },
        { predecessorNodeId: 'b', successorNodeId: 'c' },
      ]),
    ).toBe(false);
  });
});

describe('control-calc: critical path', () => {
  it('computes critical path on FS chain', () => {
    const tasks = [
      { id: 'a', durationMinutes: 10 },
      { id: 'b', durationMinutes: 20 },
      { id: 'c', durationMinutes: 5 },
    ];
    const edges = [
      { predecessorNodeId: 'a', successorNodeId: 'b', type: 'FS' as const, lagMinutes: 0 },
      { predecessorNodeId: 'b', successorNodeId: 'c', type: 'FS' as const, lagMinutes: 0 },
    ];
    const r = criticalPath(tasks, edges);
    expect(r.earlyFinish.get('c')).toBe(35);
    expect(r.critical.has('a')).toBe(true);
    expect(r.critical.has('b')).toBe(true);
    expect(r.critical.has('c')).toBe(true);
    expect(r.totalFloat.get('a')).toBe(0);
  });
  it('identifies float on parallel non-critical branch', () => {
    const tasks = [
      { id: 'start', durationMinutes: 0 },
      { id: 'long', durationMinutes: 100 },
      { id: 'short', durationMinutes: 10 },
      { id: 'end', durationMinutes: 0 },
    ];
    const edges = [
      { predecessorNodeId: 'start', successorNodeId: 'long', type: 'FS' as const, lagMinutes: 0 },
      { predecessorNodeId: 'start', successorNodeId: 'short', type: 'FS' as const, lagMinutes: 0 },
      { predecessorNodeId: 'long', successorNodeId: 'end', type: 'FS' as const, lagMinutes: 0 },
      { predecessorNodeId: 'short', successorNodeId: 'end', type: 'FS' as const, lagMinutes: 0 },
    ];
    const r = criticalPath(tasks, edges);
    expect(r.critical.has('long')).toBe(true);
    expect(r.critical.has('short')).toBe(false);
    expect(r.totalFloat.get('short')).toBe(90);
  });
  it('throws on cyclic dependency graph', () => {
    expect(() =>
      criticalPath(
        [
          { id: 'a', durationMinutes: 1 },
          { id: 'b', durationMinutes: 1 },
        ],
        [
          { predecessorNodeId: 'a', successorNodeId: 'b', type: 'FS', lagMinutes: 0 },
          { predecessorNodeId: 'b', successorNodeId: 'a', type: 'FS', lagMinutes: 0 },
        ],
      ),
    ).toThrow();
  });
});
