'use client';

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { isApiError } from '@/lib/api-error';
import { Button } from './button';

export function EmptyState({
  title = 'موردی برای نمایش وجود ندارد',
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-grayx-header">
      <div className="text-grayx-dot">{icon ?? <Inbox className="h-8 w-8" aria-hidden />}</div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="text-xs">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}): React.JSX.Element {
  const message = isApiError(error)
    ? error.message
    : 'در دریافت اطلاعات خطایی رخ داد. لطفاً دوباره تلاش کنید.';
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-brand-red" aria-hidden />
      <p className="text-sm font-medium text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          تلاش دوباره
        </Button>
      ) : null}
    </div>
  );
}
