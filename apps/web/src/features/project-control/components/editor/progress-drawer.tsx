'use client';

import { dateToJalaliString } from '@ppm/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isApiError } from '@/lib/api-error';
import {
  ControlNodeStatus,
  CONTROL_NODE_STATUS_LABELS,
  type ProgressInput,
  type WbsNodeComputedDto,
} from '../../api/project-control-types';
import { useCreateProgress } from '../../hooks/use-control-progress';
import { daysToMinutes } from '../../utils/date-format';

const STATUS_OPTIONS = [
  { value: '', label: 'بدون تغییر وضعیت' },
  ...Object.values(ControlNodeStatus).map((s) => ({
    value: s,
    label: CONTROL_NODE_STATUS_LABELS[s],
  })),
];

export function ProgressDrawer({
  projectId,
  node,
  onDone,
}: {
  projectId: string;
  node: WbsNodeComputedDto;
  onDone: () => void;
}): React.JSX.Element {
  const create = useCreateProgress(projectId);
  const [reportingDate, setReportingDate] = useState(() => dateToJalaliString(new Date()));
  const [actualPercent, setActualPercent] = useState(
    node.percentComplete == null ? '' : String(node.percentComplete),
  );
  const [physical, setPhysical] = useState('');
  const [financial, setFinancial] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [remainingDays, setRemainingDays] = useState('');
  const [forecastFinish, setForecastFinish] = useState('');
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

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
    if (actualCost.trim() !== '' && Number(actualCost) < 0) {
      toast.error('هزینهٔ واقعی نمی‌تواند منفی باشد');
      return;
    }
    const body: ProgressInput = {
      nodeId: node.id,
      reportingDate,
      actualPercent: pct,
      physicalProgress: physical.trim() === '' ? null : Number(physical),
      financialProgress: financial.trim() === '' ? null : Number(financial),
      actualCost: actualCost.trim() === '' ? null : actualCost.trim(),
      remainingDurationMinutes:
        remainingDays.trim() === '' ? null : daysToMinutes(Number(remainingDays)),
      forecastFinish: forecastFinish.trim() === '' ? null : forecastFinish,
      status: status === '' ? undefined : (status as ControlNodeStatus),
      comment: comment.trim() === '' ? null : comment.trim(),
      evidenceUrl: evidenceUrl.trim() === '' ? null : evidenceUrl.trim(),
    };
    create.mutate(body, {
      onSuccess: () => {
        toast.success('پیشرفت ثبت شد');
        onDone();
      },
      onError: (e) => toast.error(isApiError(e) ? e.message : 'ثبت پیشرفت ناموفق بود'),
    });
  };

  return (
    <div className="space-y-4">
      {node.computed?.isLeaf === false ? (
        <p className="rounded bg-brand-yellow/15 p-2 text-xs text-[#8a7400]">
          این نود خلاصه است؛ در حالت معمول پیشرفت از فرزندان Rollup می‌شود. ثبت مستقیم فقط در صورت
          اجازهٔ سرور اعمال خواهد شد.
        </p>
      ) : null}
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
        <Field label="پیشرفت فیزیکی">
          <Input type="number" min={0} max={100} value={physical} onChange={(e) => setPhysical(e.target.value)} />
        </Field>
        <Field label="پیشرفت مالی">
          <Input type="number" min={0} max={100} value={financial} onChange={(e) => setFinancial(e.target.value)} />
        </Field>
        <Field label="هزینهٔ واقعی">
          <Input inputMode="numeric" value={actualCost} onChange={(e) => setActualCost(e.target.value)} />
        </Field>
        <Field label="مدت باقی‌مانده (روز)">
          <Input type="number" min={0} value={remainingDays} onChange={(e) => setRemainingDays(e.target.value)} />
        </Field>
        <Field label="پیش‌بینی پایان">
          <JalaliDateInput value={forecastFinish} onChange={setForecastFinish} />
        </Field>
        <Field label="وضعیت">
          <Select options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
        </Field>
      </div>
      <Field label="توضیح">
        <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <Field label="پیوند مستند (Evidence URL)">
        <Input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-borderx pt-3">
        <Button variant="secondary" onClick={onDone}>
          انصراف
        </Button>
        <Button onClick={submit} loading={create.isPending}>
          ثبت پیشرفت
        </Button>
      </div>
    </div>
  );
}
