'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { faPercent } from '@/lib/utils';

export interface DonutGaugeProps {
  /** درصد پرشدن گراف (۰..۱۰۰) */
  gaugeValue: number;
  /** مقدار واقعی برای نمایش در مرکز (ممکن است بیش از ۱۰۰ باشد یا null) */
  displayValue: number | null;
  color?: string;
  size?: number;
  label?: string;
  /** متن جایگزین وقتی مقدار null است */
  emptyLabel?: string;
}

export function DonutGauge({
  gaugeValue,
  displayValue,
  color = '#20A55A',
  size = 120,
  label,
  emptyLabel = 'فاقد برنامه',
}: DonutGaugeProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, gaugeValue));
  const data = [
    { name: 'value', value: clamped },
    { name: 'rest', value: 100 - clamped },
  ];
  const inner = Math.round(size * 0.34);
  const outer = Math.round(size * 0.46);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              innerRadius={inner}
              outerRadius={outer}
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={color} />
              <Cell fill="#E7EDF5" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>
            {displayValue === null ? emptyLabel : faPercent(Math.round(displayValue))}
          </span>
        </div>
      </div>
      {label ? <span className="mt-1 text-xs text-grayx-header">{label}</span> : null}
    </div>
  );
}
