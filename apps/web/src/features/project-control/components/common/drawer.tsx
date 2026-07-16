'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widthClass = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
};

/** پنل کشویی راست‌به‌چپ برای ویرایش نود/ثبت پیشرفت. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg',
}: DrawerProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    document.body.dataset.modalOpen = 'true';
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      delete document.body.dataset.modalOpen;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-start bg-navy-900/40"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'flex h-full w-full flex-col overflow-hidden bg-white shadow-cardhover animate-fade-in',
          widthClass[width],
        )}
      >
        <header className="flex items-start justify-between border-b border-borderx bg-navy-800 px-4 py-3 text-white">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-white/70">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-white/10"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-borderx bg-page px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
