import type { ApiErrorDetail, ApiErrorResponse } from '@ppm/contracts';

/** خطای ساخت‌یافته API با کد و جزئیات فارسی. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(payload: ApiErrorResponse) {
    super(payload.message);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.details = payload.details ?? [];
    this.requestId = payload.requestId;
  }

  get isConflict(): boolean {
    return this.statusCode === 409;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
