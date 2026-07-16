'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * دیالوگ تعارض نسخه (Optimistic Concurrency). داده کاربر بدون هشدار از بین نمی‌رود:
 * کاربر می‌تواند آخرین نسخه را بارگذاری کند یا تغییرات را نگه دارد.
 */
export function ConflictDialog({
  open,
  message,
  onReload,
  onCancel,
}: {
  open: boolean;
  message?: string;
  onReload: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="تعارض نسخه"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            نگه‌داشتن تغییرات من
          </Button>
          <Button variant="primary" onClick={onReload}>
            بارگذاری آخرین نسخه
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" aria-hidden />
        <p className="text-sm leading-6 text-ink">
          {message ??
            'این مورد توسط کاربر دیگری تغییر کرده است. برای جلوگیری از بازنویسی داده‌ها، می‌توانید آخرین نسخه را بارگذاری کنید یا تغییرات خود را نگه دارید و دوباره تلاش کنید.'}
        </p>
      </div>
    </Modal>
  );
}
