import { describe, expect, it } from 'vitest';
import {
  computeDateRange,
  createScale,
  dateToX,
  generateTicks,
  isWeekend,
  jalaliToMs,
  rangeWidth,
  tickLabelFa,
  xToDate,
} from './gantt-scale';

const DAY = 24 * 60 * 60 * 1000;

describe('gantt-scale', () => {
  it('createScale computes total width from day span', () => {
    const min = 0;
    const max = 10 * DAY;
    const scale = createScale(min, max, 'day');
    expect(scale.totalWidth).toBe(Math.ceil(10 * 28));
  });

  it('dateToX and xToDate are inverse', () => {
    const scale = createScale(0, 30 * DAY, 'week');
    const ms = 12 * DAY;
    const x = dateToX(scale, ms);
    expect(Math.round(xToDate(scale, x))).toBe(ms);
  });

  it('rangeWidth is at least 1px', () => {
    const scale = createScale(0, 30 * DAY, 'month');
    expect(rangeWidth(scale, 0, 0)).toBeGreaterThanOrEqual(1);
  });

  it('jalaliToMs returns null for empty/invalid', () => {
    expect(jalaliToMs(null)).toBeNull();
    expect(jalaliToMs('')).toBeNull();
    expect(jalaliToMs('1405/04/25')).not.toBeNull();
  });

  it('computeDateRange ignores nulls and returns min/max', () => {
    const range = computeDateRange(['1405/01/01', null, '1405/06/31', '']);
    expect(range).not.toBeNull();
    expect(range!.minMs).toBeLessThan(range!.maxMs);
  });

  it('computeDateRange returns null when no valid dates', () => {
    expect(computeDateRange([null, ''])).toBeNull();
  });

  it('generateTicks produces ascending ticks', () => {
    const scale = createScale(0, 20 * DAY, 'week');
    const ticks = generateTicks(scale);
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]!.ms).toBeGreaterThan(ticks[i - 1]!.ms);
    }
  });

  it('tickLabelFa returns Persian-digit labels per zoom', () => {
    const ms = jalaliToMs('1405/04/25')!;
    expect(tickLabelFa(ms, 'day')).toMatch(/[۰-۹]/);
    expect(tickLabelFa(ms, 'quarter')).toMatch(/[۰-۹]/);
    // quarter label is a 4-digit year in Persian digits
    expect(tickLabelFa(ms, 'quarter').length).toBeGreaterThanOrEqual(4);
  });

  it('isWeekend detects Fridays (Gregorian getDay === 5)', () => {
    // 2024-01-05 (local) is a Friday; use local constructor to avoid TZ flakiness
    const friday = new Date(2024, 0, 5).getTime();
    const monday = new Date(2024, 0, 8).getTime();
    expect(isWeekend(friday)).toBe(true);
    expect(isWeekend(monday)).toBe(false);
  });
});
