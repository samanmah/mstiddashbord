import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  jalaliStringToDate,
  type ProjectDto,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { type CreateProjectDto, type UpdateProjectDto } from './dto/project.dto';
import { mapProject } from './project.mapper';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return projects.map(mapProject);
  }

  async findOneEntity(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
    }
    return project;
  }

  async findOne(id: string): Promise<ProjectDto> {
    return mapProject(await this.findOneEntity(id));
  }

  async create(dto: CreateProjectDto, ctx: AuditContext): Promise<ProjectDto> {
    const maxOrder = await this.prisma.project.aggregate({ _max: { displayOrder: true } });
    const project = await this.prisma.project.create({
      data: {
        titleFa: dto.titleFa.trim(),
        titleEn: dto.titleEn?.trim() ?? null,
        projectCode: dto.projectCode?.trim() ?? null,
        projectManager: dto.projectManager.trim(),
        projectType: dto.projectType.trim(),
        budgetBillionRial: dto.budgetBillionRial,
        description: dto.description?.trim() ?? '',
        startDate: jalaliStringToDate(dto.startDate),
        plannedEndDate: jalaliStringToDate(dto.plannedEndDate),
        reportDate: jalaliStringToDate(dto.reportDate),
        logoUrl: dto.logoUrl ?? null,
        isActive: dto.isActive ?? true,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      },
    });
    await this.audit.record({
      ...ctx,
      projectId: project.id,
      entityType: 'Project',
      entityId: project.id,
      action: AuditAction.CREATE,
      newValue: mapProject(project),
    });
    return mapProject(project);
  }

  async update(id: string, dto: UpdateProjectDto, ctx: AuditContext): Promise<ProjectDto> {
    const existing = await this.findOneEntity(id);
    if (existing.version !== dto.version) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'این پروژه پس از بارگذاری توسط کاربر دیگری تغییر کرده است. لطفاً اطلاعات را تازه‌سازی کنید.',
      });
    }

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (dto.titleFa !== undefined) data.titleFa = dto.titleFa.trim();
    if (dto.titleEn !== undefined) data.titleEn = dto.titleEn?.trim() ?? null;
    if (dto.projectCode !== undefined) data.projectCode = dto.projectCode?.trim() ?? null;
    if (dto.projectManager !== undefined) data.projectManager = dto.projectManager.trim();
    if (dto.projectType !== undefined) data.projectType = dto.projectType.trim();
    if (dto.budgetBillionRial !== undefined) data.budgetBillionRial = dto.budgetBillionRial;
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.startDate !== undefined) data.startDate = jalaliStringToDate(dto.startDate);
    if (dto.plannedEndDate !== undefined) data.plannedEndDate = jalaliStringToDate(dto.plannedEndDate);
    if (dto.reportDate !== undefined) data.reportDate = jalaliStringToDate(dto.reportDate);
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.project.update({ where: { id }, data });
    await this.audit.record({
      ...ctx,
      projectId: id,
      entityType: 'Project',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: mapProject(existing),
      newValue: mapProject(updated),
    });
    return mapProject(updated);
  }

  async remove(id: string, ctx: AuditContext): Promise<void> {
    const existing = await this.findOneEntity(id);
    await this.prisma.project.delete({ where: { id } });
    await this.audit.record({
      ...ctx,
      projectId: id,
      entityType: 'Project',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: mapProject(existing),
    });
  }
}
