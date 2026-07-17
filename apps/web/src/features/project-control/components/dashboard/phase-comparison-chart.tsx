'use client';

import { toPersianDigits } from '@ppm/contracts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { faPercent } from '@/lib/utils';
import type { PhaseRollupDto } from '../../api/project-control-types';

const PLANNED_COLOR = '#2563EB';
const ACTUAL_COLOR = '#10B981';

/** نمودار میله‌ای افقی گروهی مقایسهٔ برنامه/واقعی فازها (RTL Label). */
export function PhaseComparisonChart({
  phases,
  onSelect,
}: {
  phases: PhaseRollupDto[];
  onSelect?: (phase: PhaseRollupDto) => void;
}): React.JSX.Element {
  const data = phases.map((p) => ({
    id: p.nodeId,
    name: p.title,
    planned: p.plannedProgress ?? 0,
    actual: p.actualProgress ?? 0,
  }));

  const height = Math.max(220, data.length * 56);

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-4 text-xs">
        <LegendItem color={PLANNED_COLOR} label="برنامه" />
        <LegendItem color={ACTUAL_COLOR} label="واقعی" />
      </div>
      <div style={{ height }} className="w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
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
              orientation="right"
              tick={{ fontSize: 11, fill: '#334155', fontFamily: 'inherit' }}
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip<number, string>
              formatter={(value, name) => [
                typeof value === 'number' ? faPercent(value) : '—',
                name === 'planned' ? 'برنامه' : 'واقعی',
              ]}
              cursor={{ fill: '#F1F5F9' }}
              contentStyle={{ fontFamily: 'inherit', fontSize: 12 }}
            />
            <Bar
              dataKey="planned"
              name="planned"
              fill={PLANNED_COLOR}
              radius={[0, 3, 3, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="actual"
              name="actual"
              fill={ACTUAL_COLOR}
              radius={[0, 3, 3, 0]}
              isAnimationActive={false}
              onClick={(entry: { id?: string }) => {
                const phase = phases.find((p) => p.nodeId === entry.id);
                if (phase && onSelect) onSelect(phase);
              }}
              cursor={onSelect ? 'pointer' : undefined}
            >
              {data.map((d) => (
                <Cell key={d.id} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
