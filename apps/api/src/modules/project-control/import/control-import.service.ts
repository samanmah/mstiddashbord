import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  ControlImportSourceType,
  ControlImportStatus,
  type ControlImportCommitResult,
  type ControlImportPreview,
  EXCEL_PARSER_VERSION,
  ErrorCode,
  type ImportConflict,
  type ImportIssue,
  ImportIssueCode,
  ImportIssueLevel,
  ImportMatchStatus,
  jalaliStringToDate,
  type ParsedExcelWorkbook,
  WbsNodeType,
  WeightSource,
} from '@ppm/contracts';
import { type Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService, type AuditContext } from '../../audit/audit.service';
import { GanttExcelParserService } from './gantt-excel-parser.service';
import {
  compareManifest,
  manifestIsValid,
  shouldRunStrictFixtureValidation,
  validateStructural,
} from './manifest-validator';
import { buildWbsTree } from './wbs-tree-builder';

const ALLOWED_EXT = new Set(['xlsx', 'xlsm', 'mpp']);

@Injectable()
export class ControlImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelParser: GanttExcelParserService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
  ) {}

  private get uploadDir(): string {
    return resolve(this.configService.get<AppConfig>('app')!.upload.dir, 'project-control');
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private detectSourceType(filename: string): ControlImportSourceType {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (ext === 'mpp') return ControlImportSourceType.MPP;
    return ControlImportSourceType.EXCEL;
  }

  private async storeFile(buffer: Buffer, ext: string): Promise<string> {
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'پسوند فایل مجاز نیست (xlsx/xlsm/mpp).',
      });
    }
    await mkdir(this.uploadDir, { recursive: true });
    const storedFilename = `${randomUUID()}.${ext}`;
    await writeFile(join(this.uploadDir, storedFilename), buffer);
    return storedFilename;
  }

  private async readStoredFile(storedFilename: string): Promise<Buffer> {
    if (!/^[a-f0-9-]+\.(xlsx|xlsm|mpp)$/i.test(storedFilename)) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'نام فایل ذخیره‌شده نامعتبر است.',
      });
    }
    const path = join(this.uploadDir, storedFilename);
    if (!resolve(path).startsWith(this.uploadDir)) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'مسیر فایل نامعتبر است.',
      });
    }
    return readFile(path);
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  async upload(
    projectId: string,
    file: { originalname: string; buffer: Buffer },
    sourceTypeHint: ControlImportSourceType | undefined,
    ctx: AuditContext,
  ): Promise<{ importBatchId: string; sourceType: ControlImportSourceType }> {
    await this.requireProject(projectId);
    const ext = file.originalname.toLowerCase().split('.').pop() ?? '';
    const sourceType = sourceTypeHint ?? this.detectSourceType(file.originalname);
    const storedFilename = await this.storeFile(file.buffer, ext);
    const fileHash = this.sha256(file.buffer);

    const batch = await this.prisma.importBatch.create({
      data: {
        projectId,
        sourceType,
        originalFilename: `${storedFilename}::${file.originalname.slice(0, 200)}`,
        fileHash,
        parserVersion: sourceType === ControlImportSourceType.EXCEL ? EXCEL_PARSER_VERSION : 'mpp',
        status: ControlImportStatus.UPLOADED,
        importedByUserId: ctx.userId ?? null,
      },
    });

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ImportBatch',
      entityId: batch.id,
      action: AuditAction.CREATE,
      newValue: { sourceType, fileHash, status: ControlImportStatus.UPLOADED },
    });

    return { importBatchId: batch.id, sourceType };
  }

  // -------------------------------------------------------------------------
  // Preview / Validate (Excel)
  // -------------------------------------------------------------------------

  async preview(
    projectId: string,
    importBatchId: string,
    dryRun: boolean,
    _ctx: AuditContext,
    options: { strictFixtureManifest?: boolean } = {},
  ): Promise<ControlImportPreview> {
    const batch = await this.requireBatch(projectId, importBatchId);
    if (batch.sourceType !== ControlImportSourceType.EXCEL) {
      throw new BadRequestException({
        code: ErrorCode.IMPORT_ERROR,
        message: 'پیش‌نمایش فقط برای فایل Excel پشتیبانی می‌شود.',
      });
    }
    const storedFilename = batch.originalFilename.split('::')[0]!;
    const buffer = await this.readStoredFile(storedFilename);
    const parsed = await this.excelParser.parse(buffer);
    const preview = await this.buildPreview(
      projectId,
      importBatchId,
      parsed,
      dryRun,
      options,
    );

    await this.persistBatchState(importBatchId, parsed, preview, dryRun);
    return preview;
  }

  async validate(
    projectId: string,
    importBatchId: string,
    ctx: AuditContext,
    options: { strictFixtureManifest?: boolean } = {},
  ): Promise<ControlImportPreview> {
    return this.preview(projectId, importBatchId, true, ctx, options);
  }

  async map(
    projectId: string,
    importBatchId: string,
    mappings: Array<{ sourceRow: number; matchedNodeId?: string; ignore?: boolean }>,
    ctx: AuditContext,
  ): Promise<{ updated: number }> {
    await this.requireBatch(projectId, importBatchId);
    let updated = 0;
    for (const m of mappings) {
      const status = m.ignore
        ? ImportMatchStatus.IGNORED
        : m.matchedNodeId
          ? ImportMatchStatus.MANUAL_MATCHED
          : ImportMatchStatus.UNMATCHED;
      const res = await this.prisma.importSourceRecord.updateMany({
        where: { importBatchId, sourceRow: m.sourceRow },
        data: { matchedNodeId: m.matchedNodeId ?? null, matchStatus: status },
      });
      updated += res.count;
    }
    await this.prisma.importBatch.update({
      where: { id: importBatchId },
      data: { status: ControlImportStatus.MAPPING },
    });
    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ImportBatch',
      entityId: importBatchId,
      action: AuditAction.UPDATE,
      newValue: { mappedRows: updated },
    });
    return { updated };
  }

  // -------------------------------------------------------------------------
  // Preview builder (Pure-ish; قابل استفاده در CLI بدون ثبت)
  // -------------------------------------------------------------------------

  async buildPreview(
    projectId: string,
    importBatchId: string | null,
    parsed: ParsedExcelWorkbook,
    dryRun: boolean,
    options: { strictFixtureManifest?: boolean } = {},
  ): Promise<ControlImportPreview> {
    const issues: ImportIssue[] = [...parsed.issues];
    const tree = buildWbsTree(parsed.rows, 'root');

    const structural = validateStructural(parsed, tree, 'root');
    issues.push(...structural.issues);
    let checks = structural.checks;
    let manifestValid = structural.ok;

    const runStrict = shouldRunStrictFixtureValidation({
      strictFixtureManifest: options.strictFixtureManifest,
      fileHash: parsed.fileHash,
    });
    if (runStrict) {
      const strictChecks = compareManifest(parsed.manifest);
      checks = [...checks, ...strictChecks];
      const strictOk = manifestIsValid(strictChecks);
      manifestValid = manifestValid && strictOk;
      if (!strictOk) {
        for (const c of strictChecks.filter((x) => !x.ok)) {
          issues.push({
            level: ImportIssueLevel.CRITICAL,
            code: ImportIssueCode.MANIFEST_MISMATCH,
            message: `عدم تطابق Fixture Manifest «${c.key}»: انتظار ${c.expected} اما ${c.actual}.`,
          });
        }
      }
    }

    const conflicts = await this.detectConflicts(projectId, parsed);

    const criticalCount = issues.filter((i) => i.level === ImportIssueLevel.CRITICAL).length;
    const warningCount = issues.filter((i) => i.level === ImportIssueLevel.WARNING).length;
    const infoCount = issues.filter((i) => i.level === ImportIssueLevel.INFO).length;

    return {
      importBatchId,
      sourceType: 'EXCEL',
      fileHash: parsed.fileHash,
      parserVersion: parsed.parserVersion,
      dryRun,
      manifest: parsed.manifest,
      manifestChecks: checks,
      manifestValid,
      strictFixtureManifest: runStrict,
      counts: {
        phases: tree.phaseCount,
        break1: tree.break1Count,
        tasks: tree.taskCount,
        totalNodes: tree.nodes.length,
      },
      orphanCount: structural.orphanCount,
      conflicts,
      issues,
      criticalCount,
      warningCount,
      infoCount,
      canCommit: criticalCount === 0 && manifestValid,
    };
  }

  private async detectConflicts(
    projectId: string,
    parsed: ParsedExcelWorkbook,
  ): Promise<ImportConflict[]> {
    const plan = await this.getActivePlan(projectId);
    if (!plan) return [];
    const existing = await this.prisma.wbsNode.findMany({
      where: { controlPlanId: plan.id, deletedAt: null },
      select: { id: true, normalizedTitle: true },
    });
    const byTitle = new Map<string, string>();
    for (const n of existing) byTitle.set(n.normalizedTitle, n.id);
    const conflicts: ImportConflict[] = [];
    for (const row of parsed.rows) {
      const matched = byTitle.get(row.normalizedTitle);
      if (matched) {
        conflicts.push({
          sourceRow: row.sourceRow,
          title: row.normalizedTitle,
          matchedNodeId: matched,
          reason: 'نودی با همین عنوان از قبل وجود دارد (نیازمند تصمیم Editor).',
        });
      }
    }
    return conflicts;
  }

  private async persistBatchState(
    importBatchId: string,
    parsed: ParsedExcelWorkbook,
    preview: ControlImportPreview,
    dryRun: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.importSourceRecord.deleteMany({ where: { importBatchId } });
      if (parsed.rows.length > 0) {
        await tx.importSourceRecord.createMany({
          data: parsed.rows.map((row) => ({
            importBatchId,
            sourceRow: row.sourceRow,
            sourceUid: row.break1Code ? `${row.break1Code}#${row.sourceRow}` : String(row.sourceRow),
            rawData: { rawTitle: row.rawTitle } as Prisma.InputJsonValue,
            normalizedData: {
              phaseCode: row.phaseCode,
              break1Code: row.break1Code,
              title: row.normalizedTitle,
              outlineLevel: row.outlineLevel,
              plannedStart: row.plannedStartJalali,
              plannedFinish: row.plannedFinishJalali,
              budgetAmount: row.budgetAmount,
              percentComplete: row.percentComplete,
            } as Prisma.InputJsonValue,
            matchStatus: ImportMatchStatus.UNMATCHED,
          })),
        });
      }
      await tx.importBatch.update({
        where: { id: importBatchId },
        data: {
          status: dryRun ? ControlImportStatus.DRY_RUN : ControlImportStatus.VALIDATED,
          totalRows: parsed.rows.length,
          warningRows: preview.warningCount,
          failedRows: preview.criticalCount,
          validationReport: {
            manifestChecks: preview.manifestChecks,
            issues: preview.issues,
          } as unknown as Prisma.InputJsonValue,
          mappingReport: { conflicts: preview.conflicts } as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  // -------------------------------------------------------------------------
  // Commit (اتمیک)
  // -------------------------------------------------------------------------

  async commit(
    projectId: string,
    importBatchId: string,
    allowWarnings: boolean,
    ctx: AuditContext,
  ): Promise<ControlImportCommitResult> {
    const batch = await this.requireBatch(projectId, importBatchId);
    const storedFilename = batch.originalFilename.split('::')[0]!;
    const buffer = await this.readStoredFile(storedFilename);
    const fileHash = this.sha256(buffer);
    if (fileHash !== batch.fileHash) {
      throw new BadRequestException({
        code: ErrorCode.FILE_INVALID,
        message: 'فایل با نسخهٔ بارگذاری‌شده هم‌خوانی ندارد.',
      });
    }
    const parsed = await this.excelParser.parse(buffer);
    const preview = await this.buildPreview(projectId, importBatchId, parsed, false);
    this.assertCommittable(preview, allowWarnings);

    const result = await this.commitParsed(projectId, importBatchId, parsed, fileHash, ctx);

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ImportBatch',
      entityId: importBatchId,
      action: AuditAction.IMPORT,
      newValue: {
        createdNodes: result.createdNodes,
        controlPlanId: result.controlPlanId,
        counts: preview.counts,
      },
    });
    return result;
  }

  private assertCommittable(preview: ControlImportPreview, allowWarnings: boolean): void {
    if (!preview.manifestValid || preview.criticalCount > 0) {
      throw new BadRequestException({
        code: ErrorCode.IMPORT_ERROR,
        message: 'فایل دارای خطای بحرانی است و قابل Commit نیست.',
        details: preview.issues
          .filter((i) => i.level === ImportIssueLevel.CRITICAL)
          .map((i) => ({ message: i.message, row: i.row, column: i.column })),
      });
    }
    if (preview.warningCount > 0 && !allowWarnings) {
      throw new BadRequestException({
        code: ErrorCode.IMPORT_ERROR,
        message: 'فایل دارای هشدار است؛ برای Commit پارامتر allowWarnings را فعال کنید.',
      });
    }
  }

  /** ثبت اتمیک درخت WBS از یک Workbook Parse‌شده. */
  async commitParsed(
    projectId: string,
    importBatchId: string | null,
    parsed: ParsedExcelWorkbook,
    fileHash: string,
    ctx: AuditContext,
  ): Promise<ControlImportCommitResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findUnique({
          where: { id: projectId },
          select: { id: true, titleFa: true, projectControlEnabled: true, activeControlPlanId: true },
        });
        if (!project) {
          throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
        }

        // Plan + Root
        let planId = project.activeControlPlanId;
        let rootId: string;
        if (!project.projectControlEnabled || !planId) {
          const plan = await tx.projectControlPlan.create({
            data: {
              projectId,
              title: `برنامهٔ کنترل — ${project.titleFa}`,
              statusDate: new Date(),
              currency: 'TOMAN',
              isActive: true,
              version: 1,
              createdByUserId: ctx.userId ?? null,
              updatedByUserId: ctx.userId ?? null,
            },
          });
          planId = plan.id;
          rootId = randomUUID();
          await tx.wbsNode.create({
            data: {
              id: rootId,
              projectId,
              controlPlanId: planId,
              parentId: null,
              title: project.titleFa,
              normalizedTitle: project.titleFa,
              depth: 0,
              materializedPath: rootId,
              nodeType: WbsNodeType.PROJECT,
              isSummary: true,
              weightSource: WeightSource.NONE,
              sortOrder: 0,
            },
          });
          await tx.project.update({
            where: { id: projectId },
            data: {
              projectControlEnabled: true,
              activeControlPlanId: planId,
              controlCurrency: 'TOMAN',
            },
          });
        } else {
          const root = await tx.wbsNode.findFirst({
            where: { controlPlanId: planId, parentId: null, deletedAt: null },
            select: { id: true },
          });
          if (!root) {
            throw new BadRequestException({
              code: ErrorCode.CONFLICT,
              message: 'نود ریشهٔ Control Plan یافت نشد.',
            });
          }
          rootId = root.id;
        }

        const plan = buildWbsTree(parsed.rows, rootId);
        const idByTemp = new Map<string, string>([['root', rootId]]);
        idByTemp.set(rootId, rootId);
        const pathById = new Map<string, string>([[rootId, rootId]]);

        // ترتیب: نودها به‌ترتیب ساخت (والد قبل از فرزند) در آرایه‌اند.
        let created = 0;
        for (const node of plan.nodes) {
          const id = randomUUID();
          idByTemp.set(node.tempId, id);
          const parentId = node.parentTempId
            ? (idByTemp.get(node.parentTempId) ?? rootId)
            : rootId;
          const parentPath = pathById.get(parentId) ?? rootId;
          const materializedPath = `${parentPath}/${id}`;
          pathById.set(id, materializedPath);

          await tx.wbsNode.create({
            data: {
              id,
              projectId,
              controlPlanId: planId,
              parentId,
              code: node.code,
              sourceRow: node.sourceRow,
              sourceFileType: 'EXCEL',
              sourceFileHash: fileHash,
              sourceRawTitle: node.rawTitle,
              title: node.title,
              normalizedTitle: node.normalizedTitle,
              depth: node.depth,
              materializedPath,
              nodeType: node.nodeType,
              isSummary: node.isSummary,
              isMilestone: node.isMilestone,
              sortOrder: node.sortOrder,
              plannedStart: node.plannedStartJalali
                ? jalaliStringToDate(node.plannedStartJalali)
                : null,
              plannedFinish: node.plannedFinishJalali
                ? jalaliStringToDate(node.plannedFinishJalali)
                : null,
              periodPlanStart: node.periodPlanStart,
              periodPlanDuration: node.periodPlanDuration,
              periodActualStart: node.periodActualStart,
              periodActualDuration: node.periodActualDuration,
              percentComplete: node.percentComplete,
              budgetAmount: node.budgetAmount !== null ? node.budgetAmount : null,
              weightSource: WeightSource.NONE,
              ownerText: node.ownerText,
              definitionOfDone: node.definitionOfDone,
            },
          });
          created += 1;

          if (node.ownerText) {
            await tx.nodeAssignment.create({
              data: { nodeId: id, externalResourceName: node.ownerText.slice(0, 500), role: 'OWNER' },
            });
          }
        }

        if (importBatchId) {
          // به‌روزرسانی رکوردهای منبع با نود ساخته‌شده.
          await tx.importSourceRecord.deleteMany({ where: { importBatchId } });
          const nodeIdBySourceRow = new Map<number, string>();
          for (const node of plan.nodes) {
            if (node.sourceRow !== null) {
              nodeIdBySourceRow.set(node.sourceRow, idByTemp.get(node.tempId)!);
            }
          }
          if (parsed.rows.length > 0) {
            await tx.importSourceRecord.createMany({
              data: parsed.rows.map((row) => ({
                importBatchId,
                sourceRow: row.sourceRow,
                sourceUid: String(row.sourceRow),
                rawData: { rawTitle: row.rawTitle } as Prisma.InputJsonValue,
                normalizedData: { title: row.normalizedTitle } as Prisma.InputJsonValue,
                matchedNodeId: nodeIdBySourceRow.get(row.sourceRow) ?? null,
                matchStatus: ImportMatchStatus.AUTO_MATCHED,
              })),
            });
          }
          await tx.importBatch.update({
            where: { id: importBatchId },
            data: {
              controlPlanId: planId,
              status: ControlImportStatus.COMPLETED,
              totalRows: parsed.rows.length,
              importedRows: created,
              completedAt: new Date(),
            },
          });
        }

        return {
          importBatchId: importBatchId ?? '',
          controlPlanId: planId,
          createdNodes: created,
          updatedNodes: 0,
          status: 'COMPLETED' as const,
        };
      });
    } catch (error) {
      if (importBatchId) {
        await this.prisma.importBatch
          .update({ where: { id: importBatchId }, data: { status: ControlImportStatus.FAILED } })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  async list(projectId: string) {
    await this.requireProject(projectId);
    return this.prisma.importBatch.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        sourceType: true,
        status: true,
        fileHash: true,
        parserVersion: true,
        totalRows: true,
        importedRows: true,
        warningRows: true,
        failedRows: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async findOne(projectId: string, importBatchId: string) {
    const batch = await this.requireBatch(projectId, importBatchId);
    return {
      id: batch.id,
      sourceType: batch.sourceType,
      status: batch.status,
      fileHash: batch.fileHash,
      parserVersion: batch.parserVersion,
      totalRows: batch.totalRows,
      importedRows: batch.importedRows,
      warningRows: batch.warningRows,
      failedRows: batch.failedRows,
      validationReport: batch.validationReport,
      mappingReport: batch.mappingReport,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
    };
  }

  async errors(projectId: string, importBatchId: string): Promise<ImportIssue[]> {
    const batch = await this.requireBatch(projectId, importBatchId);
    const report = batch.validationReport as { issues?: ImportIssue[] } | null;
    return report?.issues ?? [];
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
    }
    return project;
  }

  private async getActivePlan(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { activeControlPlanId: true, projectControlEnabled: true },
    });
    if (!project?.projectControlEnabled || !project.activeControlPlanId) return null;
    return this.prisma.projectControlPlan.findFirst({
      where: { id: project.activeControlPlanId, projectId, isActive: true },
      select: { id: true },
    });
  }

  private async requireBatch(projectId: string, importBatchId: string) {
    const batch = await this.prisma.importBatch.findFirst({
      where: { id: importBatchId, projectId },
    });
    if (!batch) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'دستهٔ Import یافت نشد.',
      });
    }
    return batch;
  }
}
