/**
 * قالب‌بندی درصد، انحراف، شاخص‌ها و بودجه برای «کنترل پروژه».
 * تمام توابع null-safe هستند و برای مقادیر تهی «—» برمی‌گردانند (صفر جعلی نمایش نمی‌دهیم).
 */
import { EMPTY_PLACEHOLDER, formatNumber, toPersianDigits } from '@ppm/contracts';

/** درصد با علامت ٪ و ارقام فارسی؛ null → «—». */
export function formatPercent(value: number | null | undefined, fractionDigits = 0): string {
  if (value == null || Number.isNaN(value)) return EMPTY_PLACEHOLDER;
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(fractionDigits));
  const digits = Number.isInteger(rounded) ? 0 : fractionDigits;
  return `${toPersianDigits(formatNumber(rounded, digits))}٪`;
}

/** انحراف درصدی با علامت صریح (+/−). */
export function formatVariance(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || Number.isNaN(value)) return EMPTY_PLACEHOLDER;
  const rounded = Number(value.toFixed(fractionDigits));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${toPersianDigits(formatNumber(rounded, Number.isInteger(rounded) ? 0 : fractionDigits))}٪`;
}

/** شاخص SPI/CPI با دو رقم اعشار؛ null → «—». */
export function formatIndex(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return EMPTY_PLACEHOLDER;
  return toPersianDigits(value.toFixed(2));
}

/** نمایش تعداد صحیح با ارقام فارسی. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return EMPTY_PLACEHOLDER;
  return toPersianDigits(formatNumber(value, 0));
}

/**
 * نمایش بودجه/هزینه. مقدار به‌صورت رشتهٔ عددی (برای حفظ دقت) از Backend می‌آید.
 * خروجی با جداکنندهٔ هزارگان و ارقام فارسی؛ null یا رشتهٔ نامعتبر → «—».
 */
export function formatMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return EMPTY_PLACEHOLDER;
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return EMPTY_PLACEHOLDER;
  return toPersianDigits(formatNumber(num, 0));
}

/** روزهای تأخیر: مثبت = تأخیر. */
export function formatDelayDays(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return EMPTY_PLACEHOLDER;
  const rounded = Math.round(value);
  return toPersianDigits(formatNumber(rounded, 0));
}
