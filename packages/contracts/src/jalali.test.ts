import { describe, expect, it } from 'vitest';
import {
  dateToJalaliString,
  isLeapJalaliYear,
  isValidJalaliDate,
  jalaliMonthLength,
  jalaliStringToDate,
  jalaliToGregorian,
  gregorianToJalali,
  parseMonthLabel,
} from './jalali';

describe('jalali conversion', () => {
  it('converts 1405/04/01 to gregorian correctly', () => {
    const g = jalaliToGregorian(1405, 4, 1);
    expect(g).toEqual({ gy: 2026, gm: 6, gd: 22 });
  });

  it('round-trips gregorian to jalali', () => {
    const j = gregorianToJalali(2026, 6, 22);
    expect(j).toEqual({ jy: 1405, jm: 4, jd: 1 });
  });

  it('parses jalali string to UTC date and back', () => {
    const d = jalaliStringToDate('1405/04/01');
    expect(dateToJalaliString(d)).toBe('1405/04/01');
  });

  it('accepts persian digits in string', () => {
    const d = jalaliStringToDate('۱۴۰۵/۰۴/۰۱');
    expect(dateToJalaliString(d)).toBe('1405/04/01');
  });

  it('validates month lengths', () => {
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 6)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
    expect(jalaliMonthLength(1405, 12)).toBe(isLeapJalaliYear(1405) ? 30 : 29);
  });

  it('accepts valid 1405/06/31', () => {
    expect(isValidJalaliDate(1405, 6, 31)).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isValidJalaliDate(1405, 13, 1)).toBe(false);
    expect(isValidJalaliDate(1405, 7, 31)).toBe(false);
    expect(() => jalaliStringToDate('1405/13/01')).toThrow();
  });

  it('parses month labels', () => {
    expect(parseMonthLabel('تیر (1405)')).toEqual({
      jalaliYear: 1405,
      jalaliMonth: 4,
      monthLabel: 'تیر (1405)',
    });
    expect(parseMonthLabel('اسفند (1405)')).toEqual({
      jalaliYear: 1405,
      jalaliMonth: 12,
      monthLabel: 'اسفند (1405)',
    });
    expect(parseMonthLabel('نامعتبر')).toBeNull();
  });
});
