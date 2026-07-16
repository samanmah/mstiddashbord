/**
 * لایهٔ API «کنترل پروژه». از apiRequest مشترک پروژه استفاده می‌کند (Client دوم نمی‌سازد).
 * تمام مسیرها نسبی به /api/v1 هستند (پیشوند در apiRequest افزوده می‌شود).
 */
import { apiRequest } from '@/lib/api-client';
import type {
  BaselineCompareRow,
  BaselineDto,
  BaselineInput,
  ControlDashboard,
  ControlImportCommitResult,
  ControlImportPreview,
  DataQualityReport,
  DependencyInput,
  DependencyUpdateInput,
  EnableControlInput,
  ImportBatchDto,
  ImportIssue,
  ImportMappingItem,
  MppEnvironmentStatus,
  PhaseRollupDto,
  ProgressInput,
  ProgressUpdateDto,
  ProjectControlPlanDto,
  ReorderInput,
  ReparentInput,
  SCurvePoint,
  TaskDependencyDto,
  WbsNodeComputedDto,
  WbsNodeDto,
  WbsNodeInput,
  WbsValidationResult,
} from './project-control-types';

const base = (projectId: string): string => `/projects/${projectId}/control`;

export const projectControlApi = {
  /* ------------------------------- Plan ------------------------------- */
  getPlan: (projectId: string) =>
    apiRequest<ProjectControlPlanDto | null>(`${base(projectId)}/plan`),
  enable: (projectId: string, body: EnableControlInput) =>
    apiRequest<{ plan: ProjectControlPlanDto; root: WbsNodeDto } | ProjectControlPlanDto>(
      `${base(projectId)}/enable`,
      { method: 'POST', body },
    ),

  /* ----------------------------- Dashboard ---------------------------- */
  getDashboard: (projectId: string) =>
    apiRequest<ControlDashboard>(`${base(projectId)}/dashboard`),
  getGantt: (projectId: string) =>
    apiRequest<WbsNodeComputedDto[]>(`${base(projectId)}/gantt`),
  getPhaseRollup: (projectId: string) =>
    apiRequest<PhaseRollupDto[]>(`${base(projectId)}/analytics/phase-rollup`),
  getSCurve: (projectId: string) =>
    apiRequest<SCurvePoint[]>(`${base(projectId)}/analytics/s-curve`),
  getCriticalPath: (projectId: string) =>
    apiRequest<WbsNodeComputedDto[]>(`${base(projectId)}/analytics/critical-path`),
  getDataQuality: (projectId: string) =>
    apiRequest<DataQualityReport>(`${base(projectId)}/analytics/data-quality`),

  /* -------------------------------- WBS ------------------------------- */
  listWbs: (projectId: string) =>
    apiRequest<WbsNodeComputedDto[]>(`${base(projectId)}/wbs`),
  getNode: (projectId: string, nodeId: string) =>
    apiRequest<WbsNodeDto>(`${base(projectId)}/wbs/nodes/${nodeId}`),
  createNode: (projectId: string, body: WbsNodeInput) =>
    apiRequest<WbsNodeDto>(`${base(projectId)}/wbs/nodes`, { method: 'POST', body }),
  updateNode: (projectId: string, nodeId: string, body: WbsNodeInput) =>
    apiRequest<WbsNodeDto>(`${base(projectId)}/wbs/nodes/${nodeId}`, { method: 'PATCH', body }),
  deleteNode: (projectId: string, nodeId: string) =>
    apiRequest<void>(`${base(projectId)}/wbs/nodes/${nodeId}`, { method: 'DELETE' }),
  reparent: (projectId: string, body: ReparentInput) =>
    apiRequest<WbsNodeDto>(`${base(projectId)}/wbs/reparent`, { method: 'POST', body }),
  reorder: (projectId: string, body: ReorderInput) =>
    apiRequest<void>(`${base(projectId)}/wbs/reorder`, { method: 'POST', body }),
  validateWbs: (projectId: string) =>
    apiRequest<WbsValidationResult>(`${base(projectId)}/wbs/validate`, { method: 'POST' }),
  childrenOf: (projectId: string, nodeId: string) =>
    apiRequest<WbsNodeDto[]>(`${base(projectId)}/wbs/nodes/${nodeId}/children`),
  ancestorsOf: (projectId: string, nodeId: string) =>
    apiRequest<WbsNodeDto[]>(`${base(projectId)}/wbs/nodes/${nodeId}/ancestors`),

  /* --------------------------- Dependencies --------------------------- */
  listDependencies: (projectId: string) =>
    apiRequest<TaskDependencyDto[]>(`${base(projectId)}/dependencies`),
  createDependency: (projectId: string, body: DependencyInput) =>
    apiRequest<TaskDependencyDto>(`${base(projectId)}/dependencies`, { method: 'POST', body }),
  updateDependency: (projectId: string, id: string, body: DependencyUpdateInput) =>
    apiRequest<TaskDependencyDto>(`${base(projectId)}/dependencies/${id}`, {
      method: 'PATCH',
      body,
    }),
  deleteDependency: (projectId: string, id: string) =>
    apiRequest<void>(`${base(projectId)}/dependencies/${id}`, { method: 'DELETE' }),
  validateDependencies: (projectId: string) =>
    apiRequest<WbsValidationResult>(`${base(projectId)}/dependencies/validate`, {
      method: 'POST',
    }),

  /* ------------------------------ Progress ---------------------------- */
  listProgress: (projectId: string) =>
    apiRequest<ProgressUpdateDto[]>(`${base(projectId)}/progress`),
  createProgress: (projectId: string, body: ProgressInput) =>
    apiRequest<ProgressUpdateDto>(`${base(projectId)}/progress`, { method: 'POST', body }),
  bulkProgress: (projectId: string, items: ProgressInput[]) =>
    apiRequest<ProgressUpdateDto[]>(`${base(projectId)}/progress/bulk`, {
      method: 'PUT',
      body: { items },
    }),
  progressHistory: (projectId: string, nodeId: string) =>
    apiRequest<ProgressUpdateDto[]>(`${base(projectId)}/nodes/${nodeId}/progress-history`),

  /* ------------------------------ Baselines --------------------------- */
  listBaselines: (projectId: string) =>
    apiRequest<BaselineDto[]>(`${base(projectId)}/baselines`),
  createBaseline: (projectId: string, body: BaselineInput) =>
    apiRequest<BaselineDto>(`${base(projectId)}/baselines`, { method: 'POST', body }),
  activateBaseline: (projectId: string, id: string) =>
    apiRequest<BaselineDto>(`${base(projectId)}/baselines/${id}/activate`, { method: 'POST' }),
  compareBaseline: (projectId: string, id: string) =>
    apiRequest<BaselineCompareRow[]>(`${base(projectId)}/baselines/${id}/compare`),

  /* ------------------------------- Imports ---------------------------- */
  mppCheck: (projectId: string) =>
    apiRequest<MppEnvironmentStatus>(`${base(projectId)}/imports/mpp-check`),
  uploadImport: (projectId: string, file: File, sourceType?: 'EXCEL' | 'MPP') => {
    const formData = new FormData();
    formData.append('file', file);
    if (sourceType) formData.append('sourceType', sourceType);
    return apiRequest<ImportBatchDto>(`${base(projectId)}/imports/upload`, {
      method: 'POST',
      formData,
    });
  },
  previewImport: (projectId: string, id: string, dryRun = true) =>
    apiRequest<ControlImportPreview>(`${base(projectId)}/imports/${id}/preview`, {
      method: 'POST',
      body: { dryRun },
    }),
  mapImport: (projectId: string, id: string, mappings: ImportMappingItem[]) =>
    apiRequest<ControlImportPreview>(`${base(projectId)}/imports/${id}/map`, {
      method: 'POST',
      body: { mappings },
    }),
  validateImport: (projectId: string, id: string) =>
    apiRequest<ControlImportPreview>(`${base(projectId)}/imports/${id}/validate`, {
      method: 'POST',
    }),
  commitImport: (projectId: string, id: string, allowWarnings = false) =>
    apiRequest<ControlImportCommitResult>(`${base(projectId)}/imports/${id}/commit`, {
      method: 'POST',
      body: { confirm: true, allowWarnings },
    }),
  listImports: (projectId: string) =>
    apiRequest<ImportBatchDto[]>(`${base(projectId)}/imports`),
  getImport: (projectId: string, id: string) =>
    apiRequest<ImportBatchDto>(`${base(projectId)}/imports/${id}`),
  importErrors: (projectId: string, id: string) =>
    apiRequest<ImportIssue[]>(`${base(projectId)}/imports/${id}/errors`),
};
