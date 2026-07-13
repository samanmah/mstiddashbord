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
          color="#2D9CDB"
          label="برنامه"
          onClick={() => setShowPlanned((v) => !v)}
        />
        <LegendToggle
          active={showActual}
          color="#17345F"
          label="واقعی"
          onClick={() => setShowActual((v) => !v)}
        />
      </div>
      <div className="h-[240px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 12, left: 4, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF5" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#7D8995', fontFamily: 'inherit' }}
              angle={-40}
              textAnchor="end"
              interval={0}
              height={50}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => toPersianDigits(String(v))}
              tick={{ fontSize: 11, fill: '#7D8995', fontFamily: 'inherit' }}
              width={34}
            />
            <Tooltip<number, string>
              formatter={(value, name) => [
                typeof value === 'number' ? faPercent(value) : '—',
                name === 'planned' ? 'برنامه' : 'واقعی',
              ]}
              labelStyle={{ fontFamily: 'inherit' }}
              contentStyle={{ fontFamily: 'inherit', fontSize: 12 }}
            />
            {showPlanned ? (
              <Line
                type="monotone"
                dataKey="planned"
                name="planned"
                stroke="#2D9CDB"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            ) : null}
            {showActual ? (
              <Line
                type="monotone"
                dataKey="actual"
                name="actual"
                stroke="#17345F"
                strokeWidth={2.5}
                dot={{ r: 3 }}
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
