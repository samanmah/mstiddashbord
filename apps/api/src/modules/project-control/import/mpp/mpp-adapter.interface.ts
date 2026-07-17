/**
 * قرارداد Adapter فایل MPP. پیاده‌سازی واقعی مبتنی بر MPXJ (Java) است اما تمام مصرف‌کنندگان
 * (Service/CLI/Test) فقط به این Interface وابسته‌اند تا تست‌ها به Java روی سیستم توسعه
 * وابسته نباشند.
 */
import { type MppEnvironmentStatus, type MppParseResult } from '@ppm/contracts';

export abstract class MppAdapter {
  /** بررسی محیط اجرا (Java/MPXJ/نسخه). هرگز استثنا پرتاب نمی‌کند. */
  abstract checkEnvironment(): Promise<MppEnvironmentStatus>;

  /**
   * تجزیهٔ فایل MPP از روی مسیر امن.
   * اگر محیط (Java/MPXJ) در دسترس نباشد باید خطای کنترل‌شدهٔ فارسی پرتاب کند، نه Crash.
   */
  abstract parse(filePath: string): Promise<MppParseResult>;
}

/** Token تزریق برای Nest DI. */
export const MPP_ADAPTER = Symbol('MPP_ADAPTER');
