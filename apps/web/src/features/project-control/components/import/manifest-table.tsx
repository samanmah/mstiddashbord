'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { toPersianDigits } from '@ppm/contracts';
import { StatusBadge } from '@/components/ui/badge';
import type { ControlImportPreview } from '../../api/project-control-types';

const KEY_LABELS: Record<string, string> = {
  phaseCount: 'تعداد فازها',
  break1Count: 'تعداد شکست ۱',
  sourceRowCount: 'تعداد سطرهای منبع',
  periodCount: 'تعداد دوره‌ها',
  totalDays: 'مجموع روزها',
  totalMonths: 'مجموع ماه‌ها',
  budgetRowCount: 'سطرهای بودجه',
  budgetTotal: 'بودجهٔ کل',
  ownerCount: 'تعداد مسئولان',
  dodCount: 'تعداد DOD',
  progressCount: 'تعداد پیشرفت',
  dateMin: 'کمینهٔ تاریخ',
  dateMax: 'بیشینهٔ تاریخ',
};

export function ManifestTable({ preview }: { preview: ControlImportPreview }): React.JSX.Element {
  const checks = preview.manifestChecks;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {preview.manifestValid ? (
          <StatusBadge tone="green" label="Manifest معتبر است" />
        ) : (
          <StatusBadge tone="red" label="عدم تطابق Manifest" />
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="bg-navy-800 text-white">
            <tr>
              <th className="px-3 py-2 text-right">معیار</th>
              <th className="px-3 py-2">مورد انتظار</th>
              <th className="px-3 py-2">مقدار واقعی</th>
              <th className="px-3 py-2">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.key} className="border-b border-borderx">
                <td className="px-3 py-2 text-right">{KEY_LABELS[c.key] ?? c.key}</td>
                <td className="px-3 py-2 text-center">{toPersianDigits(c.expected)}</td>
                <td className="px-3 py-2 text-center font-medium">{toPersianDigits(c.actual)}</td>
                <td className="px-3 py-2 text-center">
                  {c.ok ? (
                    <CheckCircle2 className="mx-auto h-4 w-4 text-brand-green" aria-label="مطابق" />
                  ) : (
                    <XCircle className="mx-auto h-4 w-4 text-brand-red" aria-label="نامطابق" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
