'use client';

import type { LabelColor } from '@ppm/contracts';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = LabelColor['tone'] | 'neutral';

const toneAccent: Record<Tone, string> = {
  green: 'text-brand-green',
  orange: 'text-brand-orange',
  red: 'text-brand-red',
  yellow: 'text-[#8a7400]',
  blue: 'text-brand-blue',
  purple: 'text-brand-purple',
  gray: 'text-grayx-header',
  neutral: 'text-navy-900',
};

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** مقدار فشرده برای عرض‌های کوچک؛ در xl مقدار کامل (`value`) نشان داده می‌شود. */
  compactValue?: ReactNode;
  /** متن کامل برای title/aria-label (مثلاً عدد بودجه بدون فشرده‌سازی). */
  valueTitle?: string;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

/** کارت کوچک KPI با مقدار برجسته و برچسب. */
export function MetricCard({
  label,
  value,
  compactValue,
  valueTitle,
  hint,
  tone = 'neutral',
  icon,
  className,
  testId,
}: MetricCardProps): React.JSX.Element {
  const accessible = valueTitle ?? (typeof value === 'string' ? value : undefined);
  return (
    <div
      data-testid={testId}
      title={accessible}
      className={cn('card flex min-w-0 flex-col gap-1 overflow-hidden p-3 sm:p-4', className)}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 text-xs text-grayx-header">{label}</span>
        {icon ? <span className={cn('shrink-0', toneAccent[tone])}>{icon}</span> : null}
      </div>
      <span
        data-testid="metric-card-value"
        aria-label={accessible}
        title={accessible}
        className={cn(
          'min-w-0 max-w-full break-words font-bold tabular-nums leading-snug',
          'text-[clamp(0.8rem,2.4vw,1.25rem)]',
          toneAccent[tone],
        )}
      >
        {compactValue != null ? (
          <>
            <span className="xl:hidden">{compactValue}</span>
            <span className="hidden xl:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </span>
      {hint ? <span className="text-[11px] text-grayx-header">{hint}</span> : null}
    </div>
  );
}
