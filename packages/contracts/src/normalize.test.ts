import { describe, expect, it } from 'vitest';
import {
  normalizeCellString,
  normalizeText,
  normalizeUsername,
  parseNumeric,
  sanitizeForSpreadsheet,
  toLatinDigits,
  toPersianDigits,
} from './normalize';

describe('normalize', () => {
  it('converts persian and arabic digits to latin', () => {
    expect(toLatinDigits('۱۲۳۴۵')).toBe('12345');
    expect(toLatinDigits('٠١٢٣٤')).toBe('01234');
  });

  it('converts latin to persian', () => {
    expect(toPersianDigits(35)).toBe('۳۵');
  });

  it('normalizes arabic ye/ke and zero-width', () => {
    expect(normalizeText('فعاليت\u200cها')).toBe('فعالیت ها');
  });

  it('normalizes username', () => {
    expect(normalizeUsername('  Editor۱ ')).toBe('editor1');
  });

  it('parses numeric with percent and separators', () => {
    expect(parseNumeric('۳۵٪')).toBe(35);
    expect(parseNumeric('10,000')).toBe(10000);
    expect(parseNumeric('-')).toBeNull();
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric(100)).toBe(100);
  });

  it('treats null tokens as null', () => {
    expect(normalizeCellString('None')).toBeNull();
    expect(normalizeCellString('-')).toBeNull();
    expect(normalizeCellString('—')).toBeNull();
    expect(normalizeCellString('–')).toBeNull();
    expect(normalizeCellString('  متن  ')).toBe('متن');
  });

  it('sanitizes spreadsheet formula injection', () => {
    expect(sanitizeForSpreadsheet('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sanitizeForSpreadsheet('+1')).toBe("'+1");
    expect(sanitizeForSpreadsheet('عادی')).toBe('عادی');
    expect(sanitizeForSpreadsheet(null)).toBe('');
  });
});
