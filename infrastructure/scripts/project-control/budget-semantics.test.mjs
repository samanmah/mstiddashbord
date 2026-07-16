import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EXPECTED_EXCEL_MANIFEST } from '../../../packages/contracts/dist/project-control-import.js';
import { FIXTURE_PROJECT_CREATE } from './select-staging-fixture-project.mjs';

describe('budget semantic contract', () => {
  it('keeps approved project budget distinct from imported package budget total', () => {
    // بودجه مصوب پروژه: میلیارد ریال (دادهٔ Project)
    assert.equal(typeof FIXTURE_PROJECT_CREATE.budgetBillionRial, 'number');
    assert.ok(FIXTURE_PROJECT_CREATE.budgetBillionRial > 0);

    // جمع بودجه بسته‌های Excel: تومان (Manifest)
    assert.equal(EXPECTED_EXCEL_MANIFEST.budgetTotal, 929_875_000_000);

    // عمداً یکی نیستند — نباید برای سبز شدن تست hardcode برابر شوند
    const approvedRial = FIXTURE_PROJECT_CREATE.budgetBillionRial * 1_000_000_000;
    assert.notEqual(approvedRial, EXPECTED_EXCEL_MANIFEST.budgetTotal);
  });
});
