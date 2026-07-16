import { EXPECTED_EXCEL_MANIFEST, type ExcelManifest } from '@ppm/contracts';
import { compareManifest, manifestIsValid } from './manifest-validator';

describe('manifest-validator', () => {
  it('Manifest منطبق کاملاً معتبر است', () => {
    const checks = compareManifest(EXPECTED_EXCEL_MANIFEST);
    expect(manifestIsValid(checks)).toBe(true);
  });

  it('عدم تطابق تعداد فاز را CRITICAL می‌کند', () => {
    const bad: ExcelManifest = { ...EXPECTED_EXCEL_MANIFEST, phaseCount: 6 };
    const checks = compareManifest(bad);
    expect(manifestIsValid(checks)).toBe(false);
    const phaseCheck = checks.find((c) => c.key === 'phaseCount');
    expect(phaseCheck?.ok).toBe(false);
    expect(phaseCheck?.actual).toBe('6');
  });

  it('عدم تطابق جمع بودجه شناسایی می‌شود', () => {
    const bad: ExcelManifest = { ...EXPECTED_EXCEL_MANIFEST, budgetTotal: 1 };
    const checks = compareManifest(bad);
    expect(checks.find((c) => c.key === 'budgetTotal')?.ok).toBe(false);
  });

  it('perPhaseCounts به‌صورت رشته مقایسه می‌شود', () => {
    const bad: ExcelManifest = {
      ...EXPECTED_EXCEL_MANIFEST,
      perPhaseCounts: [13, 18, 12, 13, 64, 10, 11],
    };
    expect(manifestIsValid(compareManifest(bad))).toBe(false);
  });
});
