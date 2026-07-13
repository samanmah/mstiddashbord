'use client';

import type { AuditLogDto } from '@ppm/contracts';
import { AuditAction, jalaliStringToDate } from '@ppm/contracts';
import { useQuery } from '@tanstack/react-query';
import { Eye, Filter } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import type { AuditQuery } from '@/lib/services';
import { auditService } from '@/lib/services';
import { isoToJalaliFa } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  LOGIN: 'ورود',
  LOGOUT: 'خروج',
  LOGIN_FAILED: 'ورود ناموفق',
  IMPORT: 'ورود فایل',
  EXPORT: 'خروجی',
  PASSWORD_RESET: 'بازنشانی رمز',
  PASSWORD_CHANGE: 'تغییر رمز',
};

const ACTION_OPTIONS = [
  { value: '', label: 'همهٔ عملیات' },
  ...Object.values(AuditAction).map((a) => ({ value: a, label: ACTION_LABELS[a] ?? a })),
];

export default function AuditLogPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [fromJalali, setFromJalali] = useState('');
  const [toJalali, setToJalali] = useState('');
  const [applied, setApplied] = useState<AuditQuery>({});
  const [detail, setDetail] = useState<AuditLogDto | null>(null);

  const query: AuditQuery = { ...applied, page, pageSize: 15 };
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', query],
    queryFn: () => auditService.list(query),
  });

  const applyFilters = (): void => {
    const next: AuditQuery = {};
    if (entityType.trim()) next.entityType = entityType.trim();
    if (action) next.action = action;
    try {
      if (fromJalali.trim()) next.from = jalaliStringToDate(fromJalali).toISOString();
      if (toJalali.trim()) next.to = jalaliStringToDate(toJalali).toISOString();
    } catch {
      toast.error('تاریخ فیلتر نامعتبر است');
      return;
    }
    setApplied(next);
    setPage(1);
  };

  const resetFilters = (): void => {
    setEntityType('');
    setAction('');
    setFromJalali('');
    setToJalali('');
    setApplied({});
    setPage(1);
  };

  return (
    <>
      <PageHeader title="تاریخچهٔ تغییرات" description="گزارش کامل عملیات ثبت‌شده در سامانه" />

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-card border border-borderx bg-white p-4 md:grid-cols-5">
        <Field label="نوع موجودیت">
          <Input placeholder="مثلاً Activity" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        </Field>
        <Field label="عملیات">
          <Select options={ACTION_OPTIONS} value={action} onChange={(e) => setAction(e.target.value)} />
        </Field>
        <Field label="از تاریخ">
          <JalaliDateInput value={fromJalali} onChange={setFromJalali} />
        </Field>
        <Field label="تا تاریخ">
          <JalaliDateInput value={toJalali} onChange={setToJalali} />
        </Field>
        <div className="flex items-end gap-2">
          <Button onClick={applyFilters}>
            <Filter className="h-4 w-4" /> اعمال
          </Button>
          <Button variant="secondary" onClick={resetFilters}>
            پاک‌سازی
          </Button>
        </div>
      </div>

      {isLoading ? (
        <FullPageSpinner label="در حال بارگذاری…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="رکوردی یافت نشد" />
      ) : (
        <>
          <div className="table-wrap card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>کاربر</th>
                  <th>موجودیت</th>
                  <th>عملیات</th>
                  <th>IP</th>
                  <th className="w-20">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td>{isoToJalaliFa(log.createdAt)}</td>
                    <td>{log.userFullName ?? '—'}</td>
                    <td>{log.entityType}</td>
                    <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td dir="ltr">{log.ipAddress ?? '—'}</td>
                    <td>
                      <button
                        className="rounded p-1.5 text-navy-700 hover:bg-page"
                        onClick={() => setDetail(log)}
                        aria-label="مشاهدهٔ جزئیات"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-grayx-header">مجموع: {data.total} رکورد</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                قبلی
              </Button>
              <span>
                صفحهٔ {data.page} از {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </Button>
            </div>
          </div>
        </>
      )}

      {detail ? (
        <Modal open onClose={() => setDetail(null)} title="جزئیات تغییر" size="lg">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-brand-red">داده قبل</h3>
              <pre className="max-h-80 overflow-auto rounded-lg bg-page p-3 text-xs" dir="ltr">
                {detail.oldValue ? JSON.stringify(detail.oldValue, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-brand-green">داده بعد</h3>
              <pre className="max-h-80 overflow-auto rounded-lg bg-page p-3 text-xs" dir="ltr">
                {detail.newValue ? JSON.stringify(detail.newValue, null, 2) : '—'}
              </pre>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-grayx-header">
            <span>User Agent:</span>
            <span dir="ltr" className="truncate">
              {detail.userAgent ?? '—'}
            </span>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
