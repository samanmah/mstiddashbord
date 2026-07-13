import { type Request } from 'express';
import { type AuditContext } from '../../modules/audit/audit.service';

/** استخراج IP و User-Agent برای Audit Log. */
export function getRequestContext(req: Request): AuditContext {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
    req.ip ??
    req.socket?.remoteAddress ??
    null;
  const ua = req.headers['user-agent'];
  return {
    userId: req.user?.id ?? null,
    ipAddress: ip,
    userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
  };
}
