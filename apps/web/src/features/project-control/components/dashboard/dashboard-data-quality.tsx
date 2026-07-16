'use client';

import type { DataQualityReport } from '../../api/project-control-types';
import { dataQualityIssueCount } from '../../utils/control-status';
import { formatCount } from '../../utils/progress-format';
import { MetricCard } from '../common/metric-card';

/** نمایش کیفیت داده در داشبورد (Presentational؛ گزارش از payload داشبورد). */
export function DashboardDataQuality({
  report,
}: {
  report: DataQualityReport;
}): React.JSX.Element {
  const total = dataQualityIssueCount(report);
  const item = (label: string, value: number): React.JSX.Element => (
    <MetricCard
      label={label}
      value={formatCount(value)}
      tone={value > 0 ? 'purple' : 'green'}
    />
  );

  return (
    <div className="space-y-3">
      <p className="text-sm">
        مجموع مسائل کیفیت داده:{' '}
        <span className={total === 0 ? 'font-bold text-brand-green' : 'font-bold text-brand-purple'}>
          {total === 0 ? 'بدون مسئله' : formatCount(total)}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {item('بدون تاریخ', report.nodesWithoutDates)}
        {item('بدون وزن', report.nodesWithoutWeight)}
        {item('بدون مسئول', report.nodesWithoutOwner)}
        {item('بدون DOD', report.nodesWithoutDod)}
        {item('وابستگی نامعتبر', report.invalidDependencies)}
        {item('وزن نامتوازن', report.unbalancedWeightParents)}
        {item('تعارض فایل', report.fileConflicts)}
        {item('دادهٔ کهنه', report.staleData)}
      </div>
    </div>
  );
}
