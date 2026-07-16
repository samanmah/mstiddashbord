/**
 * تشخیص محیط اجرای MPP (Java Runtime + Helper Jar مبتنی بر MPXJ).
 * تمام فراخوانی‌ها با execFile (بدون Shell) انجام می‌شود تا Command Injection ممکن نباشد.
 */
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { MPP_ADAPTER_VERSION, type MppEnvironmentStatus } from '@ppm/contracts';

const JAVA_TIMEOUT_MS = 5000;

function run(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : error
              ? 1
              : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

/** استخراج نسخهٔ Java از خروجی `java -version` (که روی stderr چاپ می‌شود). */
export function parseJavaVersion(output: string): string | null {
  const match = output.match(/version\s+"([^"]+)"/i) ?? output.match(/openjdk\s+([0-9._]+)/i);
  return match ? match[1]! : null;
}

/** آیا Java در PATH موجود و قابل اجراست؟ */
export async function detectJava(): Promise<{ available: boolean; version: string | null }> {
  try {
    const { code, stdout, stderr } = await run('java', ['-version'], JAVA_TIMEOUT_MS);
    if (code !== 0) return { available: false, version: null };
    return { available: true, version: parseJavaVersion(`${stderr}\n${stdout}`) };
  } catch {
    return { available: false, version: null };
  }
}

/** مسیر Helper Jar مبتنی بر MPXJ از متغیر محیطی (اختیاری). */
export function mpxjHelperJarPath(): string | null {
  const p = process.env.MPXJ_HELPER_JAR;
  return p && p.trim().length > 0 ? p.trim() : null;
}

async function fileReadable(path: string): Promise<boolean> {
  try {
    await access(path, FS.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** بررسی کامل محیط MPP و ساخت پیام فارسی وضعیت. */
export async function checkMppEnvironment(): Promise<MppEnvironmentStatus> {
  const java = await detectJava();
  const jarPath = mpxjHelperJarPath();
  const mpxjAvailable = jarPath !== null && (await fileReadable(jarPath));

  let message: string;
  if (!java.available) {
    message =
      'Java روی این سیستم نصب نیست؛ تجزیهٔ فایل MPP در دسترس نیست. برای فعال‌سازی، ' +
      'یک Java Runtime نصب و متغیر MPXJ_HELPER_JAR را تنظیم کنید.';
  } else if (!mpxjAvailable) {
    message =
      `Java شناسایی شد (${java.version ?? 'نامشخص'}) اما Helper Jar مبتنی بر MPXJ پیدا نشد؛ ` +
      'متغیر محیطی MPXJ_HELPER_JAR را به مسیر jar تنظیم کنید.';
  } else {
    message = `محیط MPP آماده است (Java ${java.version ?? 'نامشخص'}, MPXJ Helper موجود).`;
  }

  return {
    javaAvailable: java.available,
    javaVersion: java.version,
    adapterPresent: true,
    adapterVersion: MPP_ADAPTER_VERSION,
    mpxjAvailable,
    message,
  };
}
