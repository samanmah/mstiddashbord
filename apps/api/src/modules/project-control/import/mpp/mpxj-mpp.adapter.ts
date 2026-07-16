import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ErrorCode,
  MPP_ADAPTER_VERSION,
  type MppEnvironmentStatus,
  type MppParseResult,
} from '@ppm/contracts';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { MppAdapter } from './mpp-adapter.interface';
import { checkMppEnvironment, mpxjHelperJarPath } from './mpp-environment';

const PARSE_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

/**
 * Adapter واقعی MPP مبتنی بر MPXJ که از طریق یک Helper Jar (java -jar) اجرا می‌شود.
 * مسیر فایل هرگز وارد Shell نمی‌شود (execFile با آرایهٔ آرگومان).
 * در نبود Java/MPXJ خطای کنترل‌شدهٔ فارسی پرتاب می‌شود.
 */
@Injectable()
export class MpxjMppAdapter extends MppAdapter {
  private readonly logger = new Logger(MpxjMppAdapter.name);
  readonly parserVersion = MPP_ADAPTER_VERSION;

  checkEnvironment(): Promise<MppEnvironmentStatus> {
    return checkMppEnvironment();
  }

  async parse(filePath: string): Promise<MppParseResult> {
    const env = await this.checkEnvironment();
    if (!env.javaAvailable || !env.mpxjAvailable) {
      // خطای کنترل‌شده — نه Crash.
      throw new ServiceUnavailableException({
        code: ErrorCode.IMPORT_ERROR,
        message: env.message,
      });
    }

    try {
      await access(filePath, FS.R_OK);
    } catch {
      throw new ServiceUnavailableException({
        code: ErrorCode.FILE_INVALID,
        message: 'فایل MPP قابل دسترسی نیست.',
      });
    }

    const jar = mpxjHelperJarPath()!;
    const stdout = await this.runHelper(jar, filePath);
    return this.parseHelperOutput(stdout);
  }

  private runHelper(jar: string, filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'java',
        ['-jar', jar, '--file', filePath, '--format', 'json'],
        { timeout: PARSE_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`اجرای MPXJ Helper ناموفق بود: ${error.message}`);
            reject(
              new ServiceUnavailableException({
                code: ErrorCode.IMPORT_ERROR,
                message: 'تجزیهٔ فایل MPP ناموفق بود. لطفاً محیط MPXJ را بررسی کنید.',
              }),
            );
            return;
          }
          if (stderr && stderr.trim().length > 0) {
            this.logger.warn(`MPXJ Helper هشدار داد.`);
          }
          resolve(String(stdout));
        },
      );
    });
  }

  private parseHelperOutput(stdout: string): MppParseResult {
    let json: unknown;
    try {
      json = JSON.parse(stdout);
    } catch {
      throw new ServiceUnavailableException({
        code: ErrorCode.IMPORT_ERROR,
        message: 'خروجی MPXJ معتبر نیست.',
      });
    }
    const obj = json as Partial<MppParseResult>;
    return {
      parserVersion: this.parserVersion,
      mppFileType: obj.mppFileType ?? null,
      currency: obj.currency ?? null,
      statusDateIso: obj.statusDateIso ?? null,
      tasks: obj.tasks ?? [],
      dependencies: obj.dependencies ?? [],
      assignments: obj.assignments ?? [],
    };
  }
}
