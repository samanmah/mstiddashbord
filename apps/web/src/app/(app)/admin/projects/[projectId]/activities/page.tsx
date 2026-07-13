'use client';

import {
  ACTIVITY_STATUS_META,
  ActivityStatus,
  VALIDATION,
  dateToJalaliString,
  jalaliStringToDate,
  toLatinDigits,
  type ActivityDto,
} from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { JalaliDateInput } from '@/components/admin/jalali-date-input';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { activityService } from '@/lib/services';
import { cn, faPercent } from '@/lib/utils';

interface Row {
  key: string;
  title: string;
  weightPercent: number;
  startDate: string;
  endDate: string;
  plannedPercent: number;
  actualPercent: number;
  statusOverride: ActivityStatus | null;
  notes: string | null;
}

let counter = 0;
const newKey = (): string => `act-${(counter += 1)}`;

function autoStatus(planned: number, actual: number): ActivityStatus {
  if (planned === 0) return ActivityStatus.UNKNOWN;
  const ratio = actual / planned;
  if (ratio < 0.7) return ActivityStatus.WEAK;
  if (ratio < 0.9) return ActivityStatus.AVERAGE;
  return ActivityStatus.GOOD;
}

function toRow(dto: ActivityDto): Row {
  return {
    key: dto.id,
    title: dto.title,
    weightPercent: dto.weightPercent,
    startDate: safeJalali(dto.startDate),
    endDate: safeJalali(dto.endDate),
    plannedPercent: dto.plannedPercent,
    actualPercent: dto.actualPercent,
    statusOverride: dto.statusOverride,
    notes: dto.notes,
  };
}

function safeJalali(iso: string): string {
  try {
    return dateToJalaliString(new Date(iso));
  } catch {
    return '';
  }
}

const STATUS_OPTIONS = [
  { value: 'AUTO', label: 'محاسبه خودکار' },
  { value: ActivityStatus.GOOD, label: 'خوب' },
  { value: ActivityStatus.AVERAGE, label: 'متوسط' },
  { value: ActivityStatus.WEAK, label: 'ضعیف' },
  { value: ActivityStatus.UNKNOWN, label: 'نامشخص' },
];

