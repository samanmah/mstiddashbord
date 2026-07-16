/**
 * کلیدهای مرکزی و پایدار React Query برای «کنترل پروژه».
 * همهٔ کلیدها زیر ['projects', projectId, 'control'] قرار می‌گیرند تا Invalidate هدفمند باشد.
 */
export const controlKeys = {
  root: (projectId: string) => ['projects', projectId, 'control'] as const,
  plan: (projectId: string) => ['projects', projectId, 'control', 'plan'] as const,
  dashboard: (projectId: string) => ['projects', projectId, 'control', 'dashboard'] as const,
  wbs: (projectId: string) => ['projects', projectId, 'control', 'wbs'] as const,
  node: (projectId: string, nodeId: string) =>
    ['projects', projectId, 'control', 'wbs', nodeId] as const,
  gantt: (projectId: string) => ['projects', projectId, 'control', 'gantt'] as const,
  dependencies: (projectId: string) =>
    ['projects', projectId, 'control', 'dependencies'] as const,
  progress: (projectId: string) => ['projects', projectId, 'control', 'progress'] as const,
  progressHistory: (projectId: string, nodeId: string) =>
    ['projects', projectId, 'control', 'progress', 'history', nodeId] as const,
  baselines: (projectId: string) => ['projects', projectId, 'control', 'baselines'] as const,
  baselineCompare: (projectId: string, id: string) =>
    ['projects', projectId, 'control', 'baselines', id, 'compare'] as const,
  imports: (projectId: string) => ['projects', projectId, 'control', 'imports'] as const,
  importBatch: (projectId: string, id: string) =>
    ['projects', projectId, 'control', 'imports', id] as const,
  mppCheck: (projectId: string) => ['projects', projectId, 'control', 'mpp-check'] as const,
  phaseRollup: (projectId: string) =>
    ['projects', projectId, 'control', 'phase-rollup'] as const,
  sCurve: (projectId: string) => ['projects', projectId, 'control', 's-curve'] as const,
  criticalPath: (projectId: string) =>
    ['projects', projectId, 'control', 'critical-path'] as const,
  dataQuality: (projectId: string) =>
    ['projects', projectId, 'control', 'data-quality'] as const,
};
