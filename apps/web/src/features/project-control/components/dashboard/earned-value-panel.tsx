'use client';

import { formatNumber, toPersianDigits } from '@ppm/contracts';
import { EmptyState } from '@/components/ui/states';
import type { NodeComputation } from '../../api/project-control-types';
import type { LabelColor } from '@ppm/contracts';
import { indexTone } from '../../utils/control-status';
import { formatIndex } from '../../utils/progress-format';

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return toPersianDigits(formatNumber(Math.round(value), 0));
}

const toneClass: Record<LabelColor['tone'], string> = {
  green: 'text-brand-green',
  orange: 'text-brand-orange',
  red: 'text-brand-red',
  yellow: 'text-[#8a7400]',
  blue: 'text-brand-blue',
  purple: 'text-brand-purple',
  gray: 'text-grayx-header',
};

/** پنل تحلیل ارزش کسب‌شده (EVM). فقط با داده معتبر نمایش داده می‌شود. */
export function EarnedValuePanel({
  root,
}: {
  root: NodeComputation | null | undefined;
}): React.JSX.Element {
  const hasData =
    root != null && (root.pv != null || root.ev != null || root.ac != null);

  if (!hasData) {
    return (
      <EmptyState
        title="داده کافی برای تحلیل ارزش کسب‌شده وجود ندارد"
        description="برای محاسبهٔ EVM به بودجه، وزن و پیشرفت واقعی نیاز است."
      />
    );
  }

  const items: { label: string; value: string; hint?: string }[] = [
    { label: 'ارزش برنامه‌ای (PV)', value: money(root.pv) },
    { label: 'ارزش کسب‌شده (EV)', value: money(root.ev) },
    { label: 'هزینه واقعی (AC)', value: money(root.ac) },
    { label: 'انحراف زمان‌بندی (SV)', value: money(root.sv) },
    { label: 'انحراف هزینه (CV)', value: money(root.cv) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="rounded-card border border-borderx p-3">
            <div className="text-[11px] text-grayx-header">{it.label}</div>
            <div className="mt-1 text-base font-bold tabular-nums text-navy-900">{it.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-borderx p-3">
          <div className="text-[11px] text-grayx-header">شاخص عملکرد زمان (SPI)</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${toneClass[indexTone(root.spi)]}`}>
            {formatIndex(root.spi)}
          </div>
        </div>
        <div className="rounded-card border border-borderx p-3">
          <div className="text-[11px] text-grayx-header">شاخص عملکرد هزینه (CPI)</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${toneClass[indexTone(root.cpi)]}`}>
            {formatIndex(root.cpi)}
          </div>
        </div>
      </div>
    </div>
  );
}
