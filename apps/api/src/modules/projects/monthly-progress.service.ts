import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  jalaliToGregorian,
  type MonthlyProgressDto,
  monthSortKey,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  type CreateMonthlyProgressDto,
  type UpdateMonthlyProgressDto,
} from './dto/monthly-progress.dto';
import { mapMonthlyProgress } from './project.mapper';

function jalaliMonthDate(jy: number, jm: number): Date {
  const g = jalaliToGregorian(jy, jm, 1);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12, 0, 0));
}

@Injectable()
export class MonthlyProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(projectId: string): Promise<MonthlyProgressDto[]> {
    const items = await this.prisma.monthlyProgress.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    return items.map(mapMonthlyProgress);
  }

  async create(
    projectId: string,
    dto: CreateMonthlyProgressDto,
    ctx: AuditContext,
  ): Promise<MonthlyProgressDto> {
    const created = await this.prisma.monthlyProgress.create({
      data: {
        projectId,
        jalaliYear: dto.jalaliYear,
        jalaliMonth: dto.jalaliMonth,
        monthLabel: dto.monthLabel.trim(),
        sortOrder: monthSortKey(dto.jalaliYear, dto.jalaliMonth),
        date: jalaliMonthDate(dto.jalaliYear, dto.jalaliMonth),
        plannedPercent: dto.plannedPercent,
        actualPercent: dto.actualPercent ?? null,
        notes: dto.notes?.trim() ?? null,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'MonthlyProgress',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapMonthlyProgress(created),
    });
    return mapMonthlyProgress(created);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateMonthlyProgressDto,
    ctx: AuditContext,
  ): Promise<MonthlyProgressDto> {
    const existing = await this.prisma.monthlyProgress.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'دوره ماهانه یافت نشد.' });
    }
    const jy = dto.jalaliYear ?? existing.jalaliYear;
    const jm = dto.jalaliMonth ?? existing.jalaliMonth;
    const updated = await this.prisma.monthlyProgress.update({
      where: { id },
      data: {
        jalaliYear: dto.jalaliYear,
        jalaliMonth: dto.jalaliMonth,
        monthLabel: dto.monthLabel?.trim(),
        sortOrder:
          dto.jalaliYear !== undefined || dto.jalaliMonth !== undefined
            ? monthSortKey(jy, jm)
            : undefined,
        date:
          dto.jalaliYear !== undefined || dto.jalaliMonth !== undefined
            ? jalaliMonthDate(jy, jm)
            : undefined,
        plannedPercent: dto.plannedPercent,
        actualPercent: dto.actualPercent === undefined ? undefined : dto.actualPercent,
        notes: dto.notes === undefined ? undefined : (dto.notes?.trim() ?? null),
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'MonthlyProgress',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapMonthlyProgress(existing),
      newValue: mapMonthlyProgress(updated),
    });
    return mapMonthlyProgress(updated);
  }

  /** جایگزینی کامل دوره‌های ماهانه در یک Transaction. */
  async bulkReplace(
    projectId: string,
    items: CreateMonthlyProgressDto[],
    ctx: AuditContext,
  ): Promise<MonthlyProgressDto[]> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.monthlyProgress.deleteMany({ where: { projectId } });
      for (const dto of items) {
        await tx.monthlyProgress.create({
          data: {
            projectId,
            jalaliYear: dto.jalaliYear,
            jalaliMonth: dto.jalaliMonth,
            monthLabel: dto.monthLabel.trim(),
            sortOrder: monthSortKey(dto.jalaliYear, dto.jalaliMonth),
            date: jalaliMonthDate(dto.jalaliYear, dto.jalaliMonth),
            plannedPercent: dto.plannedPercent,
            actualPercent: dto.actualPercent ?? null,
            notes: dto.notes?.trim() ?? null,
          },
        });
      }
      return tx.monthlyProgress.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      });
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'MonthlyProgress',
      action: AuditAction.UPDATE,
      newValue: { count: result.length, bulk: true },
    });
    return result.map(mapMonthlyProgress);
  }

  async remove(projectId: string, id: string, ctx: AuditContext): Promise<void> {
    const existing = await this.prisma.monthlyProgress.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'دوره ماهانه یافت نشد.' });
    }
    await this.prisma.monthlyProgress.delete({ where: { id } });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'MonthlyProgress',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapMonthlyProgress(existing),
    });
  }
}
