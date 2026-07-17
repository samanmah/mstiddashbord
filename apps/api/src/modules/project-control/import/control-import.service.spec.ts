import {
  ControlImportStatus,
  ImportCommitMode,
  type ParsedExcelWorkbook,
} from '@ppm/contracts';
import { emptyPeriodMatrixStats } from './period-matrix';
import { ControlImportService } from './control-import.service';

function emptyParsed(overrides: Partial<ParsedExcelWorkbook> = {}): ParsedExcelWorkbook {
  return {
    fileHash: 'hash',
    parserVersion: 'excel-gantt-1.2.0',
    manifest: {
      phaseCount: 1,
      break1Count: 1,
      sourceRowCount: 1,
      perPhaseCounts: [1],
      periodCount: 0,
      totalDays: null,
      totalMonths: null,
      budgetRowCount: 0,
      budgetTotal: 0,
      ownerCount: 0,
      dodCount: 0,
      progressCount: 0,
      startNonEmpty: 0,
      startValid: 0,
      finishNonEmpty: 0,
      finishValid: 0,
      dateMin: null,
      dateMax: null,
    },
    rows: [
      {
        sourceRow: 5,
        phaseCode: '1',
        phaseTitle: 'فاز 1',
        break1Code: '1-1',
        break1Title: 'شکست',
        rawTitle: 'فعالیت',
        normalizedTitle: 'فعالیت',
        indent: 0,
        outlineLevel: 0,
        plannedStartJalali: null,
        plannedFinishJalali: null,
        startProvided: false,
        finishProvided: false,
        plannedStartValid: false,
        plannedFinishValid: false,
        budgetAmount: null,
        ownerText: null,
        definitionOfDone: null,
        periodPlanStart: null,
        periodPlanDuration: null,
        periodActualStart: null,
        periodActualDuration: null,
        percentComplete: null,
      },
    ],
    periodColumns: [],
    periodValues: [],
    periodMatrixStats: emptyPeriodMatrixStats(),
    issues: [],
    ...overrides,
  };
}

describe('ControlImportService — Rollback Transaction', () => {
  it('در صورت خطای Transaction، Batch را FAILED می‌کند و خطا را منتشر می‌کند', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(new Error('boom')),
      importBatch: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new ControlImportService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.commitParsed('project-id', 'batch-id', emptyParsed(), 'hash', { userId: null }),
    ).rejects.toThrow('boom');

    expect(prisma.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch-id' },
        data: { status: ControlImportStatus.FAILED },
      }),
    );
  });

  it('بدون importBatchId، خطا بدون تلاش برای update منتشر می‌شود', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(new Error('boom2')),
      importBatch: { update: jest.fn() },
    };
    const service = new ControlImportService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.commitParsed('project-id', null, emptyParsed(), 'hash', { userId: null }),
    ).rejects.toThrow('boom2');
    expect(prisma.importBatch.update).not.toHaveBeenCalled();
  });
});

describe('ControlImportService — Idempotency / Reuse', () => {
  it('REUSE_EXISTING بدون ساخت Plan جدید برمی‌گردد', async () => {
    const existingPlanId = 'plan-existing';
    const prisma = {
      importBatch: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'batch-new',
            projectId: 'project-id',
            originalFilename: 'file.xlsx::stored',
            fileHash: 'abc123',
            status: ControlImportStatus.VALIDATED,
          })
          .mockResolvedValueOnce({
            id: 'old-batch',
            controlPlanId: existingPlanId,
            completedAt: new Date('2026-01-01'),
            controlPlan: { version: 3 },
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      project: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const service = new ControlImportService(
      prisma as never,
      {} as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      { get: () => ({ upload: { dir: '/tmp' } }) } as never,
    );

    const proto = Object.getPrototypeOf(service) as {
      readStoredFile: (name: string) => Promise<Buffer>;
      sha256: (buf: Buffer) => string;
    };
    jest.spyOn(proto, 'readStoredFile').mockResolvedValue(Buffer.from('x'));
    jest.spyOn(proto, 'sha256').mockReturnValue('abc123');

    const result = await service.commit(
      'project-id',
      'batch-new',
      true,
      { userId: 'u1' },
      ImportCommitMode.REUSE_EXISTING,
    );

    expect(result.reusedExisting).toBe(true);
    expect(result.status).toBe('REUSED');
    expect(result.controlPlanId).toBe(existingPlanId);
    expect(result.activePlanSwitched).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
