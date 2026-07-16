import { ControlImportStatus, type ParsedExcelWorkbook } from '@ppm/contracts';
import { ControlImportService } from './control-import.service';

function emptyParsed(): ParsedExcelWorkbook {
  return {
    fileHash: 'hash',
    parserVersion: 'excel-gantt-1.0.0',
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
    issues: [],
  };
}

describe('ControlImportService — Rollback', () => {
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
