'use client';

import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { useDataQuality } from '../../hooks/use-control-dashboard';
import { dataQualityIssueCount } from '../../utils/control-status';
import { formatCount } from '../../utils/progress-format';
import { MetricCard } from '../common/metric-card';

export function DataQualityPanel({ projectId }: { projectId: string }): React.JSX.Element {
  const dq = useDataQuality(projectId);

  if (dq.isLoading) return <FullPageSpinner label="در حال بارگذاری کیفیت داده…" />;
  if (dq.isError) return <ErrorState error={dq.error} onRetry={() => void dq.refetch()} />;

  const r = dq.data;
  const total = dataQualityIssueCount(r);
  const item = (label: string, value: number | undefined): React.JSX.Element => (
    <MetricCard
      label={label}
      value={value == null ? '—' : formatCount(value)}
      tone={value && value > 0 ? 'purple' : 'green'}
    />
  );

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-sm">
          مجموع مسائل کیفیت داده:{' '}
          <span className={total === 0 ? 'font-bold text-brand-green' : 'font-bold text-brand-purple'}>
            {total === 0 ? 'بدون مسئله' : formatCount(total)}
          </span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {item('بدون تاریخ', r?.nodesWithoutDates)}
        {item('بدون وزن', r?.nodesWithoutWeight)}
        {item('بدون مسئول', r?.nodesWithoutOwner)}
        {item('بدون DOD', r?.nodesWithoutDod)}
        {item('وابستگی نامعتبر', r?.invalidDependencies)}
        {item('وزن نامتوازن', r?.unbalancedWeightParents)}
        {item('تعارض فایل', r?.fileConflicts)}
        {item('دادهٔ کهنه', r?.staleData)}
      </div>
    </div>
  );
}