export default function ActivitiesPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.activities(projectId),
    queryFn: () => activityService.list(projectId),
  });

  useEffect(() => {
    if (data) setRows([...data].sort((a, b) => a.displayOrder - b.displayOrder).map(toRow));
  }, [data]);

  const totals = useMemo(() => {
    const weight = rows.reduce((s, r) => s + (r.weightPercent || 0), 0);
    const weightedPlanned = rows.reduce((s, r) => s + (r.weightPercent * r.plannedPercent) / 100, 0);
    const weightedActual = rows.reduce((s, r) => s + (r.weightPercent * r.actualPercent) / 100, 0);
    return {
      weight,
      remaining: 100 - weight,
      weightedPlanned,
      weightedActual,
      valid: Math.abs(weight - 100) < VALIDATION.WEIGHT_SUM_TOLERANCE,
    };
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = rows.map((r, idx) => ({
        rowNumber: idx + 1,
        title: r.title,
        weightPercent: r.weightPercent,
        startDate: r.startDate,
        endDate: r.endDate,
        plannedPercent: r.plannedPercent,
        actualPercent: r.actualPercent,
        statusOverride: r.statusOverride,
        notes: r.notes,
        displayOrder: idx,
      }));
      return activityService.bulk(projectId, { items });
    },
    onSuccess: () => {
      toast.success('فعالیت‌ها ذخیره شدند');
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود'),
  });

  const updateRow = (key: string, patch: Partial<Row>): void =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, dir: -1 | 1): void => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const addRow = (): void => {
    const today = dateToJalaliString(new Date());
    setRows((prev) => [
      ...prev,
      {
        key: newKey(),
        title: '',
        weightPercent: 0,
        startDate: today,
        endDate: today,
        plannedPercent: 0,
        actualPercent: 0,
        statusOverride: null,
        notes: null,
      },
    ]);
  };

  const validateBeforeSave = (): void => {
    if (rows.length === 0) {
      toast.error('حداقل یک فعالیت لازم است');
      return;
    }
    if (rows.some((r) => r.title.trim() === '')) {
      toast.error('عنوان همهٔ فعالیت‌ها الزامی است');
      return;
    }
    for (const r of rows) {
      try {
        jalaliStringToDate(r.startDate);
        jalaliStringToDate(r.endDate);
      } catch {
        toast.error('تاریخ نامعتبر در یکی از فعالیت‌ها');
        return;
      }
    }
    if (!totals.valid) {
      toast.error(
        `مجموع وزن باید ۱۰۰ باشد. مقدار فعلی: ${faPercent(totals.weight)} (${
          totals.remaining > 0 ? 'کمبود' : 'اضافه'
        } ${faPercent(Math.abs(totals.remaining))})`,
      );
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title="مدیریت فعالیت‌ها"
        description="مجموع وزن فعالیت‌ها باید دقیقاً ۱۰۰ باشد."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={addRow}>
              <Plus className="h-4 w-4" /> افزودن فعالیت
            </Button>
            <Button onClick={validateBeforeSave} loading={saveMutation.isPending}>
              <Save className="h-4 w-4" /> ذخیرهٔ همه
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="مجموع وزن"
          value={faPercent(totals.weight)}
          tone={totals.valid ? 'ok' : 'bad'}
        />
        <SummaryCard
          label="وزن باقی‌مانده"
          value={faPercent(totals.remaining)}
          tone={totals.remaining === 0 ? 'ok' : 'warn'}
        />
        <SummaryCard label="پیشرفت برنامه‌ای وزنی" value={faPercent(totals.weightedPlanned)} tone="neutral" />
        <SummaryCard label="پیشرفت واقعی وزنی" value={faPercent(totals.weightedActual)} tone="neutral" />
      </div>

      <div className="table-wrap card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-16">ترتیب</th>
              <th className="min-w-[180px] text-right">فعالیت</th>
              <th className="w-20">وزن</th>
              <th className="w-32">شروع</th>
              <th className="w-32">پایان</th>
              <th className="w-20">برنامه</th>
              <th className="w-20">واقعی</th>
              <th className="w-36">وضعیت</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const effective = r.statusOverride ?? autoStatus(r.plannedPercent, r.actualPercent);
              const meta = ACTIVITY_STATUS_META[effective];
              return (
                <tr key={r.key}>
                  <td>
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        className="rounded p-1 text-navy-700 hover:bg-page disabled:opacity-30"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        aria-label="بالا"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded p-1 text-navy-700 hover:bg-page disabled:opacity-30"
                        onClick={() => move(idx, 1)}
                        disabled={idx === rows.length - 1}
                        aria-label="پایین"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td>
                    <Input
                      className="text-right"
                      value={r.title}
                      onChange={(e) => updateRow(r.key, { title: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      dir="ltr"
                      className="w-16 text-center"
                      value={r.weightPercent}
                      onChange={(e) =>
                        updateRow(r.key, { weightPercent: Number(toLatinDigits(e.target.value)) || 0 })
                      }
                    />
                  </td>
                  <td>
                    <JalaliDateInput
                      value={r.startDate}
                      onChange={(v) => updateRow(r.key, { startDate: v })}
                    />
                  </td>
                  <td>
                    <JalaliDateInput
                      value={r.endDate}
                      onChange={(v) => updateRow(r.key, { endDate: v })}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      dir="ltr"
                      className="w-16 text-center"
                      value={r.plannedPercent}
                      onChange={(e) =>
                        updateRow(r.key, { plannedPercent: Number(toLatinDigits(e.target.value)) || 0 })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      dir="ltr"
                      className="w-16 text-center"
                      value={r.actualPercent}
                      onChange={(e) =>
                        updateRow(r.key, { actualPercent: Number(toLatinDigits(e.target.value)) || 0 })
                      }
                    />
                  </td>
                  <td>
                    <Select
                      className="w-32"
                      value={r.statusOverride ?? 'AUTO'}
                      onChange={(e) =>
                        updateRow(r.key, {
                          statusOverride:
                            e.target.value === 'AUTO' ? null : (e.target.value as ActivityStatus),
                        })
                      }
                      options={STATUS_OPTIONS}
                    />
                    <span className="mt-1 block text-[10px]" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </td>
                  <td>
                    <button
                      className="rounded p-1.5 text-brand-red hover:bg-page"
                      onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                      aria-label="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'bad' | 'warn' | 'neutral';
}): React.JSX.Element {
  const toneClass = {
    ok: 'text-brand-green',
    bad: 'text-brand-red',
    warn: 'text-brand-orange',
    neutral: 'text-navy-900',
  }[tone];
  return (
    <div className="rounded-card border border-borderx bg-white p-3 text-center">
      <p className="text-xs text-grayx-header">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', toneClass)}>{value}</p>
    </div>
  );
}
