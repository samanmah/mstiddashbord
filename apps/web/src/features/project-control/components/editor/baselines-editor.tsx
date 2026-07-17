'use client';

import { dateToJalaliString } from '@ppm/contracts';
import { AlertTriangle, CheckCircle2, GitCompare, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field } from '@/components/admin/field';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { faNumber, isoToJalaliFa } from '@/lib/utils';
import {
  useActivateBaseline,
  useBaselineCompare,
  useBaselines,
  useCreateBaseline,
} from '../../hooks/use-control-baselines';
import { useDataQuality } from '../../hooks/use-control-dashboard';
import { dataQualityIssueCount } from '../../utils/control-status';
import { jalaliFa } from '../../utils/date-format';
import { formatPercent } from '../../utils/progress-format';

export function BaselinesEditor({
  projectId,
  isEditor,
}: {
  projectId: string;
  isEditor: boolean;
}): React.JSX.Element {
  const baselines = useBaselines(projectId);
  const activate = useActivateBaseline(projectId);
  const [creating, setCreating] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  if (baselines.isLoading) return <FullPageSpinner label="در حال بارگذاری خطوط مبنا…" />;
  if (baselines.isError) {
    return <ErrorState error={baselines.error} onRetry={() => void baselines.refetch()} />;
  }

  const rows = baselines.data ?? [];

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between p-3">
        <span className="text-sm font-bold text-navy-900">خطوط مبنا (Baselines)</span>
        {isEditor ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> ایجاد خط مبنا
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="خط مبنایی ثبت نشده است" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-navy-800 text-white">
              <tr>
                <th className="px-3 py-2">شماره</th>
                <th className="px-3 py-2 text-right">عنوان</th>
                <th className="px-3 py-2">تاریخ وضعیت</th>
                <th className="px-3 py-2">ایجاد</th>
                <th className="px-3 py-2">وضعیت</th>
                <th className="px-3 py-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-borderx hover:bg-page">
                  <td className="px-3 py-2 text-center">{faNumber(b.baselineNumber)}</td>
                  <td className="px-3 py-2 text-right">{b.title}</td>
                  <td className="px-3 py-2 text-center">{jalaliFa(b.statusDate)}</td>
                  <td className="px-3 py-2 text-center">{isoToJalaliFa(b.createdAt)}</td>
                  <td className="px-3 py-2 text-center">
                    {b.isActive ? (
                      <StatusBadge tone="green" label="فعال" />
                    ) : (
                      <StatusBadge tone="gray" label="غیرفعال" showDot={false} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setCompareId(b.id)}>
                        <GitCompare className="h-3.5 w-3.5" /> مقایسه
                      </Button>
                      {isEditor && !b.isActive ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            activate.mutate(b.id, {
                              onSuccess: () => toast.success('خط مبنا فعال شد'),
                              onError: (e) =>
                                toast.error(isApiError(e) ? e.message : 'فعال‌سازی ناموفق بود'),
                            })
                          }
                          loading={activate.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> فعال‌سازی
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <CreateBaselineModal projectId={projectId} onClose={() => setCreating(false)} />
      ) : null}
      {compareId ? (
        <CompareModal projectId={projectId} baselineId={compareId} onClose={() => setCompareId(null)} />
      ) : null}
    </div>
  );
}

function CreateBaselineModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}): React.JSX.Element {
  const create = useCreateBaseline(projectId);
  const dq = useDataQuality(projectId);
  const [title, setTitle] = useState('خط مبنا');
  const [statusDate, setStatusDate] = useState(() => dateToJalaliString(new Date()));

  const report = dq.data;
  const warnings: string[] = [];
  if (report) {
    if (report.nodesWithoutDates > 0)
      warnings.push(`${faNumber(report.nodesWithoutDates)} فعالیت بدون تاریخ`);
    if (report.nodesWithoutWeight > 0)
      warnings.push(`${faNumber(report.nodesWithoutWeight)} فعالیت بدون وزن`);
    if (report.invalidDependencies > 0)
      warnings.push(`${faNumber(report.invalidDependencies)} وابستگی نامعتبر`);
    if (report.unbalancedWeightParents > 0)
      warnings.push(`${faNumber(report.unbalancedWeightParents)} والد با وزن نامتوازن`);
  }
  const issueCount = dataQualityIssueCount(report);

  const submit = (): void => {
    if (!title.trim()) {
      toast.error('عنوان الزامی است');
      return;
    }
    create.mutate(
      { title: title.trim(), statusDate },
      {
        onSuccess: () => {
          toast.success('خط مبنا ایجاد شد');
          onClose();
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'ایجاد ناموفق بود'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="ایجاد خط مبنا"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            ایجاد خط مبنا
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="عنوان" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="تاریخ وضعیت" required>
          <JalaliDateInput value={statusDate} onChange={setStatusDate} />
        </Field>
        {warnings.length > 0 ? (
          <div className="space-y-1 rounded bg-brand-yellow/15 p-2">
            <p className="text-xs font-bold text-[#8a7400]">
              پیش از ثبت خط مبنا این هشدارها را بررسی کنید:
            </p>
            {warnings.map((w) => (
              <p key={w} className="flex items-center gap-1 text-xs text-[#8a7400]">
                <AlertTriangle className="h-3.5 w-3.5" /> {w}
              </p>
            ))}
          </div>
        ) : issueCount === 0 ? (
          <p className="text-xs text-brand-green">کیفیت داده مناسب است.</p>
        ) : null}
      </div>
    </Modal>
  );
}

function CompareModal({
  projectId,
  baselineId,
  onClose,
}: {
  projectId: string;
  baselineId: string;
  onClose: () => void;
}): React.JSX.Element {
  const compare = useBaselineCompare(projectId, baselineId);
  const rows = compare.data ?? [];
  const changed = rows.filter(
    (r) =>
      r.baselinePlannedFinish !== r.currentPlannedFinish || r.baselineWeight !== r.currentWeight,
  );

  return (
    <Modal open onClose={onClose} title="مقایسهٔ خط مبنا با وضعیت فعلی" size="xl">
      {compare.isLoading ? (
        <FullPageSpinner label="در حال بارگذاری…" />
      ) : changed.length === 0 ? (
        <EmptyState title="تفاوتی نسبت به خط مبنا یافت نشد" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-navy-800 text-white">
              <tr>
                <th className="px-3 py-2 text-right">فعالیت</th>
                <th className="px-3 py-2">پایان (مبنا)</th>
                <th className="px-3 py-2">پایان (فعلی)</th>
                <th className="px-3 py-2">وزن (مبنا)</th>
                <th className="px-3 py-2">وزن (فعلی)</th>
              </tr>
            </thead>
            <tbody>
              {changed.map((r) => (
                <tr key={r.nodeId} className="border-b border-borderx">
                  <td className="px-3 py-2 text-right">{r.title ?? r.nodeId}</td>
                  <td className="px-3 py-2 text-center">{isoToJalaliFa(r.baselinePlannedFinish)}</td>
                  <td className="px-3 py-2 text-center font-medium">
                    {isoToJalaliFa(r.currentPlannedFinish)}
                  </td>
                  <td className="px-3 py-2 text-center">{formatPercent(r.baselineWeight, 1)}</td>
                  <td className="px-3 py-2 text-center font-medium">
                    {formatPercent(r.currentWeight, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
