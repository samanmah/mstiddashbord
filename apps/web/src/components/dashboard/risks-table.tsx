import type { RiskDto } from '@ppm/contracts';
import { RISK_LEVEL_META, toPersianDigits } from '@ppm/contracts';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { orDash } from '@/lib/utils';

export function RisksTable({ risks }: { risks: RiskDto[] }): React.JSX.Element {
  if (risks.length === 0) {
    return <EmptyState title="ریسکی ثبت نشده است" />;
  }
  const rows = [...risks].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-10">ردیف</th>
            <th className="text-right">ریسک / چالش</th>
            <th className="w-24">سطح ریسک</th>
            <th className="w-20">مسئول</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const meta = RISK_LEVEL_META[r.riskLevel];
            return (
              <tr key={r.id}>
                <td>{toPersianDigits(idx + 1)}</td>
                <td className="text-right" title={r.mitigationAction || undefined}>
                  {r.title}
                </td>
                <td>
                  <StatusBadge tone={meta.tone} label={meta.label} />
                </td>
                <td>{orDash(r.owner)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
