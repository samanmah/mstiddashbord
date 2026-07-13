import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  required,
  hint,
  className,
  children,
}: FieldProps): React.JSX.Element {
  return (
    <div className={cn('w-full', className)}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-brand-red"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-grayx-header">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
