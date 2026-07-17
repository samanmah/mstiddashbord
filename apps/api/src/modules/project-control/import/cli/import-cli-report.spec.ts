import type { ControlImportPreview } from '@ppm/contracts';
import {
  assertStrictFixtureReport,
  buildImportPreviewReport,
  parseImportCliFlags,
} from './import-cli-report';

function previewBase(
  overrides: Partial<ControlImportPreview> = {},
): ControlImportPreview {
  return {
    importBatchId: 'b',
    sourceType: 'EXCEL',
    fileHash: 'h',
    parserVersion: 'excel-gantt-1.1.0',
    dryRun: true,
    manifest: {
      phaseCount: 7,
      break1Count: 24,
      sourceRowCount: 142,
      perPhaseCounts: [13, 18, 12, 13, 65, 10, 11],
      periodCount: 147,
      totalDays: 620,
      totalMonths: 21,
      budgetRowCount: 6,
      budgetTotal: 929_875_000_000,
      ownerCount: 65,
      dodCount: 48,
      progressCount: 104,
      startNonEmpty: 60,
      startValid: 60,
      finishNonEmpty: 60,
      finishValid: 60,
      dateMin: '1404/09/01',
      dateMax: '1406/12/10',
    },
    manifestChecks: [
      { key: 'sourceRowCount', expected: '>0', actual: '142', ok: true },
      { key: 'phaseCount', expected: '>0', actual: '7', ok: true },
    ],
    manifestValid: true,
    strictFixtureManifest: false,
    counts: { phases: 7, break1: 24, tasks: 142, totalNodes: 173 },
    orphanCount: 0,
    conflicts: [],
    issues: [],
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    canCommit: true,
    ...overrides,
  };
}

describe('import-cli-report', () => {
  it('بدون Strict فقط Structural را Parse می‌کند', () => {
    const flags = parseImportCliFlags([
      'node',
      'cli',
      '--project-id',
      'p',
      '--excel',
      'f.xlsx',
      '--dry-run',
    ]);
    expect(flags.strictFixtureManifest).toBe(false);
    expect(flags.reportJson).toBe(false);
  });

  it('با --strict-fixture-manifest فلگ را فعال می‌کند', () => {
    const flags = parseImportCliFlags([
      'node',
      'cli',
      '--project-id',
      'p',
      '--excel',
      'f.xlsx',
      '--dry-run',
      '--strict-fixture-manifest',
      '--report-json',
    ]);
    expect(flags.strictFixtureManifest).toBe(true);
    expect(flags.reportJson).toBe(true);
  });

  it('Smoke بدون Strict output پیام روشن می‌دهد', () => {
    const report = buildImportPreviewReport(previewBase());
    expect(assertStrictFixtureReport(report)).toBe(
      'Strict fixture manifest was not produced',
    );
  });

  it('Smoke با Strict صحیح PASS می‌شود', () => {
    const report = buildImportPreviewReport(
      previewBase({
        strictFixtureManifest: true,
        manifestChecks: [
          { key: 'phaseCount', expected: '7', actual: '7', ok: true },
          { key: 'break1Count', expected: '24', actual: '24', ok: true },
          { key: 'sourceRowCount', expected: '142', actual: '142', ok: true },
          { key: 'periodCount', expected: '147', actual: '147', ok: true },
          { key: 'budgetTotal', expected: '929875000000', actual: '929875000000', ok: true },
          { key: 'dateMin', expected: '1404/09/01', actual: '1404/09/01', ok: true },
          { key: 'dateMax', expected: '1406/12/10', actual: '1406/12/10', ok: true },
        ],
      }),
    );
    expect(assertStrictFixtureReport(report)).toBeNull();
    expect(report.manifest.break1Count).toBe(24);
  });

  it('break1Count اشتباه در گزارش منعکس می‌شود', () => {
    const report = buildImportPreviewReport(
      previewBase({
        strictFixtureManifest: true,
        manifest: {
          ...previewBase().manifest,
          break1Count: 1,
        },
        manifestChecks: [
          { key: 'break1Count', expected: '24', actual: '1', ok: false },
          { key: 'phaseCount', expected: '7', actual: '7', ok: true },
          { key: 'sourceRowCount', expected: '142', actual: '142', ok: true },
          { key: 'periodCount', expected: '147', actual: '147', ok: true },
          { key: 'budgetTotal', expected: '929875000000', actual: '929875000000', ok: true },
          { key: 'dateMin', expected: '1404/09/01', actual: '1404/09/01', ok: true },
          { key: 'dateMax', expected: '1406/12/10', actual: '1406/12/10', ok: true },
        ],
      }),
    );
    expect(assertStrictFixtureReport(report)).toBeNull();
    expect(report.manifest.break1Count).toBe(1);
  });
});
