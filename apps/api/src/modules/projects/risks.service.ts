import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  jalaliStringToDate,
  type RiskDto,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { type CreateRiskDto, type UpdateRiskDto } from './dto/risk.dto';
import { mapRisk } from './project.mapper';

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return jalaliStringToDate(value);
}

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(projectId: string): Promise<RiskDto[]> {
    const items = await this.prisma.risk.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
    });
    return items.map(mapRisk);
  }

  async create(projectId: string, dto: CreateRiskDto, ctx: AuditContext): Promise<RiskDto> {
    const created = await this.prisma.risk.create({
      data: {
        projectId,
        rowNumber: dto.rowNumber,
        title: dto.title.trim(),
        probability: dto.probability,
        riskLevel: dto.riskLevel,
        mitigationAction: dto.mitigationAction?.trim() ?? '',
        owner: dto.owner?.trim() ?? '',
        dueDate: toDate(dto.dueDate),
        status: dto.status?.trim() ?? null,
        displayOrder: dto.displayOrder ?? dto.rowNumber,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Risk',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapRisk(created),
    });
    return mapRisk(created);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateRiskDto,
    ctx: AuditContext,
  ): Promise<RiskDto> {
    const existing = await this.prisma.risk.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'ریسک یافت نشد.' });
    }
    const updated = await this.prisma.risk.update({
      where: { id },
      data: {
        rowNumber: dto.rowNumber,
        title: dto.title?.trim(),
        probability: dto.probability,
        riskLevel: dto.riskLevel,
        mitigationAction: dto.mitigationAction === undefined ? undefined : dto.mitigationAction.trim(),
        owner: dto.owner === undefined ? undefined : dto.owner.trim(),
        dueDate: dto.dueDate === undefined ? undefined : toDate(dto.dueDate),
        status: dto.status === undefined ? undefined : (dto.status?.trim() ?? null),
        displayOrder: dto.displayOrder,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Risk',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapRisk(existing),
      newValue: mapRisk(updated),
    });
    return mapRisk(updated);
  }

  async remove(projectId: string, id: string, ctx: AuditContext): Promise<void> {
    const existing = await this.prisma.risk.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'ریسک یافت نشد.' });
    }
    await this.prisma.risk.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Risk',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapRisk(existing),
    });
  }
}
