'use client';

import { toPersianDigits } from '@ppm/contracts';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/ui/states';
import { faPercent } from '@/lib/utils';
import type { SCurvePoint } from '../../api/project-control-types';

const SERIES = [
  { key: 'plannedPhysical', label: 'برنامه فیزیکی', color: '#2563EB' },
  { key: 'actualPhysical', label: 'واقعی فیزیکی', color: '#10B981' },
  { key: 'plannedFinancial', label: 'برنامه مالی', color: '#7c3aed' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

/** منحنی S پیشرفت (فیزیکی/مالی) با Marker تاریخ وضعیت. null بدون صفر جعلی. */
export function SCurveChart({
  points,
  statusDate,
}: {
  points: SCurvePoint[];
  statusDate?: string | null;
}): React.JSX.Element {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    plannedPhysical: true,
    actualPhysical: true,
    plannedFinancial: false,
  });

  if (points.length === 0) {
    return (
      <EmptyState
        title="داده‌ای برای منحنی پیشرفت وجود ندارد"
        description="پس از ثبت گزارش‌های دوره‌ای، منحنی S نمایش داده می‌شود."
      />
    );
  }

  const data = points.map((p) => ({
    label: toPersianDigits(p.reportingDate),
    plannedPhysical: p.plannedPhysical,
    actualPhysical: p.actualPhysical,
    plannedFinancial: p.plannedFinancial,
  }));

  const statusLabelFa = statusDate ? toPersianDigits(statusDate) : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-3 text-xs">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
            className="flex items-center gap-1.5 rounded px-2 py-1 transition-opacity hover:bg-page"
            style={{ opacity: visible[s.key] ? 1 : 0.4 }}
            aria-pressed={visible[s.key]}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </button>
        ))}
      </div>
      <div className="h-[280px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF3FA" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'inherit' }}
              tickLine={false}
              axisLine={{ stroke: '#DCE4EF' }}
              angle={-40}
              textAnchor="end"
              interval="preserveStartEnd"
              height={56}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => toPersianDigits(String(v))}
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'inherit' }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip<number, string>
              formatter={(value, name) => {
                const s = SERIES.find((x) => x.key === name);
                return [typeof value === 'number' ? faPercent(value) : '—', s?.label ?? name];
              }}
              cursor={{ stroke: '#94A3B8', strokeDasharray: '4 4' }}
              contentStyle={{ fontFamily: 'inherit', fontSize: 12 }}
            />
            {statusLabelFa ? (
              <ReferenceLine
                x={statusLabelFa}
                stroke="#dc2626"
                strokeDasharray="4 3"
                label={{
                  value: 'تاریخ وضعیت',
                  position: 'top',
                  fontSize: 10,
                  fill: '#dc2626',
                }}
              />
            ) : null}
            {SERIES.filter((s) => visible[s.key]).map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{ r: 2.5, strokeWidth: 0, fill: s.color }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
