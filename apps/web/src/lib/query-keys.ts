export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  dashboard: (id: string) => ['projects', id, 'dashboard'] as const,
  indicators: (id: string) => ['projects', id, 'indicators'] as const,
  monthlyProgress: (id: string) => ['projects', id, 'monthly-progress'] as const,
  activities: (id: string) => ['projects', id, 'activities'] as const,
  risks: (id: string) => ['projects', id, 'risks'] as const,
  decisions: (id: string) => ['projects', id, 'decisions'] as const,
  users: (query: unknown) => ['users', query] as const,
  audit: (query: unknown) => ['audit-logs', query] as const,
};
