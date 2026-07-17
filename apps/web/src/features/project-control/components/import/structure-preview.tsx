'use client';

import { toPersianDigits } from '@ppm/contracts';
import type { ControlImportPreview } from '../../api/project-control-types';
import { formatCount, formatMoney } from '../../utils/progress-format';
import { jalaliFa } from '../../utils/date-format';
import { MetricCard } from '../common/metric-card';

export function StructurePreview({ preview }: { preview: ControlImportPreview }): React.JSX.Element {
  const m = preview.manifest;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="فازها" value={formatCount(preview.counts.phases)} tone="blue" />
        <MetricCard label="شکست ۱" value={formatCount(preview.counts.break1)} tone="purple" />
        <MetricCard label="فعالیت‌ها" value={formatCount(preview.counts.tasks)} />
        <MetricCard label="کل نودها" value={formatCount(preview.counts.totalNodes)} tone="green" />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-navy-900">تعداد سطرها به تفکیک فاز</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead className="bg-navy-800 text-white">
              <tr>
                <th className="px-3 py-2">فاز</th>
                <th className="px-3 py-2">تعداد سطر</th>
              </tr>
            </thead>
            <tbody>
              {m.perPhaseCounts.map((count, i) => (
                <tr key={i} className="border-b border-borderx">
                  <td className="px-3 py-2 text-center">فاز {toPersianDigits(String(i + 1))}</td>
                  <td className="px-3 py-2 text-center">{formatCount(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="بازهٔ زمانی" value={`${jalaliFa(m.dateMin)} تا ${jalaliFa(m.dateMax)}`} />
        <MetricCard label="مجموع روزها" value={formatCount(m.totalDays)} />
        <MetricCard
          label="جمع بودجه بسته‌ها"
          value={`${formatMoney(m.budgetTotal)} تومان`}
          valueTitle={`${formatMoney(m.budgetTotal)} تومان`}
          tone="blue"
        />
        <MetricCard label="تعداد دوره‌ها" value={formatCount(m.periodCount)} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="ستون دوره‌ای"
          value={formatCount(preview.periodMatrixStats.periodColumnCount)}
        />
        <MetricCard
          label="Snapshot Parse‌شده"
          value={formatCount(preview.periodMatrixStats.periodSnapshotsParsed)}
          tone="green"
        />
        <MetricCard label="Planned" value={formatCount(preview.periodMatrixStats.plannedCount)} />
        <MetricCard label="Actual" value={formatCount(preview.periodMatrixStats.actualCount)} />
      </div>
    </div>
  );
}
