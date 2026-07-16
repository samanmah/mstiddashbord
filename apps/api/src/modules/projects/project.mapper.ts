import {
  type ActivityDto,
  type ActivityStatus,
  type DecisionDto,
  type DecisionStatus,
  type IndicatorDto,
  type MonthlyProgressDto,
  type Probability,
  type ProjectDto,
  type RiskDto,
  type RiskLevel,
} from '@ppm/contracts';
import {
  type Activity,
  type Decision,
  type MonthlyProgress,
  type Project,
  type ProjectIndicator,
  type Risk,
} from '@prisma/client';
import { DashboardCalculationService } from '../calculation/dashboard-calculation.service';

const calc = new DashboardCalculationService();

function isoDate(date: Date): string {
  return date.toISOString();
}

export function mapProject(p: Project): ProjectDto {
  return {
    id: p.id,
    titleFa: p.titleFa,
    titleEn: p.titleEn,
    projectCode: p.projectCode,
    projectManager: p.projectManager,
    projectType: p.projectType,
    budgetBillionRial: p.budgetBillionRial,
    description: p.description,
    startDate: isoDate(p.startDate),
    plannedEndDate: isoDate(p.plannedEndDate),
    reportDate: isoDate(p.reportDate),
    logoUrl: p.logoUrl,
    isActive: p.isActive,
    displayOrder: p.displayOrder,
    version: p.version,
    projectControlEnabled: p.projectControlEnabled,
    activeControlPlanId: p.activeControlPlanId,
    createdAt: isoDate(p.createdAt),
    updatedAt: isoDate(p.updatedAt),
  };
}

export function mapIndicator(i: ProjectIndicator): IndicatorDto {
  return {
    id: i.id,
    projectId: i.projectId,
    title: i.title,
    plannedValue: i.plannedValue,
    actualValue: i.actualValue,
    unit: i.unit,
    isPrimary: i.isPrimary,
    displayOrder: i.displayOrder,
  };
}

export function mapMonthlyProgress(m: MonthlyProgress): MonthlyProgressDto {
  return {
    id: m.id,
    projectId: m.projectId,
    jalaliYear: m.jalaliYear,
    jalaliMonth: m.jalaliMonth,
    monthLabel: m.monthLabel,
    sortOrder: m.sortOrder,
    plannedPercent: m.plannedPercent,
    actualPercent: m.actualPercent,
    deviationPercent: calc.monthlyDeviation(m.plannedPercent, m.actualPercent),
    notes: m.notes,
  };
}

export function mapActivity(a: Activity): ActivityDto {
  const computedStatus = calc.computeActivityStatus(a.plannedPercent, a.actualPercent);
  const statusOverride = a.statusOverride as ActivityStatus | null;
  return {
    id: a.id,
    projectId: a.projectId,
    rowNumber: a.rowNumber,
    title: a.title,
    weightPercent: a.weightPercent,
    startDate: isoDate(a.startDate),
    endDate: isoDate(a.endDate),
    plannedPercent: a.plannedPercent,
    actualPercent: a.actualPercent,
    statusOverride,
    computedStatus,
    effectiveStatus: statusOverride ?? computedStatus,
    notes: a.notes,
    displayOrder: a.displayOrder,
  };
}

export function mapRisk(r: Risk): RiskDto {
  return {
    id: r.id,
    projectId: r.projectId,
    rowNumber: r.rowNumber,
    title: r.title,
    probability: r.probability as Probability,
    riskLevel: r.riskLevel as RiskLevel,
    mitigationAction: r.mitigationAction,
    owner: r.owner,
    dueDate: r.dueDate ? isoDate(r.dueDate) : null,
    status: r.status,
    displayOrder: r.displayOrder,
  };
}

export function mapDecision(d: Decision): DecisionDto {
  const isOverdue =
    d.dueDate !== null && d.status !== 'DONE' && d.dueDate < new Date();
  return {
    id: d.id,
    projectId: d.projectId,
    rowNumber: d.rowNumber,
    subject: d.subject,
    description: d.description,
    owner: d.owner,
    dueDate: d.dueDate ? isoDate(d.dueDate) : null,
    status: d.status as DecisionStatus,
    displayOrder: d.displayOrder,
    isOverdue,
  };
}
