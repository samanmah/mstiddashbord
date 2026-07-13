import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type HeaderTone = 'navy' | 'orange' | 'gray' | 'green';

const headerToneClass: Record<HeaderTone, string> = {
  navy: 'bg-navy-800',
  orange: 'bg-brand-orange',
  gray: 'bg-grayx-header',
  green: 'bg-brand-green',
};

export interface CardProps {
  title?: ReactNode;
  headerTone?: HeaderTone;
  headerAction?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({
  title,
  headerTone = 'navy',
  headerAction,
  className,
  bodyClassName,
  children,
}: CardProps): React.JSX.Element {
  return (
    <section className={cn('card flex flex-col overflow-hidden', className)}>
      {title !== undefined ? (
        <header className={cn('card-header', headerToneClass[headerTone])}>
          <h2 className="truncate">{title}</h2>
          {headerAction ? <div className="flex items-center gap-1">{headerAction}</div> : null}
        </header>
      ) : null}
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
