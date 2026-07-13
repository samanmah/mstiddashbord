'use client';

import type { ActivityDto } from '@ppm/contracts';
import { toPersianDigits } from '@ppm/contracts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { faPercent } from '@/lib/utils';

export interface Props {
  data: ActivityDto[];
}

function truncate(text: string, max = 22): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function ActivityBarChart({ data }: Props): React.JSX.Element {
  const rows = [...data]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((a) => ({
      name: truncate(a.title),
      fullName: a.title,
      planned: a.plannedPercent,
      actual: a.actualPercent,
    }));

  const height = Math.max(220, rows.length * 54);

  return (
    <div style={{ height }} dir="ltr" className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF5" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => toPersianDigits(String(v))}
            tick={{ fontSize: 11, fill: '#7D8995', fontFamily: 'inherit' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 10, fill: '#172B4D', fontFamily: 'inherit' }}
            orientation="right"
          />
          <Tooltip<number, string>
            formatter={(value, name) => [
              faPercent(typeof value === 'number' ? value : Number(value)),
              name === 'planned' ? 'برنامه‌ای' : 'واقعی',
            ]}
            labelFormatter={(_label, payload) => {
              const item = payload?.[0]?.payload as { fullName?: string } | undefined;
              return item?.fullName ?? '';
            }}
            contentStyle={{ fontFamily: 'inherit', fontSize: 12 }}
          />
          <Bar dataKey="planned" name="planned" fill="#2D9CDB" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="planned"
              position="right"
              formatter={(v: number) => faPercent(v)}
              style={{ fontSize: 10, fill: '#7D8995' }}
            />
          </Bar>
          <Bar dataKey="actual" name="actual" fill="#17345F" radius={[0, 4, 4, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill="#17345F" />
            ))}
            <LabelList
              dataKey="actual"
              position="right"
              formatter={(v: number) => faPercent(v)}
              style={{ fontSize: 10, fill: '#172B4D' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
