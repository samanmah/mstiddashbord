/**
 * هستهٔ محاسبات کنترل پروژه — توابع خالص، Stateless و کاملاً تست‌شده.
 * این ماژول هیچ وابستگی به NestJS/Prisma ندارد تا مستقل قابل تست باشد.
 * تمام محاسبات در Backend انجام می‌شود؛ Frontend فقط نتیجه را نمایش می‌دهد.
 */
import {
  ControlNodeStatus,
  type ControlStatusThresholds,
  DEFAULT_STATUS_THRESHOLDS,
  WeightSource,
} from '@ppm/contracts';

const EPSILON = 1e-9;
export const WEIGHT_SUM_TOLERANCE = 0.01;

export function round2(value: number): number {
  return Math.round((value + EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export interface WeightSumResult {
  total: number;
  isBalanced: boolean;
  /** اختلاف با ۱۰۰ (مثبت=اضافه، منفی=کمبود). */
  difference: number;
}

/** بررسی مجموع وزن فرزندان یک Parent (باید ۱۰۰ باشد). */
export function validateWeightSum(
  weights: readonly (number | null | undefined)[],
): WeightSumResult {
  const total = round2(weights.reduce<number>((acc, w) => acc + (w ?? 0), 0));
  const difference = round2(total - 100);
  return {
    total,
    difference,
    isBalanced: Math.abs(difference) <= WEIGHT_SUM_TOLERANCE,
  };
}

/**
 * نرمال‌سازی وزن فرزندان به مجموع ۱۰۰.
 * اگر همهٔ وزن‌ها صفر/خالی باشند، توزیع مساوی انجام می‌شود.
 */
export function normalizeWeights(
  weights: readonly (number | null | undefined)[],
): number[] {
  const clean = weights.map((w) => (w != null && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  if (sum <= EPSILON) {
    const n = weights.length;
    if (n === 0) return [];
    const equal = round2(100 / n);
    return weights.map(() => equal);
  }
  return clean.map((w) => round2((w / sum) * 100));
}

export interface DerivedWeight {
  weight: number;
  source: WeightSource;
}

/**
 * تعیین وزن مشتق‌شده بر اساس اولویت منابع.
 * اگر وزن صریح موجود باشد از آن استفاده می‌شود؛ در غیر این‌صورت به‌ترتیب
 * Cost → Duration → Equal.
 */
export function deriveWeights(
  nodes: readonly {
    explicitWeight?: number | null;
    mppWeight?: number | null;
    cost?: number | null;
    durationMinutes?: number | null;
  }[],
): DerivedWeight[] {
  if (nodes.length === 0) return [];

  const hasExplicit = nodes.some((n) => n.explicitWeight != null && n.explicitWeight > 0);
  if (hasExplicit) {
    const raw = nodes.map((n) => n.explicitWeight ?? 0);
    return normalizeWeights(raw).map((w) => ({ weight: w, source: WeightSource.EXPLICIT }));
  }

  const hasMpp = nodes.some((n) => n.mppWeight != null && n.mppWeight > 0);
  if (hasMpp) {
    const raw = nodes.map((n) => n.mppWeight ?? 0);
    return normalizeWeights(raw).map((w) => ({
      weight: w,
      source: WeightSource.MPP_CUSTOM_FIELD,
    }));
  }

  const hasCost = nodes.some((n) => n.cost != null && n.cost > 0);
  if (hasCost) {
    const raw = nodes.map((n) => n.cost ?? 0);
    return normalizeWeights(raw).map((w) => ({
      weight: w,
      source: WeightSource.COST_DERIVED,
    }));
  }

  const hasDuration = nodes.some((n) => n.durationMinutes != null && n.durationMinutes > 0);
  if (hasDuration) {
    const raw = nodes.map((n) => n.durationMinutes ?? 0);
    return normalizeWeights(raw).map((w) => ({
      weight: w,
      source: WeightSource.DURATION_DERIVED,
    }));
  }

  const equal = normalizeWeights(nodes.map(() => 1));
  return equal.map((w) => ({ weight: w, source: WeightSource.EQUAL_DERIVED }));
}

// ---------------------------------------------------------------------------
// Progress rollup
// ---------------------------------------------------------------------------

export interface LeafProgressInput {
  physicalProgress?: number | null;
  percentComplete?: number | null;
  lastReportedPercent?: number | null;
}

/** پیشرفت واقعی یک Leaf با اولویت physical → percent → آخرین گزارش. */
export function leafActualProgress(input: LeafProgressInput): number | null {
  if (input.physicalProgress != null) return clampPercent(input.physicalProgress);
  if (input.percentComplete != null) return clampPercent(input.percentComplete);
  if (input.lastReportedPercent != null) return clampPercent(input.lastReportedPercent);
  return null;
}

/** پیشرفت واقعی یک Summary = Σ(childActual × childNormalizedWeight/100). */
export function rollupProgress(
  children: readonly { progress: number | null; normalizedWeight: number }[],
): number | null {
  const valid = children.filter((c) => c.progress != null);
  if (valid.length === 0) return null;
  const weightSum = valid.reduce((a, c) => a + c.normalizedWeight, 0);
  if (weightSum <= EPSILON) return null;
  const sum = valid.reduce((a, c) => a + (c.progress as number) * c.normalizedWeight, 0);
  return round2(sum / weightSum);
}

export function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return round2(value);
}

// ---------------------------------------------------------------------------
// Planned progress
// ---------------------------------------------------------------------------

export interface PlannedProgressResult {
  value: number | null;
  approximate: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * پیشرفت برنامه‌ای خطی بر اساس تاریخ‌ها (روز تقویمی).
 * قبل از شروع=۰، بعد از پایان=۱۰۰، بین=خطی.
 * اگر Override موجود باشد از آن استفاده می‌شود.
 */
export function plannedProgress(params: {
  override?: number | null;
  start?: Date | null;
  finish?: Date | null;
  statusDate: Date;
  hasCalendar?: boolean;
}): PlannedProgressResult {
  if (params.override != null) {
    return { value: clampPercent(params.override), approximate: false };
  }
  const { start, finish, statusDate } = params;
  if (!start || !finish) return { value: null, approximate: false };
  const s = start.getTime();
  const f = finish.getTime();
  const t = statusDate.getTime();
  if (f <= s) {
    return { value: t >= f ? 100 : 0, approximate: !params.hasCalendar };
  }
  if (t <= s) return { value: 0, approximate: !params.hasCalendar };
  if (t >= f) return { value: 100, approximate: !params.hasCalendar };
  const ratio = ((t - s) / (f - s)) * 100;
  return { value: round2(ratio), approximate: !params.hasCalendar };
}

// ---------------------------------------------------------------------------
// Variance
// ---------------------------------------------------------------------------

export function scheduleVariancePercent(
  actual: number | null,
  planned: number | null,
): number | null {
  if (actual == null || planned == null) return null;
  return round2(actual - planned);
}

export function finishVarianceDays(
  forecastFinish: Date | null | undefined,
  baselineFinish: Date | null | undefined,
): number | null {
  if (!forecastFinish || !baselineFinish) return null;
  return Math.round((forecastFinish.getTime() - baselineFinish.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Earned Value
// ---------------------------------------------------------------------------

export interface EarnedValueResult {
  bac: number | null;
  pv: number | null;
  ev: number | null;
  ac: number | null;
  sv: number | null;
  cv: number | null;
  spi: number | null;
  cpi: number | null;
}

const EMPTY_EV: EarnedValueResult = {
  bac: null,
  pv: null,
  ev: null,
  ac: null,
  sv: null,
  cv: null,
  spi: null,
  cpi: null,
};

/**
 * محاسبهٔ Earned Value. فقط وقتی Budget و Actual Cost معتبر باشند مقدار برمی‌گرداند.
 * مدیریت Division by Zero: مخرج صفر → null.
 */
export function earnedValue(params: {
  budget?: number | null;
  plannedProgress?: number | null;
  actualProgress?: number | null;
  actualCost?: number | null;
}): EarnedValueResult {
  const { budget, plannedProgress: pp, actualProgress: ap, actualCost } = params;
  if (budget == null || budget <= 0) return EMPTY_EV;
  if (pp == null || ap == null) return EMPTY_EV;

  const bac = budget;
  const pv = round2((bac * pp) / 100);
  const ev = round2((bac * ap) / 100);
  const ac = actualCost != null ? round2(actualCost) : null;

  const sv = round2(ev - pv);
  const cv = ac != null ? round2(ev - ac) : null;
  const spi = pv > EPSILON ? round2(ev / pv) : null;
  const cpi = ac != null && ac > EPSILON ? round2(ev / ac) : null;

  return { bac, pv, ev, ac, sv, cv, spi, cpi };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function computeStatus(params: {
  statusOverride?: ControlNodeStatus | null;
  actualProgress: number | null;
  plannedProgress: number | null;
  scheduleVariancePercent: number | null;
  plannedStart?: Date | null;
  plannedFinish?: Date | null;
  statusDate: Date;
  thresholds?: ControlStatusThresholds;
}): ControlNodeStatus {
  const th = params.thresholds ?? DEFAULT_STATUS_THRESHOLDS;
  if (
    params.statusOverride === ControlNodeStatus.BLOCKED ||
    params.statusOverride === ControlNodeStatus.CANCELLED
  ) {
    return params.statusOverride;
  }

  const actual = params.actualProgress;
  if (actual != null && actual >= th.completedMin) return ControlNodeStatus.COMPLETED;

  if (actual === 0 || actual == null) {
    if (params.plannedStart && params.plannedStart.getTime() > params.statusDate.getTime()) {
      return ControlNodeStatus.NOT_STARTED;
    }
  }

  // پایان برنامه گذشته و تکمیل کمتر از ۱۰۰ → DELAYED
  if (
    params.plannedFinish &&
    params.plannedFinish.getTime() < params.statusDate.getTime() &&
    (actual == null || actual < th.completedMin)
  ) {
    return ControlNodeStatus.DELAYED;
  }

  const sv = params.scheduleVariancePercent;
  if (sv == null) return ControlNodeStatus.UNKNOWN;
  if (sv >= th.onTrackMin) return ControlNodeStatus.ON_TRACK;
  if (sv >= th.atRiskMin) return ControlNodeStatus.AT_RISK;
  return ControlNodeStatus.DELAYED;
}

// ---------------------------------------------------------------------------
// Cycle detection (parent/child hierarchy)
// ---------------------------------------------------------------------------

/**
 * تشخیص Cycle در ساختار Parent/Child.
 * برمی‌گرداند true اگر افزودن/وجود رابطه ایجاد چرخه کند.
 */
export function hasHierarchyCycle(
  nodes: readonly { id: string; parentId: string | null }[],
): boolean {
  const parentOf = new Map<string, string | null>();
  for (const n of nodes) parentOf.set(n.id, n.parentId);

  for (const n of nodes) {
    const seen = new Set<string>();
    let current: string | null = n.id;
    while (current != null) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
  }
  return false;
}

/** آیا تنظیم parentId برای nodeId ایجاد چرخه می‌کند؟ (self یا نوادگان). */
export function wouldCreateHierarchyCycle(
  nodeId: string,
  newParentId: string | null,
  nodes: readonly { id: string; parentId: string | null }[],
): boolean {
  if (newParentId == null) return false;
  if (newParentId === nodeId) return true;
  const parentOf = new Map<string, string | null>();
  for (const n of nodes) parentOf.set(n.id, n.parentId);
  let current: string | null = newParentId;
  const seen = new Set<string>();
  while (current != null) {
    if (current === nodeId) return true;
    if (seen.has(current)) break;
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Dependency graph cycle detection
// ---------------------------------------------------------------------------

/** تشخیص Cycle در گراف Dependency (predecessor → successor). */
export function hasDependencyCycle(
  edges: readonly { predecessorNodeId: string; successorNodeId: string }[],
): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.predecessorNodeId) ?? [];
    list.push(e.successorNodeId);
    adj.set(e.predecessorNodeId, list);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.predecessorNodeId);
    nodes.add(e.successorNodeId);
  }
  const dfs = (u: string): boolean => {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(v)) return true;
    }
    color.set(u, BLACK);
    return false;
  };
  for (const n of nodes) {
    if ((color.get(n) ?? WHITE) === WHITE && dfs(n)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Critical Path (CPM) — Forward/Backward pass on FS-only network of minutes
// ---------------------------------------------------------------------------

export interface CpmTask {
  id: string;
  durationMinutes: number;
}

export interface CpmEdge {
  predecessorNodeId: string;
  successorNodeId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagMinutes: number;
}

export interface CpmResult {
  earlyStart: Map<string, number>;
  earlyFinish: Map<string, number>;
  lateStart: Map<string, number>;
  lateFinish: Map<string, number>;
  totalFloat: Map<string, number>;
  freeFloat: Map<string, number>;
  critical: Set<string>;
}

/**
 * محاسبهٔ Critical Path با Forward/Backward Pass.
 * پرتاب خطا در صورت وجود Cycle (باید قبلاً بررسی شود).
 */
export function criticalPath(tasks: readonly CpmTask[], edges: readonly CpmEdge[]): CpmResult {
  if (hasDependencyCycle(edges)) {
    throw new Error('گراف Dependency دارای چرخه است؛ Critical Path قابل محاسبه نیست.');
  }
  const dur = new Map<string, number>();
  for (const t of tasks) dur.set(t.id, Math.max(0, t.durationMinutes));

  const succ = new Map<string, CpmEdge[]>();
  const pred = new Map<string, CpmEdge[]>();
  for (const e of edges) {
    if (!succ.has(e.predecessorNodeId)) succ.set(e.predecessorNodeId, []);
    succ.get(e.predecessorNodeId)!.push(e);
    if (!pred.has(e.successorNodeId)) pred.set(e.successorNodeId, []);
    pred.get(e.successorNodeId)!.push(e);
  }

  const order = topoOrder(tasks.map((t) => t.id), edges);

  const ES = new Map<string, number>();
  const EF = new Map<string, number>();
  // Forward pass
  for (const id of order) {
    const d = dur.get(id) ?? 0;
    let es = 0;
    for (const e of pred.get(id) ?? []) {
      const pEF = EF.get(e.predecessorNodeId) ?? 0;
      const pES = ES.get(e.predecessorNodeId) ?? 0;
      let candidate = 0;
      switch (e.type) {
        case 'FS':
          candidate = pEF + e.lagMinutes;
          break;
        case 'SS':
          candidate = pES + e.lagMinutes;
          break;
        case 'FF':
          candidate = pEF + e.lagMinutes - d;
          break;
        case 'SF':
          candidate = pES + e.lagMinutes - d;
          break;
      }
      es = Math.max(es, candidate);
    }
    ES.set(id, es);
    EF.set(id, es + d);
  }

  const projectFinish = Math.max(0, ...order.map((id) => EF.get(id) ?? 0));

  const LS = new Map<string, number>();
  const LF = new Map<string, number>();
  // Backward pass
  for (const id of [...order].reverse()) {
    const d = dur.get(id) ?? 0;
    const successors = succ.get(id) ?? [];
    let lf = successors.length === 0 ? projectFinish : Number.POSITIVE_INFINITY;
    for (const e of successors) {
      const sLS = LS.get(e.successorNodeId) ?? projectFinish;
      const sLF = LF.get(e.successorNodeId) ?? projectFinish;
      let candidate = projectFinish;
      switch (e.type) {
        case 'FS':
          candidate = sLS - e.lagMinutes;
          break;
        case 'SS':
          candidate = sLS - e.lagMinutes + d;
          break;
        case 'FF':
          candidate = sLF - e.lagMinutes;
          break;
        case 'SF':
          candidate = sLF - e.lagMinutes + d;
          break;
      }
      lf = Math.min(lf, candidate);
    }
    if (!Number.isFinite(lf)) lf = projectFinish;
    LF.set(id, lf);
    LS.set(id, lf - d);
  }

  const totalFloat = new Map<string, number>();
  const freeFloat = new Map<string, number>();
  const critical = new Set<string>();
  for (const id of order) {
    const tf = (LF.get(id) ?? 0) - (EF.get(id) ?? 0);
    totalFloat.set(id, tf);
    // free float = min(ES of successors - EF of this) considering FS
    const successors = succ.get(id) ?? [];
    let ff = tf;
    if (successors.length > 0) {
      ff = Math.min(
        ...successors.map((e) => (ES.get(e.successorNodeId) ?? 0) - (EF.get(id) ?? 0) - e.lagMinutes),
      );
      if (!Number.isFinite(ff)) ff = tf;
    }
    freeFloat.set(id, ff);
    if (Math.abs(tf) <= EPSILON) critical.add(id);
  }

  return {
    earlyStart: ES,
    earlyFinish: EF,
    lateStart: LS,
    lateFinish: LF,
    totalFloat,
    freeFloat,
    critical,
  };
}

/** مرتب‌سازی توپولوژیک (Kahn). */
export function topoOrder(
  ids: readonly string[],
  edges: readonly { predecessorNodeId: string; successorNodeId: string }[],
): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of ids) {
    indeg.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.successorNodeId)) indeg.set(e.successorNodeId, 0);
    if (!adj.has(e.predecessorNodeId)) adj.set(e.predecessorNodeId, []);
    adj.get(e.predecessorNodeId)!.push(e.successorNodeId);
    indeg.set(e.successorNodeId, (indeg.get(e.successorNodeId) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if ((indeg.get(v) ?? 0) === 0) queue.push(v);
    }
  }
  return order;
}
