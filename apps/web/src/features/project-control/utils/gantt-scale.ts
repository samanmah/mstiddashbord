/**
 * مقیاس زمانی Gantt: تبدیل تاریخ↔پیکسل و تولید Tickها. خالص و قابل‌تست.
 * ورودی تاریخ‌ها به‌صورت رشتهٔ جلالی است و با jalaliStringToDate به Date میلادی تبدیل می‌شود.
 */
import { jalaliStringToDate } from '@ppm/contracts';

export type GanttZoom = 'day' | 'week' | 'month' | 'quarter';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** عرض پیش‌فرض هر روز (پیکسل) بر حسب سطح Zoom. */
export const PX_PER_DAY: Record<GanttZoom, number> = {
  day: 28,
  week: 10,
  month: 3.2,
  quarter: 1.1,
};

export interface GanttScale {
  minMs: number;
  maxMs: number;
  pxPerDay: number;
  totalWidth: number;
  zoom: GanttZoom;
}

/** ساخت مقیاس از بازهٔ زمانی (ms) و سطح Zoom. */
export function createScale(minMs: number, maxMs: number, zoom: GanttZoom): GanttScale {
  const safeMax = Math.max(maxMs, minMs + MS_PER_DAY);
  const pxPerDay = PX_PER_DAY[zoom];
  const days = (safeMax - minMs) / MS_PER_DAY;
  return {
    minMs,
    maxMs: safeMax,
    pxPerDay,
    totalWidth: Math.ceil(days * pxPerDay),
    zoom,
  };
}

/** تبدیل زمان (ms) به مختصات افقی (پیکسل) نسبت به ابتدای مقیاس. */
export function dateToX(scale: GanttScale, ms: number): number {
  return ((ms - scale.minMs) / MS_PER_DAY) * scale.pxPerDay;
}

/** تبدیل مختصات افقی به زمان (ms). */
export function xToDate(scale: GanttScale, x: number): number {
  return scale.minMs + (x / scale.pxPerDay) * MS_PER_DAY;
}

/** عرض بازهٔ [startMs, endMs] به پیکسل (حداقل ۱px برای دیده‌شدن). */
export function rangeWidth(scale: GanttScale, startMs: number, endMs: number): number {
  return Math.max(1, ((endMs - startMs) / MS_PER_DAY) * scale.pxPerDay);
}

/** تبدیل امن رشتهٔ جلالی به ms؛ null برای مقدار تهی/نامعتبر. */
export function jalaliToMs(value: string | null | undefined): number | null {
  if (!value || value.trim() === '') return null;
  try {
    return jalaliStringToDate(value).getTime();
  } catch {
    return null;
  }
}

/**
 * محاسبهٔ بازهٔ زمانی کل از فهرست تاریخ‌های جلالی (تهی‌ها نادیده گرفته می‌شوند).
 * اگر هیچ تاریخ معتبری نباشد null برمی‌گرداند (بدون بازهٔ جعلی).
 */
export function computeDateRange(
  dates: (string | null | undefined)[],
): { minMs: number; maxMs: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const d of dates) {
    const ms = jalaliToMs(d);
    if (ms == null) continue;
    if (ms < min) min = ms;
    if (ms > max) max = ms;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { minMs: min, maxMs: max };
}

/** گام Tick بر حسب روز، بسته به Zoom. */
const TICK_DAYS: Record<GanttZoom, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 91,
};

export interface GanttTick {
  ms: number;
  x: number;
}

/** تولید Tickهای محور زمان. */
export function generateTicks(scale: GanttScale): GanttTick[] {
  const stepDays = TICK_DAYS[scale.zoom];
  const ticks: GanttTick[] = [];
  const stepMs = stepDays * MS_PER_DAY;
  for (let ms = scale.minMs; ms <= scale.maxMs; ms += stepMs) {
    ticks.push({ ms, x: dateToX(scale, ms) });
  }
  return ticks;
}
