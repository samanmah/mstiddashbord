import { EMPTY_PLACEHOLDER } from '@ppm/contracts';
import { describe, expect, it } from 'vitest';
import { faNumber, faPercent, isoToJalaliFa, orDash } from './utils';

describe('faNumber', () => {
  it('formats integers with Persian digits and thousands separator', () => {
    expect(faNumber(10000)).toBe('۱۰,۰۰۰');
  });

  it('returns placeholder for null/undefined/NaN', () => {
    expect(faNumber(null)).toBe(EMPTY_PLACEHOLDER);
    expect(faNumber(undefined)).toBe(EMPTY_PLACEHOLDER);
    expect(faNumber(Number.NaN)).toBe(EMPTY_PLACEHOLDER);
  });
});

describe('faPercent', () => {
  it('appends the percent sign with Persian digits', () => {
    expect(faPercent(35)).toBe('۳۵٪');
    expect(faPercent(100)).toBe('۱۰۰٪');
  });

  it('returns placeholder for empty values', () => {
    expect(faPercent(null)).toBe(EMPTY_PLACEHOLDER);
  });
});

describe('orDash', () => {
  it('returns the dash placeholder for empty strings', () => {
    expect(orDash('')).toBe(EMPTY_PLACEHOLDER);
    expect(orDash('   ')).toBe(EMPTY_PLACEHOLDER);
    expect(orDash(null)).toBe(EMPTY_PLACEHOLDER);
  });

  it('returns the value when present', () => {
    expect(orDash('MSTID')).toBe('MSTID');
  });
});

describe('isoToJalaliFa', () => {
  it('converts an ISO date to a Jalali string with Persian digits', () => {
    // 2026-06-22 ≈ 1405/04/01
    const result = isoToJalaliFa('2026-06-22T12:00:00.000Z');
    expect(result).toContain('۱۴۰۵');
  });

  it('returns placeholder for empty input', () => {
    expect(isoToJalaliFa(null)).toBe(EMPTY_PLACEHOLDER);
  });
});
