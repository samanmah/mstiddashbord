import {
  type ProjectControlPlanDto,
  type WbsNodeDto,
  type TaskDependencyDto,
  type ProgressUpdateDto,
  dateToJalaliString,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';

type WbsNodeRow = Prisma.WbsNodeGetPayload<Record<string, never>>;
type ControlPlanRow = Prisma.ProjectControlPlanGetPayload<Record<string, never>>;
type DependencyRow = Prisma.TaskDependencyGetPayload<Record<string, never>>;
type ProgressRow = Prisma.ProgressUpdateGetPayload<Record<string, never>>;

/** تبدیل Date به رشتهٔ جلالی یا null. */
export function jalaliOrNull(date: Date | null | undefined): string | null {
  return date ? dateToJalaliString(date) : null;
}

/** تبدیل Decimal به رشته (حفظ دقت) یا null. */
export function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  return value == null ? null : value.toString();
}

export function mapWbsNode(node: WbsNodeRow): WbsNodeDto {
  return {
    id: node.id,
    projectId: node.projectId,
    controlPlanId: node.controlPlanId,
    parentId: node.parentId,
    code: node.code,
    externalUid: node.externalUid,
    sourceRow: node.sourceRow,
    sourceFileType: node.sourceFileType,
    sourceRawTitle: node.sourceRawTitle,
    title: node.title,
    normalizedTitle: node.normalizedTitle,
    description: node.description,
    depth: node.depth,
    outlineNumber: node.outlineNumber,
    materializedPath: node.materializedPath,
    nodeType: node.nodeType,
    isSummary: node.isSummary,
    isMilestone: node.isMilestone,
    isActive: node.isActive,
    sortOrder: node.sortOrder,
    plannedStart: jalaliOrNull(node.plannedStart),
    plannedFinish: jalaliOrNull(node.plannedFinish),
    actualStart: jalaliOrNull(node.actualStart),
    actualFinish: jalaliOrNull(node.actualFinish),
    forecastFinish: jalaliOrNull(node.forecastFinish),
    baselineStart: jalaliOrNull(node.baselineStart),
    baselineFinish: jalaliOrNull(node.baselineFinish),
    deadline: jalaliOrNull(node.deadline),
    plannedDurationMinutes: node.plannedDurationMinutes,
    actualDurationMinutes: node.actualDurationMinutes,
    remainingDurationMinutes: node.remainingDurationMinutes,
    percentComplete: node.percentComplete,
    physicalProgress: node.physicalProgress,
    plannedProgressOverride: node.plannedProgressOverride,
    financialProgress: node.financialProgress,
    weight: node.weight,
    weightSource: node.weightSource,
    budgetAmount: decimalToString(node.budgetAmount),
    mppCost: decimalToString(node.mppCost),
    baselineCost: decimalToString(node.baselineCost),
    actualCost: decimalToString(node.actualCost),
    ownerText: node.ownerText,
    definitionOfDone: node.definitionOfDone,
    notes: node.notes,
    statusOverride: node.statusOverride,
    constraintType: node.constraintType,
    constraintDate: jalaliOrNull(node.constraintDate),
    calendarName: node.calendarName,
    version: node.version,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

export function mapControlPlan(plan: ControlPlanRow): ProjectControlPlanDto {
  return {
    id: plan.id,
    projectId: plan.projectId,
    title: plan.title,
    description: plan.description,
    statusDate: dateToJalaliString(plan.statusDate),
    scheduleStart: jalaliOrNull(plan.scheduleStart),
    scheduleFinish: jalaliOrNull(plan.scheduleFinish),
    baselineId: plan.baselineId,
    periodUnit: plan.periodUnit,
    periodCount: plan.periodCount,
    totalDurationDays: plan.totalDurationDays,
    totalDurationMonths: plan.totalDurationMonths,
    timezone: plan.timezone,
    currency: plan.currency,
    isActive: plan.isActive,
    version: plan.version,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function mapDependency(dep: DependencyRow): TaskDependencyDto {
  return {
    id: dep.id,
    projectId: dep.projectId,
    controlPlanId: dep.controlPlanId,
    predecessorNodeId: dep.predecessorNodeId,
    successorNodeId: dep.successorNodeId,
    type: dep.type,
    lagMinutes: dep.lagMinutes,
    source: dep.source,
  };
}

export function mapProgressUpdate(p: ProgressRow): ProgressUpdateDto {
  return {
    id: p.id,
    projectId: p.projectId,
    nodeId: p.nodeId,
    reportingDate: dateToJalaliString(p.reportingDate),
    actualPercent: p.actualPercent,
    physicalProgress: p.physicalProgress,
    financialProgress: p.financialProgress,
    actualCost: decimalToString(p.actualCost),
    remainingDurationMinutes: p.remainingDurationMinutes,
    forecastFinish: jalaliOrNull(p.forecastFinish),
    status: p.status,
    comment: p.comment,
    evidenceUrl: p.evidenceUrl,
    createdByUserId: p.createdByUserId,
    createdAt: p.createdAt.toISOString(),
  };
}
