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

const PLANNED_COLOR = '#2563EB';
const ACTUAL_COLOR = '#10B981';

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
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF3FA" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => toPersianDigits(String(v))}
            tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={{ stroke: '#DCE4EF' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 10, fill: '#17233C', fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
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
            cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
            contentStyle={{ fontFamily: 'inherit', fontSize: 12 }}
          />
          <Bar dataKey="planned" name="planned" fill={PLANNED_COLOR} radius={[0, 5, 5, 0]}>
            <LabelList
              dataKey="planned"
              position="right"
              formatter={(v: number) => faPercent(v)}
              style={{ fontSize: 10, fill: '#64748B' }}
            />
          </Bar>
          <Bar dataKey="actual" name="actual" fill={ACTUAL_COLOR} radius={[0, 5, 5, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={ACTUAL_COLOR} />
            ))}
            <LabelList
              dataKey="actual"
              position="right"
              formatter={(v: number) => faPercent(v)}
              style={{ fontSize: 10, fill: '#17233C' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
