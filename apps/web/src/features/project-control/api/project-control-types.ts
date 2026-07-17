/**
 * انواع لایهٔ داده «کنترل پروژهٔ پیشرفته».
 * تمام Type/Enumهای مشترک از @ppm/contracts دوباره صادر می‌شوند تا کامپوننت‌ها
 * فقط از این ماژول Import کنند و منبع واحدی داشته باشند.
 */
export type {
  ProjectControlPlanDto,
  WbsNodeDto,
  WbsNodeComputedDto,
  NodeComputation,
  TaskDependencyDto,
  ProgressUpdateDto,
  DataQualityReport,
  PhaseRollupDto,
  NodeAssignmentDto,
  ControlStatusThresholds,
} from '@ppm/contracts';

export {
  WbsNodeType,
  WeightSource,
  DependencyType,
  DependencySource,
  AssignmentRole,
  ControlNodeStatus,
  ControlPeriodUnit,
  ControlImportSourceType,
  ControlImportStatus,
  ImportMatchStatus,
  ImportCommitMode,
  PeriodValueType,
  PHASE_COLORS,
  CONTROL_STATUS_COLORS,
  CONTROL_NODE_STATUS_LABELS,
  WBS_NODE_TYPE_LABELS,
  WEIGHT_SOURCE_LABELS,
  DEFAULT_STATUS_THRESHOLDS,
} from '@ppm/contracts';

export type {
  ImportIssue,
  ImportIssueCode,
  ExcelManifest,
  ImportManifestComparison,
  ImportConflict,
  ControlImportPreview,
  ControlImportCommitResult,
  ControlGanttTimelineDto,
  UploadImportResult,
  MppEnvironmentStatus,
  ParsedWbsRow,
  PeriodMatrixStats,
  ImportCommitMode as ImportCommitModeType,
} from '@ppm/contracts';

export { ImportIssueLevel, EXPECTED_EXCEL_MANIFEST } from '@ppm/contracts';

import type {
  ControlNodeStatus,
  DataQualityReport,
  DependencyType,
  DependencySource,
  PhaseRollupDto,
  WbsNodeComputedDto,
  WbsNodeType,
  WeightSource,
} from '@ppm/contracts';

/* ----------------------------- View responses ----------------------------- */

export interface ControlExecutiveKpis {
  plannedProgress: number | null;
  actualProgress: number | null;
  achievement: number | null;
  scheduleVariancePercent: number | null;
  status: ControlNodeStatus;
  spi: number | null;
  cpi: number | null;
  budgetTotal: string | null;
  actualCost: string | null;
  forecastFinish: string | null;
  finishVarianceDays: number | null;
  criticalCount: number;
  overdueCount: number;
  blockedCount: number;
  upcomingMilestones: number;
}

export interface ControlProgressPoint {
  reportingDate: string;
  plannedPercent: number | null;
  actualPercent: number | null;
  physicalPercent: number | null;
  financialPercent: number | null;
}

export interface OwnerWorkloadRow {
  owner: string;
  total: number;
  delayed: number;
  open: number;
  avgProgress: number | null;
}

export interface MilestoneSummary {
  total: number;
  completed: number;
  upcoming: number;
  delayed: number;
}

export interface ControlDashboard {
  project: {
    id: string;
    titleFa: string;
    titleEn: string | null;
    projectManager: string | null;
    budgetBillionRial: number | null;
  };
  controlPlan: {
    id: string;
    title: string;
    statusDate: string;
    currency: string;
    version: number;
  };
  executiveKpis: ControlExecutiveKpis;
  phaseRollups: PhaseRollupDto[];
  progressSeries: ControlProgressPoint[];
  costSeries: { phase: string; budget: string | null }[];
  milestoneSummary: MilestoneSummary;
  criticalTasks: WbsNodeComputedDto[];
  delayedTasks: WbsNodeComputedDto[];
  upcomingTasks: WbsNodeComputedDto[];
  ownerWorkload: OwnerWorkloadRow[];
  dataQuality: DataQualityReport;
  risks: unknown[];
  decisions: unknown[];
  lastUpdatedAt: string;
}

export interface SCurvePoint {
  reportingDate: string;
  plannedPhysical: number | null;
  actualPhysical: number | null;
  plannedFinancial: number | null;
  plannedValue: string | null;
  earnedValue: string | null;
  actualCost: string | null;
  spi: number | null;
  cpi: number | null;
}

export interface BaselineDto {
  id: string;
  projectId: string;
  controlPlanId: string;
  title: string;
  baselineNumber: number;
  statusDate: string;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
}

export interface BaselineCompareRow {
  nodeId: string;
  title: string | null;
  baselinePlannedFinish: string | null;
  currentPlannedFinish: string | null;
  baselineWeight: number | null;
  currentWeight: number | null;
}

export interface ImportBatchDto {
  id: string;
  projectId: string;
  controlPlanId: string | null;
  sourceType: string;
  originalFilename: string | null;
  fileHash: string | null;
  status: string;
  parserVersion: string | null;
  createdNodes: number | null;
  updatedNodes: number | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ----------------------------- Request payloads ---------------------------- */

export interface EnableControlInput {
  title: string;
  description?: string | null;
  statusDate: string;
  currency?: string;
}

export interface WbsNodeInput {
  parentId?: string | null;
  code?: string | null;
  title?: string;
  nodeType?: WbsNodeType;
  description?: string | null;
  plannedStart?: string | null;
  plannedFinish?: string | null;
  actualStart?: string | null;
  actualFinish?: string | null;
  deadline?: string | null;
  plannedDurationMinutes?: number | null;
  percentComplete?: number | null;
  physicalProgress?: number | null;
  plannedProgressOverride?: number | null;
  weight?: number | null;
  weightSource?: WeightSource;
  budgetAmount?: string | null;
  ownerText?: string | null;
  definitionOfDone?: string | null;
  notes?: string | null;
  statusOverride?: ControlNodeStatus | null;
  sortOrder?: number;
  /** فقط برای PATCH: نسخهٔ فعلی جهت Optimistic Concurrency. */
  version?: number;
}

export interface ReparentInput {
  nodeId: string;
  newParentId?: string | null;
  sortOrder?: number;
}

export interface ReorderInput {
  items: { nodeId: string; sortOrder: number }[];
}

export interface DependencyInput {
  predecessorNodeId: string;
  successorNodeId: string;
  type?: DependencyType;
  lagMinutes?: number;
  source?: DependencySource;
}

export interface DependencyUpdateInput {
  type?: DependencyType;
  lagMinutes?: number;
}

export interface ProgressInput {
  nodeId: string;
  reportingDate: string;
  actualPercent: number;
  physicalProgress?: number | null;
  financialProgress?: number | null;
  actualCost?: string | null;
  remainingDurationMinutes?: number | null;
  forecastFinish?: string | null;
  status?: ControlNodeStatus;
  comment?: string | null;
  evidenceUrl?: string | null;
}

export interface BaselineInput {
  title: string;
  statusDate: string;
}

export interface ImportMappingItem {
  sourceRow: number;
  matchedNodeId?: string;
  ignore?: boolean;
}

export interface WbsValidationResult {
  valid: boolean;
  issues: { level: string; code: string; message: string; nodeId?: string }[];
}
