import { ActivityStatus } from '@ppm/contracts';
import {
  type ActivityCalcInput,
  DashboardCalculationService,
} from './dashboard-calculation.service';

describe('DashboardCalculationService', () => {
  let service: DashboardCalculationService;

  const sampleActivities: ActivityCalcInput[] = [
    { weightPercent: 20, plannedPercent: 100, actualPercent: 100 },
    { weightPercent: 30, plannedPercent: 50, actualPercent: 50 },
    { weightPercent: 20, plannedPercent: 0, actualPercent: 0 },
    { weightPercent: 20, plannedPercent: 0, actualPercent: 0 },
    { weightPercent: 10, plannedPercent: 0, actualPercent: 0 },
  ];

  beforeEach(() => {
    service = new DashboardCalculationService();
  });

  describe('sample data (acceptance criteria)', () => {
    it('planned project progress = 35', () => {
      expect(service.plannedProjectProgress(sampleActivities)).toBe(35);
    });

    it('actual project progress = 35', () => {
      expect(service.actualProjectProgress(sampleActivities)).toBe(35);
    });

    it('achievement percent = 100', () => {
      const planned = service.plannedProjectProgress(sampleActivities);
      const actual = service.actualProjectProgress(sampleActivities);
      expect(service.achievementPercent(planned, actual)).toBe(100);
    });

    it('indicator achievement = 0 (2 planned, 0 actual)', () => {
      expect(
        service.indicatorAchievementPercent({ plannedValue: 2, actualValue: 0 }),
      ).toBe(0);
    });

    it('weight sum is exactly 100 and valid', () => {
      const result = service.validateWeights(sampleActivities);
      expect(result.totalWeight).toBe(100);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBe(0);
    });
  });

  describe('achievementPercent — division by zero', () => {
    it('returns null when planned is zero', () => {
      expect(service.achievementPercent(0, 10)).toBeNull();
    });

    it('does not throw and returns null for empty activities', () => {
      const planned = service.plannedProjectProgress([]);
      const actual = service.actualProjectProgress([]);
      expect(planned).toBe(0);
      expect(service.achievementPercent(planned, actual)).toBeNull();
    });

    it('handles beyond-plan (>100) values', () => {
      const ach = service.achievementPercent(20, 30);
      expect(ach).toBe(150);
      expect(service.isBeyondPlan(ach)).toBe(true);
      expect(service.gaugeValue(ach)).toBe(100);
    });
  });

  describe('indicator achievement — division by zero', () => {
    it('returns null when planned value is zero', () => {
      expect(
        service.indicatorAchievementPercent({ plannedValue: 0, actualValue: 5 }),
      ).toBeNull();
    });

    it('returns null when indicator missing', () => {
      expect(service.indicatorAchievementPercent(null)).toBeNull();
    });
  });

  describe('computeActivityStatus', () => {
    it('UNKNOWN when planned is zero', () => {
      expect(service.computeActivityStatus(0, 0)).toBe(ActivityStatus.UNKNOWN);
    });

    it('WEAK when ratio < 0.70', () => {
      expect(service.computeActivityStatus(100, 60)).toBe(ActivityStatus.WEAK);
    });

    it('AVERAGE when 0.70 <= ratio < 0.90', () => {
      expect(service.computeActivityStatus(100, 70)).toBe(ActivityStatus.AVERAGE);
      expect(service.computeActivityStatus(100, 89)).toBe(ActivityStatus.AVERAGE);
    });

    it('GOOD when ratio >= 0.90', () => {
      expect(service.computeActivityStatus(100, 90)).toBe(ActivityStatus.GOOD);
      expect(service.computeActivityStatus(100, 100)).toBe(ActivityStatus.GOOD);
    });

    it('respects manager override', () => {
      expect(
        service.effectiveActivityStatus({
          weightPercent: 10,
          plannedPercent: 0,
          actualPercent: 0,
          statusOverride: ActivityStatus.GOOD,
        }),
      ).toBe(ActivityStatus.GOOD);
    });
  });

  describe('monthlyDeviation', () => {
    it('returns null when actual is null', () => {
      expect(service.monthlyDeviation(15, null)).toBeNull();
    });

    it('computes actual - planned', () => {
      expect(service.monthlyDeviation(15, 10)).toBe(-5);
      expect(service.monthlyDeviation(10, 25)).toBe(15);
    });
  });

  describe('validateWeights', () => {
    it('detects under/over weight', () => {
      const under = service.validateWeights([
        { weightPercent: 40, plannedPercent: 0, actualPercent: 0 },
        { weightPercent: 50, plannedPercent: 0, actualPercent: 0 },
      ]);
      expect(under.isValid).toBe(false);
      expect(under.difference).toBe(-10);

      const over = service.validateWeights([
        { weightPercent: 60, plannedPercent: 0, actualPercent: 0 },
        { weightPercent: 50, plannedPercent: 0, actualPercent: 0 },
      ]);
      expect(over.isValid).toBe(false);
      expect(over.difference).toBe(10);
    });
  });

  describe('consistencyDifference', () => {
    it('returns null when last month actual is null', () => {
      expect(service.consistencyDifference(null, 35)).toBeNull();
    });

    it('computes absolute difference', () => {
      expect(service.consistencyDifference(40, 35)).toBe(5);
      expect(service.consistencyDifference(34.6, 35)).toBe(0.4);
    });
  });
});
