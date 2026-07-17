'use client';

import {
  Activity,
  AlertOctagon,
  CalendarClock,
  Coins,
  Diamond,
  Folder,
  Layers,
  ListTodo,
  PackageCheck,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { isoToJalaliFa } from '@/lib/utils';
import { useControlDashboard, useDataQuality } from '../../hooks/use-control-dashboard';
import { useImports } from '../../hooks/use-control-imports';
import { useProgressList } from '../../hooks/use-control-progress';
import { useWbsList } from '../../hooks/use-control-wbs';
import { WbsNodeType } from '../../api/project-control-types';
import {
  dataQualityIssueCount,
  indexTone,
  varianceTone,
} from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import {
  formatCount,
  formatIndex,
  formatMoney,
  formatPercent,
  formatVariance,
} from '../../utils/progress-format';
import { MetricCard } from '../common/metric-card';

export function ControlOverview({ projectId }: { projectId: string }): React.JSX.Element {
  const dashboard = useControlDashboard(projectId);
  const wbs = useWbsList(projectId);
  const dq = useDataQuality(projectId);
  const imports = useImports(projectId);
  const progress = useProgressList(projectId);

  if (dashboard.isLoading || wbs.isLoading) {
    return <FullPageSpinner label="در حال بارگذاری نمای کلی…" />;
  }
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }

  const kpi = dashboard.data?.executiveKpis;
  const nodes = wbs.data ?? [];
  const countType = (t: WbsNodeType): number => nodes.filter((n) => n.nodeType === t).length;

  const totalWeight = (dashboard.data?.phaseRollups ?? []).reduce(
    (sum, p) => sum + (p.weight ?? 0),
    0,
  );
  const dqCount = dataQualityIssueCount(dq.data);

  const lastImport = (imports.data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const lastProgress = (progress.data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-bold text-navy-900">ساختار</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="فازها" value={formatCount(countType(WbsNodeType.PHASE))} icon={<Layers className="h-4 w-4" />} tone="blue" />
          <MetricCard label="شکست ۱" value={formatCount(countType(WbsNodeType.BREAK1))} icon={<Folder className="h-4 w-4" />} tone="purple" />
          <MetricCard label="بسته‌های کاری" value={formatCount(countType(WbsNodeType.WORK_PACKAGE))} icon={<PackageCheck className="h-4 w-4" />} tone="green" />
          <MetricCard label="فعالیت‌ها" value={formatCount(countType(WbsNodeType.TASK))} icon={<ListTodo className="h-4 w-4" />} />
          <MetricCard label="نقاط عطف" value={formatCount(countType(WbsNodeType.MILESTONE))} icon={<Diamond className="h-4 w-4" />} tone="orange" />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-navy-900">پیشرفت و شاخص‌ها</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard label="پیشرفت برنامه‌ای" value={formatPercent(kpi?.plannedProgress, 1)} icon={<TrendingUp className="h-4 w-4" />} tone="blue" />
          <MetricCard label="پیشرفت واقعی" value={formatPercent(kpi?.actualProgress, 1)} icon={<Activity className="h-4 w-4" />} tone="green" />
          <MetricCard label="انحراف زمان‌بندی" value={formatVariance(kpi?.scheduleVariancePercent)} tone={varianceTone(kpi?.scheduleVariancePercent)} />
          <MetricCard label="وزن کل فازها" value={formatPercent(totalWeight, 1)} />
          <MetricCard label="SPI" value={formatIndex(kpi?.spi)} tone={indexTone(kpi?.spi)} />
          <MetricCard label="CPI" value={formatIndex(kpi?.cpi)} tone={indexTone(kpi?.cpi)} />
          <MetricCard label="فعالیت‌های بحرانی" value={formatCount(kpi?.criticalCount)} icon={<AlertOctagon className="h-4 w-4" />} tone={kpi && kpi.criticalCount > 0 ? 'red' : 'gray'} />
          <MetricCard label="فعالیت‌های تأخیردار" value={formatCount(kpi?.overdueCount)} tone={kpi && kpi.overdueCount > 0 ? 'red' : 'gray'} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-navy-900">هزینه و کیفیت</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard
            label="جمع بودجه بسته‌های واردشده"
            value={`${formatMoney(kpi?.budgetTotal)} تومان`}
            valueTitle={`${formatMoney(kpi?.budgetTotal)} تومان`}
            icon={<Wallet className="h-4 w-4" />}
            tone="blue"
          />
          <MetricCard
            label="هزینه واقعی"
            value={`${formatMoney(kpi?.actualCost)} تومان`}
            valueTitle={`${formatMoney(kpi?.actualCost)} تومان`}
            icon={<Coins className="h-4 w-4" />}
            tone="green"
          />
          <MetricCard label="پیش‌بینی پایان" value={jalaliFa(kpi?.forecastFinish)} icon={<CalendarClock className="h-4 w-4" />} />
          <MetricCard label="مسائل کیفیت داده" value={dqCount === 0 ? 'بدون مسئله' : formatCount(dqCount)} icon={<ShieldAlert className="h-4 w-4" />} tone={dqCount === 0 ? 'green' : 'purple'} />
          <MetricCard label="آخرین ورود اطلاعات" value={lastImport ? isoToJalaliFa(lastImport.createdAt) : '—'} />
          <MetricCard label="آخرین ثبت پیشرفت" value={lastProgress ? jalaliFa(lastProgress.reportingDate) : '—'} />
        </div>
      </section>
    </div>
  );
}
