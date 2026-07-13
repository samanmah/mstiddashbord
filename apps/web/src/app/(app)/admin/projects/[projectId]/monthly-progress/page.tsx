'use client';

import {
  JALALI_MONTH_NAMES,
  monthSortKey,
  toLatinDigits,
  toPersianDigits,
  type MonthlyProgressDto,
} from '@ppm/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { LazyMonthlyLineChart } from '@/components/charts/lazy';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { isApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { monthlyProgressService } from '@/lib/services';
import { faPercent } from '@/lib/utils';

interface Row {
  key: string;
  jalaliYear: number;
  jalaliMonth: number;
  plannedPercent: number | null;
  actualPercent: number | null;
  notes: string | null;
}

function makeLabel(year: number, month: number): string {
  return `${JALALI_MONTH_NAMES[month - 1]} (${year})`;
}

let counter = 0;
function newKey(): string {
  counter += 1;
  return `row-${counter}`;
}

function toRow(dto: MonthlyProgressDto): Row {
  return {
    key: dto.id,
    jalaliYear: dto.jalaliYear,
    jalaliMonth: dto.jalaliMonth,
    plannedPercent: dto.plannedPercent,
    actualPercent: dto.actualPercent,
    notes: dto.notes,
  };
}

function parseNum(value: string): number | null {
  const clean = toLatinDigits(value).replace(/[^0-9.]/g, '');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export default function MonthlyProgressPage({
  params,
}: {
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [newYear, setNewYear] = useState(1405);
  const [newMonth, setNewMonth] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.monthlyProgress(projectId),
    queryFn: () => monthlyProgressService.list(projectId),
  });

  useEffect(() => {
    if (data) {
      setRows([...data].sort((a, b) => a.sortOrder - b.sortOrder).map(toRow));
    }
  }, [data]);

  const previewData = useMemo<MonthlyProgressDto[]>(
    () =>
      rows.map((r) => ({
        id: r.key,
        projectId,
        jalaliYear: r.jalaliYear,
        jalaliMonth: r.jalaliMonth,
        monthLabel: makeLabel(r.jalaliYear, r.jalaliMonth),
        sortOrder: monthSortKey(r.jalaliYear, r.jalaliMonth),
        plannedPercent: r.plannedPercent ?? 0,
        actualPercent: r.actualPercent,
        deviationPercent:
          r.actualPercent === null ? null : r.actualPercent - (r.plannedPercent ?? 0),
        notes: r.notes,
      })),
    [rows, projectId],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = rows.map((r) => ({
        jalaliYear: r.jalaliYear,
        jalaliMonth: r.jalaliMonth,
        monthLabel: makeLabel(r.jalaliYear, r.jalaliMonth),
        plannedPercent: r.plannedPercent ?? 0,
        actualPercent: r.actualPercent,
        notes: r.notes,
      }));
      return monthlyProgressService.bulk(projectId, { items });
    },
    onSuccess: () => {
      toast.success('پیشرفت ماهانه ذخیره شد');
      void queryClient.invalidateQueries({ queryKey: queryKeys.monthlyProgress(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'ذخیره ناموفق بود'),
  });

  const updateRow = (key: string, patch: Partial<Row>): void => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = (): void => {
    const exists = rows.some((r) => r.jalaliYear === newYear && r.jalaliMonth === newMonth);
    if (exists) {
      toast.error('این ماه از قبل وجود دارد');
      return;
    }
    setRows((prev) =>
      [
        ...prev,
        {
          key: newKey(),
          jalaliYear: newYear,
          jalaliMonth: newMonth,
          plannedPercent: 0,
          actualPercent: null,
          notes: null,
        },
      ].sort(
        (a, b) =>
          monthSortKey(a.jalaliYear, a.jalaliMonth) - monthSortKey(b.jalaliYear, b.jalaliMonth),
      ),
    );
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const parsed: Row[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = line.split('\t');
      const label = cells[0] ?? '';
      // پشتیبانی از فرمت «نام‌ماه (سال)» یا «سال<tab>ماه»
      const m = toLatinDigits(label).match(/(.+?)\s*\(\s*(\d{3,4})\s*\)/);
      let year = newYear;
      let month = newMonth;
      if (m) {
        const idx = JALALI_MONTH_NAMES.indexOf(m[1]!.trim());
        if (idx >= 0) {
          month = idx + 1;
          year = Number(m[2]);
        }
      }
      parsed.push({
        key: newKey(),
        jalaliYear: year,
        jalaliMonth: month,
        plannedPercent: parseNum(cells[1] ?? ''),
        actualPercent: parseNum(cells[2] ?? ''),
        notes: cells[3]?.trim() || null,
      });
    }
    if (parsed.length > 0) {
      setRows(parsed.sort((a, b) => monthSortKey(a.jalaliYear, a.jalaliMonth) - monthSortKey(b.jalaliYear, b.jalaliMonth)));
      toast.success(`${toPersianDigits(parsed.length)} ردیف جای‌گذاری شد`);
    }
  };

  if (isLoading) return <FullPageSpinner label="در حال بارگذاری…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const yearOptions = [1404, 1405, 1406, 1407, 1408].map((y) => ({
    value: String(y),
    label: toPersianDigits(y),
  }));
  const monthOptions = JALALI_MONTH_NAMES.map((name, i) => ({
    value: String(i + 1),
    label: name,
  }));

  return (
    <>
      <PageHeader
        title="مدیریت پیشرفت ماهانه"
        description="درصدها باید بین ۰ تا ۱۰۰ باشند. مقدار واقعی می‌تواند خالی بماند."
        action={
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            <Save className="h-4 w-4" /> ذخیرهٔ همه
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-card border border-borderx bg-white p-3">
        <div>
          <label className="label">سال</label>
          <Select
            className="w-28"
            value={String(newYear)}
            onChange={(e) => setNewYear(Number(e.target.value))}
            options={yearOptions}
          />
        </div>
        <div>
          <label className="label">ماه</label>
          <Select
            className="w-32"
            value={String(newMonth)}
            onChange={(e) => setNewMonth(Number(e.target.value))}
            options={monthOptions}
          />
        </div>
        <Button variant="secondary" onClick={addRow}>
          <Plus className="h-4 w-4" /> افزودن ماه
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-right">ماه</th>
                <th className="w-24">برنامه (٪)</th>
                <th className="w-24">واقعی (٪)</th>
                <th className="w-20">انحراف</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const deviation =
                  r.actualPercent === null ? null : r.actualPercent - (r.plannedPercent ?? 0);
                return (
                  <tr key={r.key}>
                    <td className="text-right font-medium">
                      {makeLabel(r.jalaliYear, r.jalaliMonth)}
                    </td>
                    <td>
                      <Input
                        type="number"
                        dir="ltr"
                        className="w-20 text-center"
                        value={r.plannedPercent ?? ''}
                        onChange={(e) =>
                          updateRow(r.key, { plannedPercent: parseNum(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        dir="ltr"
                        className="w-20 text-center"
                        value={r.actualPercent ?? ''}
                        onChange={(e) =>
                          updateRow(r.key, { actualPercent: parseNum(e.target.value) })
                        }
                      />
                    </td>
                    <td
                      className={
                        deviation === null
                          ? 'text-grayx-dot'
                          : deviation < 0
                            ? 'text-brand-red'
                            : 'text-brand-green'
                      }
                    >
                      {deviation === null ? '—' : faPercent(deviation)}
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

        <div className="space-y-4">
          <Card title="پیش‌نمایش زندهٔ نمودار" headerTone="navy">
            {previewData.length > 0 ? (
              <LazyMonthlyLineChart data={previewData} />
            ) : (
              <p className="py-8 text-center text-sm text-grayx-header">داده‌ای برای نمایش نیست.</p>
            )}
          </Card>

          <Card title="جای‌گذاری از Excel" headerTone="gray">
            <p className="mb-2 text-xs text-grayx-header">
              ستون‌ها را از Excel کپی و در کادر زیر Paste کنید. ترتیب: ماه، برنامه، واقعی، توضیح.
            </p>
            <textarea
              className="input min-h-[100px] font-mono text-xs"
              placeholder="تیر (1405)	5	10	توضیح"
              onPaste={handlePaste}
              onChange={() => undefined}
              value=""
            />
          </Card>
        </div>
      </div>
    </>
  );
}
