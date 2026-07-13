import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  type DecisionDto,
  ErrorCode,
  jalaliStringToDate,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { type CreateDecisionDto, type UpdateDecisionDto } from './dto/decision.dto';
import { mapDecision } from './project.mapper';

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return jalaliStringToDate(value);
}

@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(projectId: string): Promise<DecisionDto[]> {
    const items = await this.prisma.decision.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
    });
    return items.map(mapDecision);
  }

  async create(
    projectId: string,
    dto: CreateDecisionDto,
    ctx: AuditContext,
  ): Promise<DecisionDto> {
    const created = await this.prisma.decision.create({
      data: {
        projectId,
        rowNumber: dto.rowNumber,
        subject: dto.subject?.trim() ?? null,
        description: dto.description?.trim() ?? null,
        owner: dto.owner?.trim() ?? null,
        dueDate: toDate(dto.dueDate),
        status: dto.status,
        displayOrder: dto.displayOrder ?? dto.rowNumber,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Decision',
      entityId: created.id,
      action: AuditAction.CREATE,
      newValue: mapDecision(created),
    });
    return mapDecision(created);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateDecisionDto,
    ctx: AuditContext,
  ): Promise<DecisionDto> {
    const existing = await this.prisma.decision.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'تصمیم یافت نشد.' });
    }
    const updated = await this.prisma.decision.update({
      where: { id },
      data: {
        rowNumber: dto.rowNumber,
        subject: dto.subject === undefined ? undefined : (dto.subject?.trim() ?? null),
        description: dto.description === undefined ? undefined : (dto.description?.trim() ?? null),
        owner: dto.owner === undefined ? undefined : (dto.owner?.trim() ?? null),
        dueDate: dto.dueDate === undefined ? undefined : toDate(dto.dueDate),
        status: dto.status,
        displayOrder: dto.displayOrder,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Decision',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapDecision(existing),
      newValue: mapDecision(updated),
    });
    return mapDecision(updated);
  }

  async remove(projectId: string, id: string, ctx: AuditContext): Promise<void> {
    const existing = await this.prisma.decision.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'تصمیم یافت نشد.' });
    }
    await this.prisma.decision.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Decision',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapDecision(existing),
    });
  }
}
