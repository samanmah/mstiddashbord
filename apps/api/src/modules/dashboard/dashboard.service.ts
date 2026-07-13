import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type ConsistencyWarning,
  type DashboardDto,
  type DashboardSummary,
  ErrorCode,
  type IndicatorSummary,
  VALIDATION,
} from '@ppm/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardCalculationService } from '../calculation/dashboard-calculation.service';
import {
  mapActivity,
  mapDecision,
  mapIndicator,
  mapMonthlyProgress,
  mapProject,
  mapRisk,
} from '../projects/project.mapper';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: DashboardCalculationService,
  ) {}

  async getDashboard(projectId: string): Promise<DashboardDto> {
    // یک Query بهینه با include برای جلوگیری از N+1.
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        indicators: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }] },
        monthlyProgress: { orderBy: { sortOrder: 'asc' } },
        activities: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
        },
        risks: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
        },
        decisions: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { rowNumber: 'asc' }],
        },
      },
    });

    if (!project) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'پروژه یافت نشد.' });
    }

    const activityInputs = project.activities.map((a) => ({
      weightPercent: a.weightPercent,
      plannedPercent: a.plannedPercent,
      actualPercent: a.actualPercent,
    }));

    const plannedProjectProgress = this.calc.plannedProjectProgress(activityInputs);
    const actualProjectProgress = this.calc.actualProjectProgress(activityInputs);
    const achievementPercent = this.calc.achievementPercent(
      plannedProjectProgress,
      actualProjectProgress,
    );
    const weightCheck = this.calc.validateWeights(activityInputs);

    const summary: DashboardSummary = {
      plannedProjectProgress,
      actualProjectProgress,
      achievementPercent,
      achievementGaugeValue: this.calc.gaugeValue(achievementPercent),
      isBeyondPlan: this.calc.isBeyondPlan(achievementPercent),
      totalWeight: weightCheck.totalWeight,
      weightIsValid: weightCheck.isValid,
    };

    const primaryIndicator =
      project.indicators.find((i) => i.isPrimary) ?? project.indicators[0] ?? null;
    const indicatorAchievement = this.calc.indicatorAchievementPercent(
      primaryIndicator
        ? { plannedValue: primaryIndicator.plannedValue, actualValue: primaryIndicator.actualValue }
        : null,
    );
    const indicatorSummary: IndicatorSummary = {
      indicator: primaryIndicator ? mapIndicator(primaryIndicator) : null,
      achievementPercent: indicatorAchievement,
      achievementGaugeValue: this.calc.gaugeValue(indicatorAchievement),
    };

    // کنترل ناسازگاری: آخرین واقعیِ ثبت‌شدهٔ ماهانه در برابر پیشرفت واقعی پروژه.
    const monthsWithActual = project.monthlyProgress.filter(
      (m) => m.actualPercent !== null && m.actualPercent !== undefined,
    );
    const lastMonthActual =
      monthsWithActual.length > 0
        ? monthsWithActual[monthsWithActual.length - 1]!.actualPercent
        : null;
    const difference = this.calc.consistencyDifference(lastMonthActual, actualProjectProgress);
    const consistency: ConsistencyWarning = {
      hasWarning: difference !== null && difference > VALIDATION.CONSISTENCY_THRESHOLD,
      lastMonthActual,
      actualProjectProgress,
      difference,
    };

    return {
      project: mapProject(project),
      summary,
      indicatorSummary,
      indicators: project.indicators.map(mapIndicator),
      monthlyProgress: project.monthlyProgress.map(mapMonthlyProgress),
      activities: project.activities.map(mapActivity),
      risks: project.risks.map(mapRisk),
      decisions: project.decisions.map(mapDecision),
      consistency,
      generatedAt: new Date().toISOString(),
    };
  }
}
