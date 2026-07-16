'use client';

import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  Flag,
  Gauge,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { MetricCard } from '../common/metric-card';
import type { ControlExecutiveKpis } from '../../api/project-control-types';
import { indexTone, varianceTone } from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import {
  formatCount,
  formatDelayDays,
  formatIndex,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatVariance,
} from '../../utils/progress-format';

/** ردیف شاخص‌های کلیدی مدیریتی (Read-only). */
export function ExecutiveKpis({ kpis }: { kpis: ControlExecutiveKpis }): React.JSX.Element {
  const varTone = varianceTone(kpis.scheduleVariancePercent);
  return (
    <div
      data-testid="executive-kpis"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
    >
      <MetricCard
        label="پیشرفت برنامه‌ای"
        value={formatPercent(kpis.plannedProgress)}
        tone="blue"
        icon={<TrendingUp className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="پیشرفت واقعی"
        value={formatPercent(kpis.actualProgress)}
        tone="green"
        icon={<Activity className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="تحقق برنامه"
        value={formatPercent(kpis.achievement)}
        tone="purple"
        icon={<Gauge className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="انحراف زمان‌بندی"
        value={formatVariance(kpis.scheduleVariancePercent)}
        tone={varTone}
        icon={
          (kpis.scheduleVariancePercent ?? 0) < 0 ? (
            <TrendingDown className="h-4 w-4" aria-hidden />
          ) : (
            <TrendingUp className="h-4 w-4" aria-hidden />
          )
        }
      />
      <MetricCard
        label="شاخص عملکرد زمان (SPI)"
        value={formatIndex(kpis.spi)}
        tone={indexTone(kpis.spi)}
        icon={<Gauge className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="شاخص عملکرد هزینه (CPI)"
        value={formatIndex(kpis.cpi)}
        tone={indexTone(kpis.cpi)}
        icon={<Gauge className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        testId="kpi-imported-budget"
        label="جمع بودجه بسته‌های واردشده"
        value={`${formatMoney(kpis.budgetTotal)} تومان`}
        compactValue={formatMoneyCompact(kpis.budgetTotal, 'تومان')}
        valueTitle={`${formatMoney(kpis.budgetTotal)} تومان`}
        hint="تومان — از Import Excel/MPP"
        tone="neutral"
        icon={<Wallet className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="هزینه واقعی"
        value={`${formatMoney(kpis.actualCost)} تومان`}
        compactValue={formatMoneyCompact(kpis.actualCost, 'تومان')}
        valueTitle={`${formatMoney(kpis.actualCost)} تومان`}
        hint="تومان"
        tone="neutral"
        icon={<CircleDollarSign className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="پایان پیش‌بینی‌شده"
        value={jalaliFa(kpis.forecastFinish)}
        tone="neutral"
        icon={<CalendarClock className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="روزهای تأخیر"
        value={formatDelayDays(kpis.finishVarianceDays)}
        tone={(kpis.finishVarianceDays ?? 0) > 0 ? 'red' : 'green'}
        icon={<CalendarClock className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="فعالیت‌های بحرانی"
        value={formatCount(kpis.criticalCount)}
        tone={kpis.criticalCount > 0 ? 'red' : 'green'}
        icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="فعالیت‌های تأخیردار"
        value={formatCount(kpis.overdueCount)}
        tone={kpis.overdueCount > 0 ? 'orange' : 'green'}
        icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="نقاط عطف پیش‌رو"
        value={formatCount(kpis.upcomingMilestones)}
        tone="blue"
        icon={<Flag className="h-4 w-4" aria-hidden />}
      />
      <MetricCard
        label="فعالیت‌های متوقف"
        value={formatCount(kpis.blockedCount)}
        tone={kpis.blockedCount > 0 ? 'red' : 'green'}
        icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
      />
    </div>
  );
}
