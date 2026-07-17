import { MPP_ADAPTER_VERSION, type MppEnvironmentStatus, type MppParseResult } from '@ppm/contracts';
import { MppAdapter } from './mpp-adapter.interface';

/**
 * Adapter آزمایشی MPP که از یک نتیجهٔ نسخه‌بندی‌شدهٔ Sanitized استفاده می‌کند.
 * برای تست‌های Backend بدون وابستگی به Java/MPXJ روی سیستم توسعه.
 */
export class FixtureMppAdapter extends MppAdapter {
  constructor(private readonly fixture: MppParseResult) {
    super();
  }

  checkEnvironment(): Promise<MppEnvironmentStatus> {
    return Promise.resolve({
      javaAvailable: true,
      javaVersion: 'fixture',
      adapterPresent: true,
      adapterVersion: MPP_ADAPTER_VERSION,
      mpxjAvailable: true,
      message: 'حالت Fixture فعال است (بدون Java واقعی).',
    });
  }

  parse(_filePath: string): Promise<MppParseResult> {
    void _filePath;
    return Promise.resolve(this.fixture);
  }
}
