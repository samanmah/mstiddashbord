'use client';

import { toPersianDigits } from '@ppm/contracts';
import { StatusBadge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type { ImportConflict, ImportMappingItem } from '../../api/project-control-types';

export type ConflictDecision = 'keep-excel' | 'keep-existing' | 'ignore';

const DECISION_OPTIONS = [
  { value: 'keep-excel', label: 'حفظ مقدار فایل (Excel/MPP)' },
  { value: 'keep-existing', label: 'حفظ مقدار موجود' },
  { value: 'ignore', label: 'نادیده گرفتن این سطر' },
];

/**
 * حل تعارض‌ها. تصمیم‌ها به mappings تبدیل می‌شوند:
 * - ignore → { sourceRow, ignore: true }
 * - keep-existing → { sourceRow, matchedNodeId }
 * - keep-excel → بدون matchedNodeId (مقدار فایل اعمال می‌شود)
 */
export function ConflictResolver({
  conflicts,
  decisions,
  onChange,
}: {
  conflicts: ImportConflict[];
  decisions: Record<number, ConflictDecision>;
  onChange: (sourceRow: number, decision: ConflictDecision) => void;
}): React.JSX.Element {
  if (conflicts.length === 0) {
    return (
      <div className="rounded bg-brand-green/8 p-3 text-sm text-brand-green">
        تعارضی برای حل کردن وجود ندارد.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-navy-800 text-white">
          <tr>
            <th className="px-3 py-2">سطر منبع</th>
            <th className="px-3 py-2 text-right">عنوان</th>
            <th className="px-3 py-2 text-right">دلیل تعارض</th>
            <th className="px-3 py-2">تصمیم</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((c) => (
            <tr key={c.sourceRow} className="border-b border-borderx">
              <td className="px-3 py-2 text-center">{toPersianDigits(String(c.sourceRow))}</td>
              <td className="px-3 py-2 text-right">{c.title}</td>
              <td className="px-3 py-2 text-right text-xs text-grayx-header">
                {c.matchedNodeId ? (
                  <StatusBadge tone="orange" label={c.reason} showDot={false} />
                ) : (
                  c.reason
                )}
              </td>
              <td className="px-3 py-2">
                <Select
                  className="h-8 text-xs"
                  options={DECISION_OPTIONS}
                  value={decisions[c.sourceRow] ?? 'keep-excel'}
                  onChange={(e) => onChange(c.sourceRow, e.target.value as ConflictDecision)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function decisionsToMappings(
  conflicts: ImportConflict[],
  decisions: Record<number, ConflictDecision>,
): ImportMappingItem[] {
  return conflicts.map((c) => {
    const d = decisions[c.sourceRow] ?? 'keep-excel';
    if (d === 'ignore') return { sourceRow: c.sourceRow, ignore: true };
    if (d === 'keep-existing' && c.matchedNodeId) {
      return { sourceRow: c.sourceRow, matchedNodeId: c.matchedNodeId };
    }
    return { sourceRow: c.sourceRow };
  });
}
