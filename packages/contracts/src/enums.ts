/**
 * Enumهای مشترک بین Backend و Frontend.
 * مقادیر باید دقیقاً با enumهای Prisma هم‌نام باشند.
 */

export const UserRole = {
  MANAGER_VIEWER: 'MANAGER_VIEWER',
  PROJECT_EDITOR: 'PROJECT_EDITOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ActivityStatus = {
  GOOD: 'GOOD',
  AVERAGE: 'AVERAGE',
  WEAK: 'WEAK',
  UNKNOWN: 'UNKNOWN',
} as const;
export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export const Probability = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type Probability = (typeof Probability)[keyof typeof Probability];

export const RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const DecisionStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_REPORT: 'WAITING_FOR_REPORT',
  DONE: 'DONE',
  OTHER: 'OTHER',
} as const;
export type DecisionStatus = (typeof DecisionStatus)[keyof typeof DecisionStatus];

export const ImportStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
