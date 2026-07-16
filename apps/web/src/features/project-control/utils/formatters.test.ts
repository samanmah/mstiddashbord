import { EMPTY_PLACEHOLDER } from '@ppm/contracts';
import { describe, expect, it } from 'vitest';
import { ControlNodeStatus } from '../api/project-control-types';
import {
  dataQualityIssueCount,
  indexTone,
  statusLabel,
  statusTone,
  varianceTone,
} from './control-status';
import { daysToMinutes, formatLagFa, lagDaysToMinutes, minutesToDays } from './date-format';
import {
  formatCount,
  formatIndex,
  formatMoney,
  formatPercent,
  formatVariance,
} from './progress-format';

describe('progress-format null-safety', () => {
  it('returns placeholder for null (no fake zero)', () => {
    expect(formatPercent(null)).toBe(EMPTY_PLACEHOLDER);
    expect(formatIndex(null)).toBe(EMPTY_PLACEHOLDER);
    expect(formatMoney(null)).toBe(EMPTY_PLACEHOLDER);
    expect(formatCount(null)).toBe(EMPTY_PLACEHOLDER);
    expect(formatVariance(null)).toBe(EMPTY_PLACEHOLDER);
  });

  it('formats zero as zero (not placeholder)', () => {
    expect(formatPercent(0)).not.toBe(EMPTY_PLACEHOLDER);
    expect(formatCount(0)).not.toBe(EMPTY_PLACEHOLDER);
  });

  it('formatVariance adds explicit sign for positive', () => {
    expect(formatVariance(5)).toContain('+');
  });

  it('formatMoney parses numeric strings', () => {
    expect(formatMoney('1000')).not.toBe(EMPTY_PLACEHOLDER);
    expect(formatMoney('not-a-number')).toBe(EMPTY_PLACEHOLDER);
  });
});

describe('date-format conversions', () => {
  it('minutesToDays and daysToMinutes round-trip', () => {
    expect(minutesToDays(daysToMinutes(3))).toBe(3);
  });

  it('lag day/minute conversion', () => {
    expect(lagDaysToMinutes(2)).toBe(2 * 24 * 60);
    expect(formatLagFa(0)).toBe('۰');
  });
});

describe('control-status tones', () => {
  it('maps statuses to tones', () => {
    expect(statusTone(ControlNodeStatus.ON_TRACK)).toBe('green');
    expect(statusTone(ControlNodeStatus.DELAYED)).toBe('red');
    expect(statusTone(ControlNodeStatus.AT_RISK)).toBe('orange');
    expect(statusTone(null)).toBe('gray');
  });

  it('provides Persian labels', () => {
    expect(statusLabel(ControlNodeStatus.COMPLETED)).toBe('تکمیل‌شده');
    expect(statusLabel(null)).toBe('نامشخص');
  });

  it('variance tone thresholds', () => {
    expect(varianceTone(0)).toBe('green');
    expect(varianceTone(-10)).toBe('orange');
    expect(varianceTone(-20)).toBe('red');
    expect(varianceTone(null)).toBe('gray');
  });

  it('index tone thresholds', () => {
    expect(indexTone(1.0)).toBe('green');
    expect(indexTone(0.9)).toBe('orange');
    expect(indexTone(0.5)).toBe('red');
  });

  it('data quality issue count sums fields', () => {
    expect(
      dataQualityIssueCount({
        nodesWithoutDates: 1,
        nodesWithoutWeight: 2,
        nodesWithoutOwner: 0,
        nodesWithoutDod: 0,
        invalidDependencies: 3,
        unbalancedWeightParents: 0,
        fileConflicts: 0,
        staleData: 0,
      }),
    ).toBe(6);
    expect(dataQualityIssueCount(null)).toBe(0);
  });
});
