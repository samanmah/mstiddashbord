'use client';

import type { MonthlyProgressDto } from '@ppm/contracts';
import { toPersianDigits } from '@ppm/contracts';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { faPercent } from '@/lib/utils';

export interface Props {
  data: MonthlyProgressDto[];
}

const PLANNED_COLOR = '#2563EB';
const ACTUAL_COLOR = '#10B981';

interface Point {
  label: string;
  planned: number;
  actual: number | null;
}

export function MonthlyLineChart({ data }: Props): React.JSX.Element {
  const [showPlanned, setShowPlanned] = useState(true);
  const [showActual, setShowActual] = useState(true);

  const points: Point[] = [...data]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      label: m.monthLabel,
      planned: m.plannedPercent,
      actual: m.actualPercent,
    }));

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-4 text-xs">
        <LegendToggle
          active={showPlanned}
          color={PLANNED_COLOR}
          label="برنامه"
          onClick={() => setShowPlanned((v) => !v)}
        />
        <LegendToggle
          active={showActual}
          color={ACTUAL_COLOR}
          label="واقعی"
          onClick={() => setShowActual((v) => !v)}
        />
      </div>
      <div className="h-[240px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 12, left: 4, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF3FA" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'inherit' }}
              tickLine={false}
              axisLine={{ stroke: '#DCE4EF' }}
              angle={-40}
              textAnchor="end"
              interval={0}
              height={50}
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
              formatter={(value, name) => [
                typeof value === 'number' ? faPercent(value) : '—',
                name === 'planned' ? 'برنامه' : 'واقعی',
              ]}
              cursor={{ stroke: '#94A3B8', strokeDasharray: '4 4' }}
              labelStyle={{ fontFamily: 'inherit' }}
              contentStyle={{ fontFamily: 'inherit', fontSize: 12 }}
            />
            {showPlanned ? (
              <Line
                type="monotone"
                dataKey="planned"
                name="planned"
                stroke={PLANNED_COLOR}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: PLANNED_COLOR }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ) : null}
            {showActual ? (
              <Line
                type="monotone"
                dataKey="actual"
                name="actual"
                stroke={ACTUAL_COLOR}
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: ACTUAL_COLOR }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendToggle({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded px-2 py-1 transition-opacity hover:bg-page"
      style={{ opacity: active ? 1 : 0.4 }}
      aria-pressed={active}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </button>
  );
}
