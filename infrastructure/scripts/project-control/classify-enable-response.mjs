/**
 * تشخیص پاسخ Enable کنترل پروژه — فقط Conflict شناخته‌شدهٔ «قبلاً فعال» مجاز به ادامه است.
 */

const ALREADY_ENABLED_MESSAGE_RE = /کنترل پروژه قبلاً.*فعال شده|قبلاً برای این پروژه فعال/;

/**
 * @param {number} status HTTP status
 * @param {unknown} body JSON body (یا null)
 * @returns {{ ok: true, kind: 'enabled' | 'already-enabled' } | { ok: false, kind: 'error', status: number, code: string, message: string }}
 */
export function classifyEnableControlResponse(status, body) {
  if (Number.isInteger(status) && status >= 200 && status < 300) {
    return { ok: true, kind: 'enabled' };
  }

  const obj = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
  const code = typeof obj.code === 'string' ? obj.code : '';
  const message = typeof obj.message === 'string' ? obj.message : '';

  const alreadyEnabled =
    code === 'CONFLICT' &&
    (status === 400 || status === 409) &&
    ALREADY_ENABLED_MESSAGE_RE.test(message);

  if (alreadyEnabled) {
    return { ok: true, kind: 'already-enabled' };
  }

  return {
    ok: false,
    kind: 'error',
    status: Number.isInteger(status) ? status : 0,
    code: code || 'UNKNOWN',
    message: sanitizeEnableMessage(message || 'پاسخ Enable نامعتبر است.'),
  };
}

/** پیام بدون Token/Cookie/Secret. */
export function sanitizeEnableMessage(message) {
  return String(message)
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/cookie[s]?\s*[:=]\s*[^;\s]+/gi, 'cookie=[redacted]')
    .slice(0, 500);
}
