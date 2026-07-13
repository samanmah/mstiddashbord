import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ErrorCode, type IndicatorDto } from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { type CreateIndicatorDto, type UpdateIndicatorDto } from './dto/indicator.dto';
import { mapIndicator } from './project.mapper';

@Injectable()
export class IndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(projectId: string): Promise<IndicatorDto[]> {
    const items = await this.prisma.projectIndicator.findMany({
      where: { projectId },
      orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
    });
    return items.map(mapIndicator);
  }

  async create(
    projectId: string,
    dto: CreateIndicatorDto,
    ctx: AuditContext,
  ): Promise<IndicatorDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.projectIndicator.updateMany({
          where: { projectId },
          data: { isPrimary: false },
        });
      }
      return tx.projectIndicator.create({
        data: {
          projectId,
          title: dto.title.trim(),
          unit: dto.unit?.trim() ?? null,
          plannedValue: dto.plannedValue,
          actualValue: dto.actualValue,
          isPrimary: dto.isPrimary ?? false,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProjectIndicator',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapIndicator(created),
    });
    return mapIndicator(created);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateIndicatorDto,
    ctx: AuditContext,
  ): Promise<IndicatorDto> {
    const existing = await this.prisma.projectIndicator.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'شاخص یافت نشد.' });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.projectIndicator.updateMany({
          where: { projectId, id: { not: id } },
          data: { isPrimary: false },
        });
      }
      return tx.projectIndicator.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          unit: dto.unit === undefined ? undefined : (dto.unit?.trim() ?? null),
          plannedValue: dto.plannedValue,
          actualValue: dto.actualValue,
          isPrimary: dto.isPrimary,
          displayOrder: dto.displayOrder,
        },
      });
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProjectIndicator',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapIndicator(existing),
      newValue: mapIndicator(updated),
    });
    return mapIndicator(updated);
  }

  async remove(projectId: string, id: string, ctx: AuditContext): Promise<void> {
    const existing = await this.prisma.projectIndicator.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'شاخص یافت نشد.' });
    }
    await this.prisma.projectIndicator.delete({ where: { id } });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ProjectIndicator',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapIndicator(existing),
    });
  }
}
