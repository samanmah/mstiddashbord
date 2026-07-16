/**
 * انواع و ثابت‌های مشترک «کنترل پروژه پیشرفته» بین Backend و Frontend.
 * مقادیر enum باید دقیقاً با enumهای Prisma هم‌نام باشند.
 */

// ---------------------------------------------------------------------------
// Enums (mirror of Prisma)
// ---------------------------------------------------------------------------

export const WbsNodeType = {
  PROJECT: 'PROJECT',
  PHASE: 'PHASE',
  BREAK1: 'BREAK1',
  WORK_PACKAGE: 'WORK_PACKAGE',
  SUMMARY_TASK: 'SUMMARY_TASK',
  TASK: 'TASK',
  MILESTONE: 'MILESTONE',
  DELIVERABLE: 'DELIVERABLE',
} as const;
export type WbsNodeType = (typeof WbsNodeType)[keyof typeof WbsNodeType];

export const WeightSource = {
  EXPLICIT: 'EXPLICIT',
  MPP_CUSTOM_FIELD: 'MPP_CUSTOM_FIELD',
  COST_DERIVED: 'COST_DERIVED',
  DURATION_DERIVED: 'DURATION_DERIVED',
  EQUAL_DERIVED: 'EQUAL_DERIVED',
  NONE: 'NONE',
} as const;
export type WeightSource = (typeof WeightSource)[keyof typeof WeightSource];

export const DependencyType = {
  FS: 'FS',
  SS: 'SS',
  FF: 'FF',
  SF: 'SF',
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];

export const DependencySource = {
  EXCEL: 'EXCEL',
  MPP: 'MPP',
  MANUAL: 'MANUAL',
} as const;
export type DependencySource = (typeof DependencySource)[keyof typeof DependencySource];

export const AssignmentRole = {
  OWNER: 'OWNER',
  RESPONSIBLE: 'RESPONSIBLE',
  ACCOUNTABLE: 'ACCOUNTABLE',
  CONSULTED: 'CONSULTED',
  INFORMED: 'INFORMED',
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER',
} as const;
export type AssignmentRole = (typeof AssignmentRole)[keyof typeof AssignmentRole];

export const ControlNodeStatus = {
  NOT_STARTED: 'NOT_STARTED',
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  DELAYED: 'DELAYED',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type ControlNodeStatus = (typeof ControlNodeStatus)[keyof typeof ControlNodeStatus];

export const ControlPeriodUnit = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  QUARTER: 'QUARTER',
} as const;
export type ControlPeriodUnit = (typeof ControlPeriodUnit)[keyof typeof ControlPeriodUnit];

export const ControlImportSourceType = {
  EXCEL: 'EXCEL',
  MPP: 'MPP',
} as const;
export type ControlImportSourceType =
  (typeof ControlImportSourceType)[keyof typeof ControlImportSourceType];

