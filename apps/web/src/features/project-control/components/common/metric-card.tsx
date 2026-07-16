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
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}

/** کارت کوچک KPI با مقدار برجسته و برچسب. */
export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  className,
}: MetricCardProps): React.JSX.Element {
  return (
    <div className={cn('card flex flex-col gap-1 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-grayx-header">{label}</span>
        {icon ? <span className={toneAccent[tone]}>{icon}</span> : null}
      </div>
      <span className={cn('text-xl font-bold tabular-nums', toneAccent[tone])}>{value}</span>
      {hint ? <span className="text-[11px] text-grayx-header">{hint}</span> : null}
    </div>
  );
}
