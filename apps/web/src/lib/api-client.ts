import type { ApiErrorResponse } from '@ppm/contracts';
import { ErrorCode } from '@ppm/contracts';
import { ApiError } from './api-error';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** بدنه FormData (برای آپلود فایل) */
  formData?: FormData;
  signal?: AbortSignal;
  /** آیا در صورت 401 تلاش برای Refresh انجام شود */
  retryOnUnauthorized?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const csrf = readCookie(CSRF_COOKIE);
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { [CSRF_HEADER]: csrf } : {},
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        // اجازه بده Refresh بعدی دوباره اجرا شود
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: ApiErrorResponse;
  try {
    payload = (await res.json()) as ApiErrorResponse;
  } catch {
    payload = {
      statusCode: res.status,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.',
      details: [],
      requestId: '',
    };
  }
  return new ApiError(payload);
}

async function rawRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<{ res: Response; data: T | null }> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {};

  if (UNSAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers,
    body,
    signal: options.signal,
  });

  if (res.status === 204) {
    return { res, data: null };
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await res.json()) as T;
    return { res, data };
  }
  return { res, data: null };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
  const isAuthRoute = path.startsWith('/auth/login') || path.startsWith('/auth/refresh');

  let { res, data } = await rawRequest<T>(path, options);

  if (res.status === 401 && retryOnUnauthorized && !isAuthRoute) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      ({ res, data } = await rawRequest<T>(path, options));
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  return data as T;
}

/** دانلود فایل باینری (Excel export) با نام فایل پیشنهادی از هدر. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/v1${path}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : 'export.xlsx';
  const blob = await res.blob();
  return { blob, filename };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
