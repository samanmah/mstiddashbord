/**
 * خروجی Machine-readable و Parse آرگومان‌های CLI Import (Pure — تست‌پذیر بدون Nest).
 */
import type { ControlImportPreview, ImportPreviewReportJson } from '@ppm/contracts';

export interface ImportCliFlags {
  projectId: string | null;
  excelPath: string | null;
  mppPath: string | null;
  doCommit: boolean;
  allowWarnings: boolean;
  strictFixtureManifest: boolean;
  reportJson: boolean;
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

export function getFlag(argv: string[], name: string): string | null {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  const next = argv[idx + 1];
  if (!next || next.startsWith('--')) return '';
  return next;
}

export function parseImportCliFlags(argv: string[] = process.argv): ImportCliFlags {
  const doCommit = hasFlag(argv, 'commit');
  return {
    projectId: getFlag(argv, 'project-id'),
    excelPath: getFlag(argv, 'excel'),
    mppPath: getFlag(argv, 'mpp'),
    doCommit,
    allowWarnings: hasFlag(argv, 'allow-warnings') || doCommit,
    strictFixtureManifest: hasFlag(argv, 'strict-fixture-manifest'),
    reportJson: hasFlag(argv, 'report-json'),
  };
}

export function buildImportPreviewReport(preview: ControlImportPreview): ImportPreviewReportJson {
  return {
    canCommit: preview.canCommit,
    criticalCount: preview.criticalCount,
    warningCount: preview.warningCount,
    strictFixtureManifest: preview.strictFixtureManifest,
    counts: { ...preview.counts },
    manifest: {
      phaseCount: preview.manifest.phaseCount,
      break1Count: preview.manifest.break1Count,
      sourceRowCount: preview.manifest.sourceRowCount,
      periodCount: preview.manifest.periodCount,
      budgetTotal: preview.manifest.budgetTotal,
      dateMin: preview.manifest.dateMin,
      dateMax: preview.manifest.dateMax,
    },
    orphanCount: preview.orphanCount,
    manifestCheckKeys: preview.manifestChecks.map((c) => c.key),
  };
}

/** کلیدهای الزامی Strict Fixture برای Smoke. */
export const STRICT_FIXTURE_MANIFEST_KEYS = [
  'phaseCount',
  'break1Count',
  'sourceRowCount',
  'periodCount',
  'budgetTotal',
  'dateMin',
  'dateMax',
] as const;

export function assertStrictFixtureReport(report: ImportPreviewReportJson): string | null {
  if (!report.strictFixtureManifest) {
    return 'Strict fixture manifest was not produced';
  }
  for (const key of STRICT_FIXTURE_MANIFEST_KEYS) {
    if (!report.manifestCheckKeys.includes(key)) {
      return `Strict fixture manifest was not produced (missing check key: ${key})`;
    }
  }
  return null;
}
