import { Injectable } from '@nestjs/common';
import { ActivityStatus } from '@ppm/contracts';

export interface ActivityCalcInput {
  weightPercent: number;
  plannedPercent: number;
  actualPercent: number;
  statusOverride?: ActivityStatus | null;
}

export interface IndicatorCalcInput {
  plannedValue: number;
  actualValue: number;
}

export interface WeightValidationResult {
  totalWeight: number;
  isValid: boolean;
  /** اختلاف با ۱۰۰ (مثبت=اضافه، منفی=کمبود) */
  difference: number;
}

/**
 * تنها منبع محاسبات داشبورد. این سرویس Stateless و کاملاً تست‌شده است.
 * منطق این کلاس نباید در Frontend تکرار شود.
 */
@Injectable()
export class DashboardCalculationService {
  private readonly WEIGHT_TOLERANCE = 0.001;
  private readonly EPSILON = 1e-9;

  /** گرد کردن به ۲ رقم اعشار برای جلوگیری از خطای شناور. */
  round2(value: number): number {
    return Math.round((value + this.EPSILON) * 100) / 100;
  }

  /** ۶.۱ — پیشرفت برنامه‌ای کل پروژه. */
  plannedProjectProgress(activities: ActivityCalcInput[]): number {
    const sum = activities.reduce(
      (acc, a) => acc + a.weightPercent * a.plannedPercent,
      0,
    );
    return this.round2(sum / 100);
  }

  /** ۶.۲ — پیشرفت واقعی کل پروژه. */
  actualProjectProgress(activities: ActivityCalcInput[]): number {
    const sum = activities.reduce(
      (acc, a) => acc + a.weightPercent * a.actualPercent,
      0,
    );
    return this.round2(sum / 100);
  }

  /**
   * ۶.۳ — درصد تحقق برنامه پروژه.
   * اگر برنامه صفر باشد، null («فاقد برنامه»).
   */
  achievementPercent(planned: number, actual: number): number | null {
    if (planned <= this.EPSILON) return null;
    return this.round2((actual / planned) * 100);
  }

  /** مقدار پر شدن Gauge (۰..۱۰۰). */
  gaugeValue(achievement: number | null): number {
    if (achievement === null) return 0;
    if (achievement < 0) return 0;
    return Math.min(100, this.round2(achievement));
  }

  /** آیا مقدار فراتر از برنامه است (بیش از ۱۰۰٪). */
  isBeyondPlan(achievement: number | null): boolean {
    return achievement !== null && achievement > 100 + this.WEIGHT_TOLERANCE;
  }

  /** ۶.۴ — درصد تحقق شاخص اثربخشی. */
  indicatorAchievementPercent(indicator: IndicatorCalcInput | null): number | null {
    if (!indicator) return null;
    if (indicator.plannedValue <= this.EPSILON) return null;
    return this.round2((indicator.actualValue / indicator.plannedValue) * 100);
  }

  /** ۶.۵ — وضعیت خودکار (محاسبه‌ای) یک فعالیت. */
  computeActivityStatus(planned: number, actual: number): ActivityStatus {
    if (planned <= this.EPSILON) return ActivityStatus.UNKNOWN;
    const ratio = actual / planned;
    if (ratio < 0.7) return ActivityStatus.WEAK;
    if (ratio < 0.9) return ActivityStatus.AVERAGE;
    return ActivityStatus.GOOD;
  }

  /** وضعیت مؤثر (با در نظر گرفتن Override مدیر). */
  effectiveActivityStatus(activity: ActivityCalcInput): ActivityStatus {
    if (activity.statusOverride) return activity.statusOverride;
    return this.computeActivityStatus(activity.plannedPercent, activity.actualPercent);
  }

  /** ۶.۶ — انحراف ماهانه. اگر واقعی null باشد، انحراف null است. */
  monthlyDeviation(planned: number, actual: number | null): number | null {
    if (actual === null || actual === undefined) return null;
    return this.round2(actual - planned);
  }

  /** ۶.۷ — اعتبارسنجی مجموع وزن فعالیت‌ها (باید دقیقاً ۱۰۰ باشد). */
  validateWeights(activities: ActivityCalcInput[]): WeightValidationResult {
    const totalWeight = this.round2(
      activities.reduce((acc, a) => acc + a.weightPercent, 0),
    );
    const difference = this.round2(totalWeight - 100);
    return {
      totalWeight,
      difference,
      isValid: Math.abs(difference) <= this.WEIGHT_TOLERANCE,
    };
  }

  /**
   * ۶.۸ — کنترل ناسازگاری: اختلاف آخرین واقعیِ ماهانه با پیشرفت واقعی کل.
   * برمی‌گرداند اختلاف (|Δ|) یا null اگر داده کافی نباشد.
   */
  consistencyDifference(
    lastMonthActual: number | null,
    actualProjectProgress: number,
  ): number | null {
    if (lastMonthActual === null || lastMonthActual === undefined) return null;
    return this.round2(Math.abs(lastMonthActual - actualProjectProgress));
  }
}
