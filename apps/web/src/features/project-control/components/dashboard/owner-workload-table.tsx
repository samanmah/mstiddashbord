'use client';

import { EmptyState } from '@/components/ui/states';
import type { OwnerWorkloadRow } from '../../api/project-control-types';
import { formatCount, formatPercent } from '../../utils/progress-format';

/** جدول بار کاری مسئولان. */
export function OwnerWorkloadTable({
  rows,
}: {
  rows: OwnerWorkloadRow[];
}): React.JSX.Element {
  if (rows.length === 0) {
    return <EmptyState title="مسئولی ثبت نشده است" />;
  }

  const sorted = [...rows].sort((a, b) => b.total - a.total);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-borderx text-xs text-grayx-header">
            <th className="px-2 py-2 text-right font-medium">مسئول</th>
            <th className="px-2 py-2 text-center font-medium">کل</th>
            <th className="px-2 py-2 text-center font-medium">باز</th>
            <th className="px-2 py-2 text-center font-medium">تأخیردار</th>
            <th className="px-2 py-2 text-center font-medium">میانگین پیشرفت</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.owner} className="border-b border-borderx/60 hover:bg-surface">
              <td className="px-2 py-1.5 text-right font-medium">{r.owner}</td>
              <td className="px-2 py-1.5 text-center tabular-nums">{formatCount(r.total)}</td>
              <td className="px-2 py-1.5 text-center tabular-nums">{formatCount(r.open)}</td>
              <td className="px-2 py-1.5 text-center tabular-nums text-brand-red">
                {formatCount(r.delayed)}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums">
                {formatPercent(r.avgProgress)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
