import type {
  ActivityStatus,
  DecisionStatus,
  Probability,
  RiskLevel,
  UserRole,
} from './enums';
import type { ApiErrorDetail } from './api-error';

/** شکل داده‌های به‌اشتراک‌گذاشته‌شده بین API و Web (پس از سریال‌سازی JSON). */

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  lastLoginAt: string | null;
}

export interface ProjectDto {
  id: string;
  titleFa: string;
  titleEn: string | null;
  projectCode: string | null;
  projectManager: string;
  projectType: string;
  budgetBillionRial: number;
  description: string;
  /** ISO date */
  startDate: string;
  plannedEndDate: string;
  reportDate: string;
  logoUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IndicatorDto {
  id: string;
  projectId: string;
  title: string;
  plannedValue: number;
  actualValue: number;
  unit: string | null;
  isPrimary: boolean;
  displayOrder: number;
}

export interface MonthlyProgressDto {
  id: string;
  projectId: string;
  jalaliYear: number;
  jalaliMonth: number;
  monthLabel: string;
  sortOrder: number;
  plannedPercent: number;
  actualPercent: number | null;
  deviationPercent: number | null;
  notes: string | null;
}

export interface ActivityDto {
  id: string;
  projectId: string;
  rowNumber: number;
  title: string;
  weightPercent: number;
  startDate: string;
  endDate: string;
  plannedPercent: number;
  actualPercent: number;
  statusOverride: ActivityStatus | null;
  computedStatus: ActivityStatus;
  effectiveStatus: ActivityStatus;
  notes: string | null;
  displayOrder: number;
}

export interface RiskDto {
  id: string;
  projectId: string;
  rowNumber: number;
  title: string;
  probability: Probability;
  riskLevel: RiskLevel;
  mitigationAction: string;
  owner: string;
  dueDate: string | null;
  status: string | null;
  displayOrder: number;
}

export interface DecisionDto {
  id: string;
  projectId: string;
  rowNumber: number;
  subject: string | null;
  description: string | null;
  owner: string | null;
  dueDate: string | null;
  status: DecisionStatus;
  displayOrder: number;
  isOverdue: boolean;
}

export interface DashboardSummary {
  plannedProjectProgress: number;
  actualProjectProgress: number;
  /** null یعنی «فاقد برنامه» */
  achievementPercent: number | null;
  /** درصد پر شدن Gauge (۰..۱۰۰) */
  achievementGaugeValue: number;
  /** آیا مقدار واقعی از برنامه فراتر رفته است */
  isBeyondPlan: boolean;
  totalWeight: number;
  weightIsValid: boolean;
}

export interface IndicatorSummary {
  indicator: IndicatorDto | null;
  achievementPercent: number | null;
  achievementGaugeValue: number;
}

export interface ConsistencyWarning {
  hasWarning: boolean;
  lastMonthActual: number | null;
  actualProjectProgress: number;
  difference: number | null;
}

export interface DashboardDto {
  project: ProjectDto;
  summary: DashboardSummary;
  indicatorSummary: IndicatorSummary;
  indicators: IndicatorDto[];
  monthlyProgress: MonthlyProgressDto[];
  activities: ActivityDto[];
  risks: RiskDto[];
  decisions: DecisionDto[];
  consistency: ConsistencyWarning;
  generatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserDto {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDto {
  id: string;
  userId: string | null;
  userFullName: string | null;
  projectId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ImportPreviewResult {
  fileHash: string;
  storedFilename: string;
  originalFilename: string;
  counts: {
    projects: number;
    months: number;
    activities: number;
    risks: number;
    decisions: number;
  };
  project: {
    titleFa: string;
    titleEn: string | null;
    projectManager: string;
    budgetBillionRial: number;
  };
  computed: {
    plannedProjectProgress: number;
    actualProjectProgress: number;
    achievementPercent: number | null;
  };
  errors: ApiErrorDetail[];
  isValid: boolean;
}
