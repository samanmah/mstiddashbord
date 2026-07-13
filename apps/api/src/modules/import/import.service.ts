import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type ApiErrorDetail,
  AuditAction,
  ErrorCode,
  type ImportPreviewResult,
  ImportStatus,
  jalaliStringToDate,
  jalaliToGregorian,
  monthSortKey,
} from '@ppm/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { DashboardCalculationService } from '../calculation/dashboard-calculation.service';
import { ExcelParserService, type ParsedWorkbook } from './excel-parser.service';

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ExcelParserService,
    private readonly calc: DashboardCalculationService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get uploadDir(): string {
    return resolve(this.configService.get<AppConfig>('app')!.upload.dir);
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /** ذخیره امن فایل با نام تصادفی (جلوگیری از Path Traversal). */
  private async storeFile(buffer: Buffer): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });
    const storedFilename = `${randomUUID()}.xlsx`;
    await writeFile(join(this.uploadDir, storedFilename), buffer);
    return storedFilename;
  }

  private async readStoredFile(storedFilename: string): Promise<Buffer> {
    // فقط نام فایل مجاز است، نه مسیر.
    if (!/^[a-f0-9-]+\.xlsx$/i.test(storedFilename)) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'نام فایل نامعتبر است.',
      });
    }
    const path = join(this.uploadDir, storedFilename);
    if (!resolve(path).startsWith(this.uploadDir)) {
      throw new BadRequestException({ code: ErrorCode.FILE_INVALID, message: 'مسیر فایل نامعتبر است.' });
    }
    return readFile(path);
  }

  private validate(parsed: ParsedWorkbook): ApiErrorDetail[] {
    const errors = [...parsed.errors];
    if (!parsed.project.titleFa) {
      errors.push({ sheet: 'اطلاعات پروژه', message: 'نام پروژه یافت نشد.' });
    }
    if (parsed.activities.length > 0) {
      const weight = this.calc.validateWeights(
        parsed.activities.map((a) => ({
          weightPercent: a.weightPercent,
          plannedPercent: a.plannedPercent,
          actualPercent: a.actualPercent,
        })),
      );
      if (!weight.isValid) {
        errors.push({
          sheet: 'فعالیت‌ها',
          field: 'وزن',
          message: `مجموع وزن فعالیت‌ها باید ۱۰۰ باشد؛ مقدار فعلی ${weight.totalWeight} است.`,
          value: String(weight.totalWeight),
        });
      }
    }
    return errors;
  }

  async preview(
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    ctx: AuditContext,
  ): Promise<ImportPreviewResult> {
    const fileHash = this.sha256(file.buffer);
    const parsed = await this.parser.parse(file.buffer);
    const errors = this.validate(parsed);
    const storedFilename = await this.storeFile(file.buffer);

    const activityInputs = parsed.activities.map((a) => ({
      weightPercent: a.weightPercent,
      plannedPercent: a.plannedPercent,
      actualPercent: a.actualPercent,
    }));
    const planned = this.calc.plannedProjectProgress(activityInputs);
    const actual = this.calc.actualProjectProgress(activityInputs);

    await this.prisma.importLog.create({
      data: {
        originalFilename: file.originalname.slice(0, 255),
        storedFilename,
        fileHash,
        status: ImportStatus.PENDING,
        importedByUserId: ctx.userId ?? null,
        totalRows:
          parsed.months.length +
          parsed.activities.length +
          parsed.risks.length +
          parsed.decisions.length,
        failedRows: errors.length,
        validationErrors: errors.length > 0 ? (errors as unknown as object) : undefined,
      },
    });

    return {
      fileHash,
      storedFilename,
      originalFilename: file.originalname,
      counts: {
        projects: 1,
        months: parsed.months.length,
        activities: parsed.activities.length,
        risks: parsed.risks.length,
        decisions: parsed.decisions.length,
      },
      project: {
        titleFa: parsed.project.titleFa,
        titleEn: parsed.project.titleEn,
        projectManager: parsed.project.projectManager,
        budgetBillionRial: parsed.project.budgetBillionRial,
      },
      computed: {
        plannedProjectProgress: planned,
        actualProjectProgress: actual,
        achievementPercent: this.calc.achievementPercent(planned, actual),
      },
      errors,
      isValid: errors.length === 0,
    };
  }

  async commit(
    storedFilename: string,
    expectedHash: string,
    ctx: AuditContext,
  ): Promise<{ projectId: string }> {
    const buffer = await this.readStoredFile(storedFilename);
    const fileHash = this.sha256(buffer);
    if (fileHash !== expectedHash) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'فایل با پیش‌نمایش هم‌خوانی ندارد. لطفاً دوباره بارگذاری کنید.',
      });
    }

    const parsed = await this.parser.parse(buffer);
    const errors = this.validate(parsed);
    if (errors.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.IMPORT_ERROR,
        message: 'فایل دارای خطاست و قابل ورود نیست.',
        details: errors,
      });
    }

    // Import اتمیک: یا همه ذخیره می‌شود یا هیچ‌کدام.
    const projectId = await this.prisma.$transaction(async (tx) => {
      const p = parsed.project;
      const project = await tx.project.create({
        data: {
          titleFa: p.titleFa,
          titleEn: p.titleEn,
          projectCode: p.projectCode,
          projectManager: p.projectManager,
          projectType: p.projectType,
          budgetBillionRial: p.budgetBillionRial,
          description: p.description,
          startDate: jalaliStringToDate(p.startDate),
          plannedEndDate: jalaliStringToDate(p.plannedEndDate),
          reportDate: jalaliStringToDate(p.reportDate),
          displayOrder: 1,
        },
      });

      if (p.indicatorTitle) {
        await tx.projectIndicator.create({
          data: {
            projectId: project.id,
            title: p.indicatorTitle,
            plannedValue: p.indicatorPlanned,
            actualValue: p.indicatorActual,
            isPrimary: true,
            displayOrder: 1,
          },
        });
      }

      for (const m of parsed.months) {
        const g = jalaliToGregorian(m.jalaliYear, m.jalaliMonth, 1);
        await tx.monthlyProgress.create({
          data: {
            projectId: project.id,
            jalaliYear: m.jalaliYear,
            jalaliMonth: m.jalaliMonth,
            monthLabel: m.monthLabel,
            sortOrder: monthSortKey(m.jalaliYear, m.jalaliMonth),
            date: new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12, 0, 0)),
            plannedPercent: m.plannedPercent,
            actualPercent: m.actualPercent,
          },
        });
      }

      for (const a of parsed.activities) {
        await tx.activity.create({
          data: {
            projectId: project.id,
            rowNumber: a.rowNumber,
            title: a.title,
            weightPercent: a.weightPercent,
            startDate: jalaliStringToDate(a.startDate),
            endDate: jalaliStringToDate(a.endDate),
            plannedPercent: a.plannedPercent,
            actualPercent: a.actualPercent,
            displayOrder: a.rowNumber,
          },
        });
      }

      for (const r of parsed.risks) {
        await tx.risk.create({
          data: {
            projectId: project.id,
            rowNumber: r.rowNumber,
            title: r.title,
            probability: r.probability,
            riskLevel: r.riskLevel,
            mitigationAction: r.mitigationAction,
            owner: r.owner,
            displayOrder: r.rowNumber,
          },
        });
      }

      for (const d of parsed.decisions) {
        await tx.decision.create({
          data: {
            projectId: project.id,
            rowNumber: d.rowNumber,
            subject: d.subject,
            description: d.description,
            owner: d.owner,
            dueDate: d.dueDate ? jalaliStringToDate(d.dueDate) : null,
            status: d.status,
            displayOrder: d.rowNumber,
          },
        });
      }

      return project.id;
    });

    await this.prisma.importLog.updateMany({
      where: { storedFilename, status: ImportStatus.PENDING },
      data: {
        projectId,
        status: ImportStatus.SUCCESS,
        successRows:
          parsed.months.length +
          parsed.activities.length +
          parsed.risks.length +
          parsed.decisions.length,
        failedRows: 0,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'Import',
      entityId: projectId,
      action: AuditAction.IMPORT,
      newValue: {
        originalFile: storedFilename,
        counts: {
          months: parsed.months.length,
          activities: parsed.activities.length,
          risks: parsed.risks.length,
          decisions: parsed.decisions.length,
        },
      },
    });

    return { projectId };
  }

  async list() {
    return this.prisma.importLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { importedBy: { select: { fullName: true } } },
    });
  }

  async findOne(id: string) {
    const log = await this.prisma.importLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'گزارش Import یافت نشد.' });
    return log;
  }
}
