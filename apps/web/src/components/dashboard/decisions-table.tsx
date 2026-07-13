import type { DecisionDto } from '@ppm/contracts';
import { DECISION_STATUS_META, EMPTY_PLACEHOLDER, toPersianDigits } from '@ppm/contracts';
import { AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { isoToJalaliFa, orDash } from '@/lib/utils';

export function DecisionsTable({
  decisions,
}: {
  decisions: DecisionDto[];
}): React.JSX.Element {
  if (decisions.length === 0) {
    return <EmptyState title="تصمیمی ثبت نشده است" />;
  }
  const rows = [...decisions].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-10">ردیف</th>
            <th className="text-right">موضوع</th>
            <th className="text-right">شرح</th>
            <th className="w-20">مسئول</th>
            <th className="w-20">مهلت</th>
            <th className="w-24">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, idx) => {
            const meta = DECISION_STATUS_META[d.status];
            return (
              <tr key={d.id}>
                <td>{toPersianDigits(idx + 1)}</td>
                <td className="text-right">{orDash(d.subject)}</td>
                <td className="text-right">{orDash(d.description)}</td>
                <td>{orDash(d.owner)}</td>
                <td>
                  <span className="inline-flex items-center gap-1">
                    {d.isOverdue ? (
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-brand-red"
                        aria-label="سررسید گذشته"
                      />
                    ) : null}
                    {d.dueDate ? isoToJalaliFa(d.dueDate) : EMPTY_PLACEHOLDER}
                  </span>
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
