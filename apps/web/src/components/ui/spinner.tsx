import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-navy-700', className)} aria-hidden />;
}

export function FullPageSpinner({ label }: { label?: string }): React.JSX.Element {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-grayx-header">
      <Spinner className="h-8 w-8" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
