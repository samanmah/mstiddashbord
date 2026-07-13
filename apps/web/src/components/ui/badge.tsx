import type { ReactNode } from 'react';
import type { LabelColor } from '@ppm/contracts';
import { cn } from '@/lib/utils';

type Tone = LabelColor['tone'];

const toneClass: Record<Tone, string> = {
  green: 'bg-brand-green/12 text-brand-green',
  orange: 'bg-brand-orange/12 text-brand-orange',
  red: 'bg-brand-red/12 text-brand-red',
  yellow: 'bg-brand-yellow/20 text-[#8a7400]',
  blue: 'bg-brand-blue/12 text-brand-blue',
  purple: 'bg-brand-purple/12 text-brand-purple',
  gray: 'bg-grayx-dot/15 text-grayx-header',
};

const dotColor: Record<Tone, string> = {
  green: '#20A55A',
  orange: '#F57C00',
  red: '#E53935',
  yellow: '#FFD400',
  blue: '#2D9CDB',
  purple: '#8E5BD9',
  gray: '#9AA6B2',
};

export interface StatusBadgeProps {
  tone: Tone;
  label: string;
  showDot?: boolean;
  className?: string;
  children?: ReactNode;
}

export function StatusBadge({
  tone,
  label,
  showDot = true,
  className,
}: StatusBadgeProps): React.JSX.Element {
  return (
    <span className={cn('badge', toneClass[tone], className)}>
      {showDot ? (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor[tone] }}
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }): React.JSX.Element {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full"
      style={{ backgroundColor: dotColor[tone] }}
      aria-hidden
    />
  );
}
