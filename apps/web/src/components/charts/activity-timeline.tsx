'use client';

import type { ActivityDto } from '@ppm/contracts';
import {
  ACTIVITY_STATUS_META,
  JALALI_MONTH_NAMES,
  dateToJalali,
  jalaliToGregorian,
  toPersianDigits,
} from '@ppm/contracts';
import { useMemo } from 'react';

export interface Props {
  activities: ActivityDto[];
  reportDateIso: string;
}

interface Tick {
  position: number;
  label: string;
}

export function ActivityTimeline({ activities, reportDateIso }: Props): React.JSX.Element {
  const model = useMemo(() => {
    const items = activities
      .filter((a) => a.startDate && a.endDate)
      .map((a) => ({
        activity: a,
        start: new Date(a.startDate).getTime(),
        end: new Date(a.endDate).getTime(),
      }));

    if (items.length === 0) {
      return null;
    }

    const min = Math.min(...items.map((i) => i.start));
    let max = Math.max(...items.map((i) => i.end));
    if (max <= min) max = min + 86_400_000;
    const span = max - min;

    // ساخت تیک‌های ماهانه جلالی
    const ticks: Tick[] = [];
    const startJ = dateToJalali(new Date(min));
    let jy = startJ.jy;
    let jm = startJ.jm;
    for (let guard = 0; guard < 60; guard += 1) {
      const g = jalaliToGregorian(jy, jm, 1);
      const t = Date.UTC(g.gy, g.gm - 1, g.gd, 12);
      if (t > max) break;
      if (t >= min) {
        ticks.push({
          position: ((t - min) / span) * 100,
          label: `${JALALI_MONTH_NAMES[jm - 1]} ${toPersianDigits(String(jy)).slice(-2)}`,
        });
      }
      jm += 1;
      if (jm > 12) {
        jm = 1;
        jy += 1;
      }
    }

    const reportT = new Date(reportDateIso).getTime();
    const reportPos =
      reportT >= min && reportT <= max ? ((reportT - min) / span) * 100 : null;

    return {
      items: items.map((i) => ({
        ...i,
        left: ((i.start - min) / span) * 100,
        width: Math.max(1.5, ((i.end - i.start) / span) * 100),
      })),
      ticks,
      reportPos,
    };
  }, [activities, reportDateIso]);

  if (!model) {
    return <p className="py-8 text-center text-sm text-grayx-header">فعالیتی برای نمایش نیست.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]" dir="ltr">
        {/* محور ماه‌ها */}
        <div className="relative mb-2 h-5 border-b border-borderx">
          {model.ticks.map((tick, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-grayx-header"
              style={{ left: `${tick.position}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        <div className="relative space-y-2">
          {/* خط تاریخ گزارش */}
          {model.reportPos !== null ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-dashed border-brand-red"
              style={{ left: `${model.reportPos}%` }}
              title="تاریخ گزارش"
            >
              <span className="absolute -top-0 right-1 text-[9px] text-brand-red">گزارش</span>
            </div>
          ) : null}

          {model.items.map(({ activity, left, width }) => {
            const meta = ACTIVITY_STATUS_META[activity.effectiveStatus];
            return (
              <div key={activity.id} className="relative h-7" dir="ltr">
                <div className="absolute inset-0 rounded bg-page" />
                <div
                  className="absolute top-0 flex h-7 items-center rounded px-2 text-[10px] font-medium text-white"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: meta.color }}
                  title={activity.title}
                >
                  <span className="truncate" dir="rtl">
                    {activity.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
