'use client';

import { toPersianDigits } from '@ppm/contracts';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

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
  // برای مقدار صفر، یک قوس بسیار کوچک نمایش داده می‌شود تا Gauge خالی/خراب دیده نشود.
  const arc = clamped <= 0 ? 0.6 : clamped;
  const data = [
    { name: 'value', value: arc },
    { name: 'rest', value: 100 - arc },
  ];
  const inner = Math.round(size * 0.36);
  const outer = Math.round(size * 0.5);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Halo بسیار ظریف هم‌رنگ Gauge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 26px ${color}22`, borderRadius: '9999px' }}
        />
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              innerRadius={inner}
              outerRadius={outer}
              cornerRadius={6}
              paddingAngle={0}
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={color} />
              <Cell fill="#EDF2FA" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {displayValue === null ? (
            <span className="text-sm font-bold" style={{ color }}>
              {emptyLabel}
            </span>
          ) : (
            <span className="flex items-baseline gap-0.5" style={{ color }}>
              <span className="text-3xl font-extrabold tabular-nums leading-none">
                {toPersianDigits(String(Math.round(displayValue)))}
              </span>
              <span className="text-sm font-bold">٪</span>
            </span>
          )}
        </div>
      </div>
      {label ? <span className="mt-1.5 text-xs font-medium text-grayx-header">{label}</span> : null}
    </div>
  );
}
