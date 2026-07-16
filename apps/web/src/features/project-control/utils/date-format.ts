/**
 * کمک‌توابع نمایش/تبدیل تاریخ و مدت برای «کنترل پروژه».
 * ورودی تاریخ‌ها رشتهٔ جلالی (YYYY/MM/DD) از Backend است.
 */
import { EMPTY_PLACEHOLDER, toPersianDigits } from '@ppm/contracts';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

/** نمایش رشتهٔ جلالی با ارقام فارسی، یا «—» برای null. */
export function jalaliFa(value: string | null | undefined): string {
  if (!value || value.trim() === '') return EMPTY_PLACEHOLDER;
  return toPersianDigits(value);
}

/** تبدیل دقیقه به روز (ممیز اعشاری حذف‌نشده). null-safe. */
export function minutesToDays(minutes: number | null | undefined): number | null {
  if (minutes == null || Number.isNaN(minutes)) return null;
  return minutes / MINUTES_PER_DAY;
}

/** تبدیل روز به دقیقه. */
export function daysToMinutes(days: number | null | undefined): number | null {
  if (days == null || Number.isNaN(days)) return null;
  return Math.round(days * MINUTES_PER_DAY);
}

/** نمایش مدت (دقیقه) به‌صورت «n روز» با ارقام فارسی. */
export function formatDurationFa(minutes: number | null | undefined): string {
  const days = minutesToDays(minutes);
  if (days == null) return EMPTY_PLACEHOLDER;
  const rounded = Math.round(days * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${toPersianDigits(text)} روز`;
}

/** تبدیل Lag دقیقه‌ای به «روز» برای نمایش در UI (Backend دقیقه ذخیره می‌کند). */
export function lagMinutesToDays(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_DAY) * 100) / 100;
}

/** تبدیل روز واردشده در UI به دقیقه برای ارسال به Backend. */
export function lagDaysToMinutes(days: number): number {
  return Math.round(days * MINUTES_PER_DAY);
}

/** تبدیل ساعت به دقیقه. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * MINUTES_PER_HOUR);
}

/** نمایش Lag به‌صورت خوانا (روز/ساعت). */
export function formatLagFa(minutes: number | null | undefined): string {
  if (minutes == null || minutes === 0) return toPersianDigits('0');
  const days = lagMinutesToDays(minutes);
  const text = Number.isInteger(days) ? String(days) : days.toFixed(2);
  return `${toPersianDigits(text)} روز`;
}
