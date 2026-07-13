import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ActivityDto,
  AuditAction,
  ErrorCode,
  jalaliStringToDate,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { DashboardCalculationService } from '../calculation/dashboard-calculation.service';
import {
  type CreateActivityDto,
  type UpdateActivityDto,
} from './dto/activity.dto';
import { mapActivity } from './project.mapper';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly calc: DashboardCalculationService,
  ) {}

  async findAll(projectId: string): Promise<ActivityDto[]> {
    const items = await this.prisma.activity.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
    });
    return items.map(mapActivity);
  }

  async create(
    projectId: string,
    dto: CreateActivityDto,
    ctx: AuditContext,
  ): Promise<ActivityDto> {
    const created = await this.prisma.activity.create({
      data: {
        projectId,
        rowNumber: dto.rowNumber,
        title: dto.title.trim(),
        weightPercent: dto.weightPercent,
        startDate: jalaliStringToDate(dto.startDate),
        endDate: jalaliStringToDate(dto.endDate),
        plannedPercent: dto.plannedPercent,
        actualPercent: dto.actualPercent,
        statusOverride: dto.statusOverride ?? null,
        notes: dto.notes?.trim() ?? null,
        displayOrder: dto.displayOrder ?? dto.rowNumber,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Activity',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapActivity(created),
    });
    return mapActivity(created);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateActivityDto,
    ctx: AuditContext,
  ): Promise<ActivityDto> {
    const existing = await this.prisma.activity.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'فعالیت یافت نشد.' });
    }
    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        rowNumber: dto.rowNumber,
        title: dto.title?.trim(),
        weightPercent: dto.weightPercent,
        startDate: dto.startDate ? jalaliStringToDate(dto.startDate) : undefined,
        endDate: dto.endDate ? jalaliStringToDate(dto.endDate) : undefined,
        plannedPercent: dto.plannedPercent,
        actualPercent: dto.actualPercent,
        statusOverride:
          dto.statusOverride === undefined ? undefined : (dto.statusOverride ?? null),
        notes: dto.notes === undefined ? undefined : (dto.notes?.trim() ?? null),
        displayOrder: dto.displayOrder,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Activity',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapActivity(existing),
      newValue: mapActivity(updated),
    });
    return mapActivity(updated);
  }

  /**
   * ذخیره Bulk فعالیت‌ها به‌صورت Transactional.
   * مجموع وزن فعالیت‌های فعال باید دقیقاً ۱۰۰ باشد؛ در غیر این صورت ذخیره انجام نمی‌شود.
   */
  async bulkReplace(
    projectId: string,
    items: CreateActivityDto[],
    ctx: AuditContext,
  ): Promise<ActivityDto[]> {
    const weightCheck = this.calc.validateWeights(
      items.map((i) => ({
        weightPercent: i.weightPercent,
        plannedPercent: i.plannedPercent,
        actualPercent: i.actualPercent,
      })),
    );
    if (!weightCheck.isValid) {
      throw new BadRequestException({
        code: ErrorCode.WEIGHT_SUM_INVALID,
        message: `مجموع وزن فعالیت‌ها باید دقیقاً ۱۰۰ باشد. مجموع فعلی: ${weightCheck.totalWeight} (${
          weightCheck.difference > 0 ? 'اضافه' : 'کمبود'
        } ${Math.abs(weightCheck.difference)}).`,
        details: [
          {
            field: 'weightPercent',
            message: `مجموع فعلی ${weightCheck.totalWeight} است.`,
            value: String(weightCheck.totalWeight),
          },
        ],
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // حذف نرم فعالیت‌هایی که در فهرست جدید نیستند.
      const keepIds = items.filter((i) => i.id).map((i) => i.id!) as string[];
      await tx.activity.updateMany({
        where: { projectId, deletedAt: null, id: { notIn: keepIds } },
        data: { deletedAt: new Date() },
      });
      for (const dto of items) {
        const data = {
          rowNumber: dto.rowNumber,
          title: dto.title.trim(),
          weightPercent: dto.weightPercent,
          startDate: jalaliStringToDate(dto.startDate),
          endDate: jalaliStringToDate(dto.endDate),
          plannedPercent: dto.plannedPercent,
          actualPercent: dto.actualPercent,
          statusOverride: dto.statusOverride ?? null,
          notes: dto.notes?.trim() ?? null,
          displayOrder: dto.displayOrder ?? dto.rowNumber,
        };
        if (dto.id) {
          await tx.activity.update({
            where: { id: dto.id },
            data: { ...data, deletedAt: null },
          });
        } else {
          await tx.activity.create({ data: { projectId, ...data } });
        }
      }
      return tx.activity.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
      });
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Activity',
      action: AuditAction.UPDATE,
      newValue: { count: result.length, bulk: true, totalWeight: weightCheck.totalWeight },
    });
    return result.map(mapActivity);
  }

  async remove(projectId: string, id: string, ctx: AuditContext): Promise<void> {
    const existing = await this.prisma.activity.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'فعالیت یافت نشد.' });
    }
    await this.prisma.activity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Activity',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapActivity(existing),
    });
  }
}