export const ControlImportStatus = {
  UPLOADED: 'UPLOADED',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  MAPPING: 'MAPPING',
  VALIDATED: 'VALIDATED',
  DRY_RUN: 'DRY_RUN',
  COMMITTING: 'COMMITTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type ControlImportStatus =
  (typeof ControlImportStatus)[keyof typeof ControlImportStatus];

export const ImportMatchStatus = {
  UNMATCHED: 'UNMATCHED',
  AUTO_MATCHED: 'AUTO_MATCHED',
  MANUAL_MATCHED: 'MANUAL_MATCHED',
  AMBIGUOUS: 'AMBIGUOUS',
  CONFLICT: 'CONFLICT',
  IGNORED: 'IGNORED',
} as const;
export type ImportMatchStatus = (typeof ImportMatchStatus)[keyof typeof ImportMatchStatus];

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ProjectControlPlanDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  statusDate: string; // Jalali YYYY/MM/DD
  scheduleStart: string | null;
  scheduleFinish: string | null;
  baselineId: string | null;
  periodUnit: ControlPeriodUnit;
  periodCount: number | null;
  totalDurationDays: number | null;
  totalDurationMonths: number | null;
  timezone: string;
  currency: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WbsNodeDto {
  id: string;
  projectId: string;
  controlPlanId: string;
  parentId: string | null;
  code: string | null;
  externalUid: string | null;
  sourceRow: number | null;
  sourceFileType: string | null;
  sourceRawTitle: string | null;
  title: string;
  normalizedTitle: string;
  description: string | null;
  depth: number;
  outlineNumber: string | null;
  materializedPath: string;
  nodeType: WbsNodeType;
  isSummary: boolean;
  isMilestone: boolean;
  isActive: boolean;
  sortOrder: number;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  forecastFinish: string | null;
  baselineStart: string | null;
  baselineFinish: string | null;
  deadline: string | null;
  plannedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  remainingDurationMinutes: number | null;
  percentComplete: number | null;
  physicalProgress: number | null;
  plannedProgressOverride: number | null;
  financialProgress: number | null;
  weight: number | null;
  weightSource: WeightSource;
  budgetAmount: string | null; // Decimal → string for precision
  mppCost: string | null;
  baselineCost: string | null;
  actualCost: string | null;
  ownerText: string | null;
  definitionOfDone: string | null;
  notes: string | null;
  statusOverride: ControlNodeStatus | null;
  constraintType: string | null;
  constraintDate: string | null;
  calendarName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** WbsNode به‌همراه فیلدهای محاسبه‌شده (خروجی محاسبات Backend). */
export interface WbsNodeComputedDto extends WbsNodeDto {
  computed: NodeComputation;
}

export interface NodeComputation {
  isLeaf: boolean;
  actualProgress: number | null;
  plannedProgress: number | null;
  plannedProgressApproximate: boolean;
  normalizedWeight: number | null;
  scheduleVariancePercent: number | null;
  finishVarianceDays: number | null;
  status: ControlNodeStatus;
  // Earned Value (null اگر داده کافی نباشد)
  bac: number | null;
  pv: number | null;
  ev: number | null;
  ac: number | null;
  sv: number | null;
  cv: number | null;
  spi: number | null;
  cpi: number | null;
  // Critical Path (null اگر قابل محاسبه نباشد)
  isCritical: boolean | null;
  totalFloatMinutes: number | null;
  freeFloatMinutes: number | null;
}

export interface TaskDependencyDto {
  id: string;
  projectId: string;
  controlPlanId: string;
  predecessorNodeId: string;
  successorNodeId: string;
  type: DependencyType;
  lagMinutes: number;
  source: DependencySource;
}

export interface NodeAssignmentDto {
  id: string;
  nodeId: string;
  userId: string | null;
  externalResourceName: string | null;
  role: AssignmentRole;
  allocationPercent: number | null;
}

export interface ProgressUpdateDto {
  id: string;
  projectId: string;
  nodeId: string;
  reportingDate: string;
  actualPercent: number;
  physicalProgress: number | null;
  financialProgress: number | null;
  actualCost: string | null;
  remainingDurationMinutes: number | null;
  forecastFinish: string | null;
  status: ControlNodeStatus;
  comment: string | null;
  evidenceUrl: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface DataQualityReport {
  nodesWithoutDates: number;
  nodesWithoutWeight: number;
  nodesWithoutOwner: number;
  nodesWithoutDod: number;
  invalidDependencies: number;
  unbalancedWeightParents: number;
  fileConflicts: number;
  staleData: number;
}

export interface PhaseRollupDto {
  nodeId: string;
  code: string | null;
  title: string;
  order: number;
  plannedProgress: number | null;
  actualProgress: number | null;
  variancePercent: number | null;
  weight: number | null;
  taskCount: number;
  completedCount: number;
  delayedCount: number;
  status: ControlNodeStatus;
  plannedStart: string | null;
  plannedFinish: string | null;
  budgetAmount: string | null;
}

// ---------------------------------------------------------------------------
// Config: phase colors + status config (Semantic, configurable defaults)
// ---------------------------------------------------------------------------

/** رنگ Semantic فازها (۱..۷). */
export const PHASE_COLORS: readonly string[] = [
  '#1e3a5f', // Phase 1 — Navy/Blue
  '#0891b2', // Phase 2 — Cyan
  '#059669', // Phase 3 — Emerald
  '#7c3aed', // Phase 4 — Violet
  '#ea580c', // Phase 5 — Orange
  '#d97706', // Phase 6 — Amber
  '#4f46e5', // Phase 7 — Indigo
];

export const CONTROL_STATUS_COLORS: Record<ControlNodeStatus, string> = {
  ON_TRACK: '#059669',
  AT_RISK: '#d97706',
  DELAYED: '#dc2626',
  BLOCKED: '#9f1239',
  COMPLETED: '#16a34a',
  NOT_STARTED: '#64748b',
  CANCELLED: '#475569',
  UNKNOWN: '#94a3b8',
};

/** آستانه‌های قابل‌پیکربندی وضعیت (بر حسب انحراف درصدی). */
export interface ControlStatusThresholds {
  onTrackMin: number; // SV% >= این → ON_TRACK
  atRiskMin: number; // atRiskMin <= SV% < onTrackMin → AT_RISK
  completedMin: number; // actualProgress >= این → COMPLETED
}

export const DEFAULT_STATUS_THRESHOLDS: ControlStatusThresholds = {
  onTrackMin: -5,
  atRiskMin: -15,
  completedMin: 100,
};

export const CONTROL_NODE_STATUS_LABELS: Record<ControlNodeStatus, string> = {
  NOT_STARTED: 'شروع‌نشده',
  ON_TRACK: 'در مسیر',
  AT_RISK: 'در معرض ریسک',
  DELAYED: 'تأخیردار',
  BLOCKED: 'متوقف',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
  UNKNOWN: 'نامشخص',
};

export const WBS_NODE_TYPE_LABELS: Record<WbsNodeType, string> = {
  PROJECT: 'پروژه',
  PHASE: 'فاز',
  BREAK1: 'شکست ۱',
  WORK_PACKAGE: 'بسته کاری',
  SUMMARY_TASK: 'فعالیت خلاصه',
  TASK: 'فعالیت',
  MILESTONE: 'نقطه عطف',
  DELIVERABLE: 'خروجی',
};

export const WEIGHT_SOURCE_LABELS: Record<WeightSource, string> = {
  EXPLICIT: 'صریح',
  MPP_CUSTOM_FIELD: 'فیلد سفارشی MPP',
  COST_DERIVED: 'مشتق از هزینه',
  DURATION_DERIVED: 'مشتق از مدت',
  EQUAL_DERIVED: 'توزیع مساوی',
  NONE: 'بدون وزن',
};
