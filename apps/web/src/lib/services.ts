import type {
  ActivityDto,
  AuditLogDto,
  AuthUser,
  DashboardDto,
  DecisionDto,
  ImportPreviewResult,
  IndicatorDto,
  MonthlyProgressDto,
  PaginatedResult,
  ProjectDto,
  RiskDto,
  UserDto,
} from '@ppm/contracts';
import { apiRequest } from './api-client';

/* ---------------- Auth ---------------- */

export interface LoginPayload {
  username: string;
  password: string;
  rememberMe: boolean;
}

export const authService = {
  login: (payload: LoginPayload) =>
    apiRequest<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: payload,
      retryOnUnauthorized: false,
    }),
  me: () => apiRequest<AuthUser>('/auth/me'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiRequest<void>('/auth/change-password', { method: 'POST', body: payload }),
};

/* ---------------- Projects ---------------- */

export const projectService = {
  list: () => apiRequest<ProjectDto[]>('/projects'),
  get: (id: string) => apiRequest<ProjectDto>(`/projects/${id}`),
  dashboard: (id: string) => apiRequest<DashboardDto>(`/projects/${id}/dashboard`),
  create: (body: unknown) => apiRequest<ProjectDto>('/projects', { method: 'POST', body }),
  update: (id: string, body: unknown) =>
    apiRequest<ProjectDto>(`/projects/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/projects/${id}`, { method: 'DELETE' }),
};

/* ---------------- Indicators ---------------- */

export const indicatorService = {
  list: (projectId: string) =>
    apiRequest<IndicatorDto[]>(`/projects/${projectId}/indicators`),
  create: (projectId: string, body: unknown) =>
    apiRequest<IndicatorDto>(`/projects/${projectId}/indicators`, { method: 'POST', body }),
  update: (projectId: string, id: string, body: unknown) =>
    apiRequest<IndicatorDto>(`/projects/${projectId}/indicators/${id}`, {
      method: 'PATCH',
      body,
    }),
  remove: (projectId: string, id: string) =>
    apiRequest<void>(`/projects/${projectId}/indicators/${id}`, { method: 'DELETE' }),
};

/* ---------------- Monthly progress ---------------- */

export const monthlyProgressService = {
  list: (projectId: string) =>
    apiRequest<MonthlyProgressDto[]>(`/projects/${projectId}/monthly-progress`),
  bulk: (projectId: string, body: unknown) =>
    apiRequest<MonthlyProgressDto[]>(`/projects/${projectId}/monthly-progress/bulk`, {
      method: 'PUT',
      body,
    }),
};

/* ---------------- Activities ---------------- */

export const activityService = {
  list: (projectId: string) =>
    apiRequest<ActivityDto[]>(`/projects/${projectId}/activities`),
  bulk: (projectId: string, body: unknown) =>
    apiRequest<ActivityDto[]>(`/projects/${projectId}/activities/bulk`, {
      method: 'PUT',
      body,
    }),
  update: (projectId: string, id: string, body: unknown) =>
    apiRequest<ActivityDto>(`/projects/${projectId}/activities/${id}`, {
      method: 'PATCH',
      body,
    }),
};

/* ---------------- Risks ---------------- */

export const riskService = {
  list: (projectId: string) => apiRequest<RiskDto[]>(`/projects/${projectId}/risks`),
  create: (projectId: string, body: unknown) =>
    apiRequest<RiskDto>(`/projects/${projectId}/risks`, { method: 'POST', body }),
  update: (projectId: string, id: string, body: unknown) =>
    apiRequest<RiskDto>(`/projects/${projectId}/risks/${id}`, { method: 'PATCH', body }),
  remove: (projectId: string, id: string) =>
    apiRequest<void>(`/projects/${projectId}/risks/${id}`, { method: 'DELETE' }),
};

/* ---------------- Decisions ---------------- */

export const decisionService = {
  list: (projectId: string) => apiRequest<DecisionDto[]>(`/projects/${projectId}/decisions`),
  create: (projectId: string, body: unknown) =>
    apiRequest<DecisionDto>(`/projects/${projectId}/decisions`, { method: 'POST', body }),
  update: (projectId: string, id: string, body: unknown) =>
    apiRequest<DecisionDto>(`/projects/${projectId}/decisions/${id}`, {
      method: 'PATCH',
      body,
    }),
  remove: (projectId: string, id: string) =>
    apiRequest<void>(`/projects/${projectId}/decisions/${id}`, { method: 'DELETE' }),
};

/* ---------------- Users ---------------- */

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      usp.set(key, String(value));
    }
  }
  const q = usp.toString();
  return q ? `?${q}` : '';
}

export const userService = {
  list: (query: UserListQuery = {}) =>
    apiRequest<PaginatedResult<UserDto>>(`/users${buildQuery({ ...query })}`),
  get: (id: string) => apiRequest<UserDto>(`/users/${id}`),
  create: (body: unknown) => apiRequest<UserDto>('/users', { method: 'POST', body }),
  update: (id: string, body: unknown) =>
    apiRequest<UserDto>(`/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id: string, body: { newPassword: string }) =>
    apiRequest<void>(`/users/${id}/reset-password`, { method: 'POST', body }),
  setStatus: (id: string, isActive: boolean) =>
    apiRequest<UserDto>(`/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
};

/* ---------------- Audit ---------------- */

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  projectId?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
}

export const auditService = {
  list: (query: AuditQuery = {}) =>
    apiRequest<PaginatedResult<AuditLogDto>>(`/audit-logs${buildQuery({ ...query })}`),
};

/* ---------------- Import ---------------- */

export const importService = {
  preview: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<ImportPreviewResult>('/imports/excel/preview', {
      method: 'POST',
      formData,
    });
  },
  commit: (body: { storedFilename: string; fileHash: string }) =>
    apiRequest<{ projectId: string }>('/imports/excel/commit', {
      method: 'POST',
      body,
    }),
};
