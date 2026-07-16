import type { ActivityDto } from '@ppm/contracts';
import { ACTIVITY_STATUS_META, toPersianDigits } from '@ppm/contracts';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { faPercent } from '@/lib/utils';

export function ActivitiesTable({
  activities,
}: {
  activities: ActivityDto[];
}): React.JSX.Element {
  if (activities.length === 0) {
    return <EmptyState title="فعالیتی ثبت نشده است" />;
  }
  const rows = [...activities].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-10">ردیف</th>
            <th className="text-right">فعالیت</th>
            <th className="w-14">وزن</th>
            <th className="w-16">برنامه‌ای</th>
            <th className="w-16">واقعی</th>
            <th className="w-20">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, idx) => {
            const meta = ACTIVITY_STATUS_META[a.effectiveStatus];
            return (
              <tr key={a.id}>
                <td className="text-grayx-header">{toPersianDigits(idx + 1)}</td>
                <td className="text-right font-medium">{a.title}</td>
                <td className="tabular-nums font-semibold">{faPercent(a.weightPercent)}</td>
                <td className="tabular-nums font-semibold text-accent-blue">
                  {faPercent(a.plannedPercent)}
                </td>
                <td className="tabular-nums font-semibold text-accent-emerald">
                  {faPercent(a.actualPercent)}
                </td>
                <td>
                  <StatusBadge tone={meta.tone} label={meta.label} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
