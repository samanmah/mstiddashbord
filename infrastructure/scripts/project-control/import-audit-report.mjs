#!/usr/bin/env node
/**
 * Import Audit Report — مقایسه Preview vs Commit برای Excel واقعی.
 * فایل خام پروژه در Repository Commit نمی‌شود؛ مسیر فایل به‌صورت آرگومان/ENV داده می‌شود.
 *
 * Usage:
 *   node import-audit-report.mjs \
 *     --preview artifacts/project-control/import-preview.json \
 *     --commit artifacts/project-control/import-commit.json \
 *     --out artifacts/project-control/import-audit-report.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const previewPath = arg('--preview', process.env.IMPORT_PREVIEW_JSON);
const commitPath = arg('--commit', process.env.IMPORT_COMMIT_JSON);
const outPath =
  arg('--out', process.env.IMPORT_AUDIT_OUT) ??
  'artifacts/project-control/import-audit-report.json';

if (!previewPath || !commitPath) {
  console.error('Need --preview and --commit JSON paths (from secure upload workflow).');
  process.exit(2);
}

const preview = JSON.parse(readFileSync(previewPath, 'utf8'));
const commit = JSON.parse(readFileSync(commitPath, 'utf8'));

const before = {
  phases: preview?.counts?.phases ?? null,
  break1: preview?.counts?.break1 ?? null,
  tasks: preview?.counts?.tasks ?? null,
  totalNodes: preview?.counts?.totalNodes ?? null,
  manifestValid: preview?.manifestValid ?? null,
  canCommit: preview?.canCommit ?? null,
  criticalCount: preview?.criticalCount ?? null,
  fileHash: preview?.fileHash ?? null,
  manifest: preview?.manifest ?? null,
};

const after = {
  importBatchId: commit?.importBatchId ?? null,
  controlPlanId: commit?.controlPlanId ?? null,
  createdNodes: commit?.createdNodes ?? null,
  updatedNodes: commit?.updatedNodes ?? null,
  status: commit?.status ?? null,
  dbNodeCount: commit?.dbNodeCount ?? null,
  dbNodeCountIncludingRoot: commit?.dbNodeCountIncludingRoot ?? null,
  weightSum: commit?.weightSum ?? null,
  budgetSum: commit?.budgetSum ?? null,
};

const expectedDbNodes =
  typeof before.totalNodes === 'number' ? before.totalNodes + 1 : null; // + Root Project

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
}

check(
  'commit_status_completed',
  after.status === 'COMPLETED',
  `status=${after.status}`,
);
check(
  'db_nodes_equals_preview_plus_root',
  expectedDbNodes === null ||
    after.dbNodeCountIncludingRoot === expectedDbNodes ||
    after.dbNodeCount === before.totalNodes,
  `preview.totalNodes=${before.totalNodes} expectedWithRoot=${expectedDbNodes} db=${after.dbNodeCountIncludingRoot ?? after.dbNodeCount}`,
);
check('manifest_valid_before_commit', before.manifestValid === true, null);
check('can_commit_true', before.canCommit === true, null);
check('no_critical_issues', (before.criticalCount ?? 0) === 0, `critical=${before.criticalCount}`);

const failed = checks.filter((c) => !c.ok);
const report = {
  generatedAt: new Date().toISOString(),
  source: 'excel-import-audit',
  note: 'فایل واقعی Excel در Repository Commit نمی‌شود؛ فقط از Upload امن پس از Deploy.',
  beforeCommit: before,
  afterCommit: after,
  checks,
  passed: failed.length === 0,
  failedCount: failed.length,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Import audit report written: ${outPath}`);
console.log(`passed=${report.passed} failed=${report.failedCount}`);
if (!report.passed) process.exit(1);
