/** ساختار ثابت پاسخ خطا در کل API. */

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMITED: 'RATE_LIMITED',
  WEIGHT_SUM_INVALID: 'WEIGHT_SUM_INVALID',
  IMPORT_ERROR: 'IMPORT_ERROR',
  FILE_INVALID: 'FILE_INVALID',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorDetail {
  field?: string;
  message: string;
  sheet?: string;
  row?: number;
  column?: string;
  value?: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  details: ApiErrorDetail[];
  requestId: string;
}
