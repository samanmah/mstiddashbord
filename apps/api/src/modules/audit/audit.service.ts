import { Injectable, Logger } from '@nestjs/common';
import { type AuditAction } from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditContext {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry extends AuditContext {
  projectId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'token',
  'csrfToken',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** حذف مقادیر حساس پیش از ثبت در Audit Log. */
  private mask(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) return undefined;
    const seen = new WeakSet<object>();
    const walk = (input: unknown): unknown => {
      if (input === null || typeof input !== 'object') return input;
      if (seen.has(input as object)) return undefined;
      seen.add(input as object);
      if (Array.isArray(input)) return input.map(walk);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.has(k) ? '***' : walk(v);
      }
      return out;
    };
    return walk(value) as Prisma.InputJsonValue;
  }

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          projectId: entry.projectId ?? null,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          action: entry.action,
          oldValue: this.mask(entry.oldValue),
          newValue: this.mask(entry.newValue),
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      // ثبت ناموفق Audit نباید عملیات اصلی را متوقف کند.
      this.logger.error(
        `ثبت Audit Log ناموفق بود: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
