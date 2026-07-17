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
  ImportCommitMode,
  type ImportIssue,
  ImportIssueCode,
  ImportIssueLevel,
  ImportMatchStatus,
  jalaliStringToDate,
  type ParsedExcelWorkbook,
  PeriodValueType,
  WbsNodeType,
  WeightSource,
} from '@ppm/contracts';
import { emptyPeriodMatrixStats } from './period-matrix';
import {
  GanttDerivationMethod,
  GanttSpanType,
  PeriodAxisType,
  type Prisma,
} from '@prisma/client';
import { countDerivedBarCells } from './gantt-cf-evaluator';
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
    const planMeta = await this.getPlanVersionMeta(projectId);
    const existingCommitted = await this.findExistingCommittedImport(projectId, parsed.fileHash);

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
      periodMatrixStats: parsed.periodMatrixStats ?? emptyPeriodMatrixStats(),
      currentPlanVersion: planMeta.currentVersion,
      nextPlanVersion: planMeta.nextVersion,
      existingCommittedImport: existingCommitted,
      suggestedCommitMode: existingCommitted
        ? ImportCommitMode.REUSE_EXISTING
        : ImportCommitMode.CREATE_NEW_VERSION,
    };
  }

  private async getPlanVersionMeta(
    projectId: string,
  ): Promise<{ currentVersion: number | null; nextVersion: number }> {
    const active = await this.prisma.projectControlPlan.findFirst({
      where: { projectId, isActive: true },
      select: { version: true },
      orderBy: { version: 'desc' },
    });
    const max = await this.prisma.projectControlPlan.findFirst({
      where: { projectId },
      select: { version: true },
      orderBy: { version: 'desc' },
    });
    const currentVersion = active?.version ?? null;
    const nextVersion = (max?.version ?? 0) + 1;
    return { currentVersion, nextVersion };
  }

  private async findExistingCommittedImport(
    projectId: string,
    fileHash: string,
  ): Promise<ControlImportPreview['existingCommittedImport']> {
    const batch = await this.prisma.importBatch.findFirst({
      where: {
        projectId,
        fileHash,
        status: ControlImportStatus.COMPLETED,
        controlPlanId: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        controlPlanId: true,
        completedAt: true,
        controlPlan: { select: { version: true } },
      },
    });
    if (!batch?.controlPlanId || !batch.controlPlan) return null;
    return {
      importBatchId: batch.id,
      controlPlanId: batch.controlPlanId,
      planVersion: batch.controlPlan.version,
      completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
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
    mode?: ImportCommitMode,
  ): Promise<ControlImportCommitResult> {
    const started = Date.now();
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

    const existing = await this.findExistingCommittedImport(projectId, fileHash);
    const resolvedMode =
      mode ??
      (existing ? ImportCommitMode.REUSE_EXISTING : ImportCommitMode.CREATE_NEW_VERSION);

    if (resolvedMode === ImportCommitMode.REUSE_EXISTING) {
      if (!existing) {
        throw new BadRequestException({
          code: ErrorCode.IMPORT_ERROR,
          message: 'نسخهٔ Commit‌شده‌ای با این fileHash یافت نشد.',
        });
      }
      await this.prisma.importBatch.update({
        where: { id: importBatchId },
        data: {
          status: ControlImportStatus.COMPLETED,
          controlPlanId: existing.controlPlanId,
          completedAt: new Date(),
          importedRows: 0,
        },
      });
      const [periodDefinitionsPersisted, ganttSpansCreated, snapshotCount] =
        await Promise.all([
          this.prisma.controlPeriodColumn.count({
            where: { controlPlanId: existing.controlPlanId },
          }),
          this.prisma.nodeGanttSpan.count({
            where: { controlPlanId: existing.controlPlanId },
          }),
          this.prisma.nodePeriodSnapshot.count({
            where: { controlPlanId: existing.controlPlanId },
          }),
        ]);
      const existingSpans = await this.prisma.nodeGanttSpan.findMany({
        where: { controlPlanId: existing.controlPlanId },
        select: {
          sourceRow: true,
          spanType: true,
          startPeriodIndex: true,
          endPeriodIndex: true,
          progressEndPeriodIndex: true,
          derivationMethod: true,
        },
      });
      const result: ControlImportCommitResult = {
        importBatchId,
        controlPlanId: existing.controlPlanId,
        previousControlPlanId: existing.controlPlanId,
        createdNodes: 0,
        updatedNodes: 0,
        periodSnapshotsCreated: snapshotCount,
        periodDefinitionsPersisted,
        ganttSpansCreated,
        derivedBarCellCountFromPersistedSpans: countDerivedBarCells(
          existingSpans.map((s) => ({
            sourceRow: s.sourceRow ?? 0,
            spanType: s.spanType,
            startPeriodIndex: s.startPeriodIndex,
            endPeriodIndex: s.endPeriodIndex,
            progressEndPeriodIndex: s.progressEndPeriodIndex,
            derivationMethod: s.derivationMethod,
          })),
        ),
        assignmentsCreated: 0,
        dependenciesCreated: 0,
        newPlanVersion: existing.planVersion,
        previousPlanVersion: existing.planVersion,
        activePlanSwitched: false,
        rollbackAvailable: true,
        reusedExisting: true,
        fileHash,
        durationMs: Date.now() - started,
        status: 'REUSED',
      };
      await this.audit.record({
        ...ctx,
        projectId,
        entityType: 'ImportBatch',
        entityId: importBatchId,
        action: AuditAction.IMPORT,
        newValue: { reused: true, controlPlanId: existing.controlPlanId },
      });
      return result;
    }

    const parsed = await this.excelParser.parse(buffer);
    const preview = await this.buildPreview(projectId, importBatchId, parsed, false);
    this.assertCommittable(preview, allowWarnings);

    const result = await this.commitParsed(projectId, importBatchId, parsed, fileHash, ctx);
    result.durationMs = Date.now() - started;

    await this.audit.record({
      ...ctx,
      projectId,
      entityType: 'ImportBatch',
      entityId: importBatchId,
      action: AuditAction.IMPORT,
      newValue: {
        createdNodes: result.createdNodes,
        controlPlanId: result.controlPlanId,
        periodSnapshotsCreated: result.periodSnapshotsCreated,
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

  /**
   * ثبت اتمیک نسخه‌دار:
   * Plan جدید + Root + 173 نود + Period snapshots → سپس Switch فعال.
   * Plan قبلی تا پایان Transaction دست‌نخورده می‌ماند.
   */
  async commitParsed(
    projectId: string,
    importBatchId: string | null,
    parsed: ParsedExcelWorkbook,
    fileHash: string,
    ctx: AuditContext,
  ): Promise<ControlImportCommitResult> {
    if (importBatchId) {
      await this.prisma.importBatch.update({
        where: { id: importBatchId },
        data: { status: ControlImportStatus.COMMITTING },
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findUnique({
          where: { id: projectId },
          select: {
            id: true,
            titleFa: true,
            projectControlEnabled: true,
            activeControlPlanId: true,
          },
        });
        if (!project) {
          throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
        }

        const previousPlanId = project.activeControlPlanId;
        let previousPlanVersion: number | null = null;
        if (previousPlanId) {
          const prev = await tx.projectControlPlan.findUnique({
            where: { id: previousPlanId },
            select: { version: true, isActive: true },
          });
          previousPlanVersion = prev?.version ?? null;
        }

        const maxPlan = await tx.projectControlPlan.findFirst({
          where: { projectId },
          select: { version: true },
          orderBy: { version: 'desc' },
        });
        const newVersion = (maxPlan?.version ?? 0) + 1;

        // Plan جدید غیرفعال تا پایان موفقیت
        const newPlan = await tx.projectControlPlan.create({
          data: {
            projectId,
            title: `برنامهٔ کنترل v${newVersion} — ${project.titleFa}`,
            statusDate: new Date(),
            currency: 'TOMAN',
            isActive: false,
            version: newVersion,
            periodCount: parsed.periodMatrixStats.periodColumnCount || parsed.manifest.periodCount,
            totalDurationDays: parsed.manifest.totalDays,
            totalDurationMonths: parsed.manifest.totalMonths,
            createdByUserId: ctx.userId ?? null,
            updatedByUserId: ctx.userId ?? null,
          },
        });
        const planId = newPlan.id;
        const rootId = randomUUID();
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
            sourceFileHash: fileHash,
            sourceFileType: 'EXCEL',
          },
        });

        let periodDefinitionsPersisted = 0;
        if (parsed.periodColumns.length > 0) {
          await tx.controlPeriodColumn.createMany({
            data: parsed.periodColumns.map((c) => ({
              projectId,
              controlPlanId: planId,
              columnIndex: c.columnIndex,
              columnLetter: c.columnLetter,
              periodIndex: c.periodIndex,
              periodLabel: c.periodLabel,
              periodGroup: c.periodGroup,
              valueType: c.valueType as PeriodValueType,
              axisType: (c.axisType as PeriodAxisType) ?? PeriodAxisType.ORDINAL,
              calendarStart: null,
              calendarEnd: null,
            })),
          });
          periodDefinitionsPersisted = parsed.periodColumns.length;
        }

        const tree = buildWbsTree(parsed.rows, rootId);
        if (tree.nodes.length !== parsed.rows.length + tree.phaseCount + tree.break1Count) {
          // ساختار باید پایدار باشد؛ orphan بعداً چک می‌شود
        }

        const idByTemp = new Map<string, string>([['root', rootId]]);
        idByTemp.set(rootId, rootId);
        const pathById = new Map<string, string>([[rootId, rootId]]);
        const nodeIdBySourceRow = new Map<number, string>();

        let created = 0;
        let assignmentsCreated = 0;
        for (const node of tree.nodes) {
          const id = randomUUID();
          idByTemp.set(node.tempId, id);
          const parentTemp = node.parentTempId ?? 'root';
          const parentId = idByTemp.get(parentTemp);
          if (!parentId) {
            throw new BadRequestException({
              code: ErrorCode.IMPORT_ERROR,
              message: `والد نامعتبر برای نود «${node.title}».`,
            });
          }
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
          if (node.sourceRow !== null) nodeIdBySourceRow.set(node.sourceRow, id);

          if (node.ownerText) {
            await tx.nodeAssignment.create({
              data: {
                nodeId: id,
                externalResourceName: node.ownerText.slice(0, 500),
                role: 'OWNER',
              },
            });
            assignmentsCreated += 1;
          }
        }

        // Integrity: همه parentها داخل همین Plan
        const orphanParents = await tx.wbsNode.count({
          where: {
            controlPlanId: planId,
            parentId: { not: null },
            parent: { controlPlanId: { not: planId } },
          },
        });
        if (orphanParents > 0) {
          throw new BadRequestException({
            code: ErrorCode.IMPORT_ERROR,
            message: 'یکپارچگی Parent بین Planها نقض شد.',
          });
        }

        const nodesWithRoot = await tx.wbsNode.count({
          where: { controlPlanId: planId, deletedAt: null },
        });
        if (nodesWithRoot !== created + 1) {
          throw new BadRequestException({
            code: ErrorCode.IMPORT_ERROR,
            message: `تعداد نودها نامعتبر است: ${nodesWithRoot}`,
          });
        }

        // Period snapshots
        let periodSnapshotsCreated = 0;
        if (parsed.periodValues.length > 0) {
          const snapshotData = [];
          for (const pv of parsed.periodValues) {
            const nodeId = nodeIdBySourceRow.get(pv.sourceRow);
            if (!nodeId) continue;
            const plannedValue =
              pv.valueType === 'PLANNED' ? pv.normalizedValue : null;
            const actualValue = pv.valueType === 'ACTUAL' ? pv.normalizedValue : null;
            snapshotData.push({
              projectId,
              controlPlanId: planId,
              nodeId,
              importBatchId: importBatchId ?? null,
              periodIndex: pv.periodIndex,
              periodLabel: pv.periodLabel,
              valueType: pv.valueType as PeriodValueType,
              plannedValue,
              actualValue,
              normalizedValue: pv.normalizedValue,
              sourceRow: pv.sourceRow,
              sourceColumn: pv.sourceColumn,
              zeroIsExplicit: pv.zeroIsExplicit,
              rawValue: pv.rawValue,
              formula: pv.formula,
            });
          }
          if (snapshotData.length > 0) {
            // createMany در chunk برای جلوگیری از محدودیت پارامتر
            const chunk = 500;
            for (let i = 0; i < snapshotData.length; i += chunk) {
              const part = snapshotData.slice(i, i + chunk);
              await tx.nodePeriodSnapshot.createMany({ data: part });
              periodSnapshotsCreated += part.length;
            }
          }
        }

        if (periodSnapshotsCreated !== parsed.periodMatrixStats.periodSnapshotsParsed) {
          // فقط وقتی همه sourceRowها به نود map شده باشند؛ در غیر این صورت mismatch بحرانی
          if (parsed.periodMatrixStats.periodSnapshotsParsed > 0) {
            const mapped = parsed.periodValues.filter((pv) =>
              nodeIdBySourceRow.has(pv.sourceRow),
            ).length;
            if (periodSnapshotsCreated !== mapped) {
              throw new BadRequestException({
                code: ErrorCode.IMPORT_ERROR,
                message: 'تعداد Period Snapshot Persist‌شده با منبع برابر نیست.',
              });
            }
          }
        }

        // NodeGanttSpan — بازه‌ها نه سلول‌های رنگی
        let ganttSpansCreated = 0;
        const spanPayload = [];
        for (const span of parsed.ganttSpans ?? []) {
          const nodeId = nodeIdBySourceRow.get(span.sourceRow);
          if (!nodeId) continue;
          if (span.endPeriodIndex < span.startPeriodIndex) {
            throw new BadRequestException({
              code: ErrorCode.IMPORT_ERROR,
              message: `بازهٔ گانت معکوس در سطر ${span.sourceRow}.`,
            });
          }
          spanPayload.push({
            projectId,
            controlPlanId: planId,
            nodeId,
            spanType: span.spanType as GanttSpanType,
            startPeriodIndex: span.startPeriodIndex,
            endPeriodIndex: span.endPeriodIndex,
            progressEndPeriodIndex: span.progressEndPeriodIndex,
            sourceRow: span.sourceRow,
            derivationMethod: span.derivationMethod as GanttDerivationMethod,
          });
        }
        if (spanPayload.length > 0) {
          const chunk = 500;
          for (let i = 0; i < spanPayload.length; i += chunk) {
            const part = spanPayload.slice(i, i + chunk);
            await tx.nodeGanttSpan.createMany({ data: part });
            ganttSpansCreated += part.length;
          }
        }
        const derivedBarCellCountFromPersistedSpans = countDerivedBarCells(
          (parsed.ganttSpans ?? []).filter((s) => nodeIdBySourceRow.has(s.sourceRow)),
        );
        if (
          parsed.periodMatrixStats.timelineClassification === 'STYLE_BASED_GANTT' &&
          parsed.periodMatrixStats.derivedBarCellCount > 0 &&
          derivedBarCellCountFromPersistedSpans !==
            parsed.periodMatrixStats.derivedBarCellCount
        ) {
          throw new BadRequestException({
            code: ErrorCode.IMPORT_ERROR,
            message: 'derivedBarCellCount از Spanهای Persist‌شده با Parse برابر نیست.',
          });
        }

        // Pre-activation integrity for style/period timeline
        const nodesWithoutRoot = await tx.wbsNode.count({
          where: { controlPlanId: planId, deletedAt: null, nodeType: { not: WbsNodeType.PROJECT } },
        });
        if (nodesWithoutRoot !== created) {
          throw new BadRequestException({
            code: ErrorCode.IMPORT_ERROR,
            message: `تعداد نود بدون Root نامعتبر است: ${nodesWithoutRoot}`,
          });
        }

        // فعال‌سازی اتمیک در انتهای موفقیت
        if (previousPlanId) {
          await tx.projectControlPlan.update({
            where: { id: previousPlanId },
            data: { isActive: false, updatedByUserId: ctx.userId ?? null },
          });
        }
        await tx.projectControlPlan.update({
          where: { id: planId },
          data: { isActive: true, updatedByUserId: ctx.userId ?? null },
        });
        await tx.project.update({
          where: { id: projectId },
          data: {
            projectControlEnabled: true,
            activeControlPlanId: planId,
            controlCurrency: 'TOMAN',
            controlVersion: newVersion,
          },
        });

        if (importBatchId) {
          await tx.importSourceRecord.deleteMany({ where: { importBatchId } });
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
              validationReport: {
                periodSnapshotsCreated,
                periodColumnCount: parsed.periodMatrixStats.periodColumnCount,
                periodDefinitionsPersisted,
                ganttSpansCreated,
                derivedBarCellCountFromPersistedSpans,
                timelineClassification: parsed.periodMatrixStats.timelineClassification,
                conditionalFormattingRuleCount:
                  parsed.periodMatrixStats.conditionalFormattingRuleCount,
                nodesWithRoot,
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }

        return {
          importBatchId: importBatchId ?? '',
          controlPlanId: planId,
          previousControlPlanId: previousPlanId,
          createdNodes: created,
          updatedNodes: 0,
          periodSnapshotsCreated,
          periodDefinitionsPersisted,
          ganttSpansCreated,
          derivedBarCellCountFromPersistedSpans,
          assignmentsCreated,
          dependenciesCreated: 0,
          newPlanVersion: newVersion,
          previousPlanVersion,
          activePlanSwitched: true,
          rollbackAvailable: previousPlanId !== null,
          reusedExisting: false,
          fileHash,
          durationMs: 0,
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
