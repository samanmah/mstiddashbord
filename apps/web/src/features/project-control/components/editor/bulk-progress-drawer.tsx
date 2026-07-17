'use client';

import { dateToJalaliString } from '@ppm/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isApiError } from '@/lib/api-error';
import type { ProgressInput, WbsNodeComputedDto } from '../../api/project-control-types';
import { useBulkProgress } from '../../hooks/use-control-progress';

/** ثبت گروهی پیشرفت: فقط تاریخ گزارش و درصد مشترک. Preview قبل از Commit. */
export function BulkProgressDrawer({
  projectId,
  nodes,
  onDone,
}: {
  projectId: string;
  nodes: WbsNodeComputedDto[];
  onDone: () => void;
}): React.JSX.Element {
  const bulk = useBulkProgress(projectId);
  const [reportingDate, setReportingDate] = useState(() => dateToJalaliString(new Date()));
  const [actualPercent, setActualPercent] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const leaves = nodes.filter((n) => n.computed?.isLeaf !== false);

  const submit = (): void => {
    const pct = Number(actualPercent);
    if (actualPercent.trim() === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('درصد پیشرفت باید بین ۰ تا ۱۰۰ باشد');
      return;
    }
    if (!reportingDate) {
      toast.error('تاریخ گزارش الزامی است');
      return;
    }
    const items: ProgressInput[] = leaves.map((n) => ({
      nodeId: n.id,
      reportingDate,
      actualPercent: pct,
    }));
    bulk.mutate(items, {
      onSuccess: () => {
        toast.success(`پیشرفت ${leaves.length} فعالیت ثبت شد`);
        onDone();
      },
      onError: (e) => toast.error(isApiError(e) ? e.message : 'ثبت گروهی ناموفق بود'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاریخ گزارش" required>
          <JalaliDateInput value={reportingDate} onChange={setReportingDate} />
        </Field>
        <Field label="درصد پیشرفت واقعی" required>
          <Input
            type="number"
            min={0}
            max={100}
            value={actualPercent}
            onChange={(e) => setActualPercent(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-grayx-header">
          {leaves.length} فعالیت برگ از {nodes.length} انتخاب‌شده
        </span>
        <Button variant="secondary" size="sm" onClick={() => setPreviewing((p) => !p)}>
          {previewing ? 'بستن پیش‌نمایش' : 'پیش‌نمایش'}
        </Button>
      </div>

      {previewing ? (
        <ul className="max-h-60 space-y-1 overflow-y-auto rounded border border-borderx p-2 text-xs">
          {leaves.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{n.title}</span>
              <StatusBadge tone="blue" label={`${actualPercent || '۰'}٪`} showDot={false} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-borderx pt-3">
        <Button variant="secondary" onClick={onDone}>
          انصراف
        </Button>
        <Button onClick={submit} loading={bulk.isPending} disabled={leaves.length === 0}>
          ثبت گروهی
        </Button>
      </div>
    </div>
  );
}
