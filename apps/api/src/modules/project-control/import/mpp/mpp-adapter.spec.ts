import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type MppParseResult } from '@ppm/contracts';
import { checkMppEnvironment, parseJavaVersion } from './mpp-environment';
import { FixtureMppAdapter } from './fixture-mpp.adapter';

describe('mpp-environment', () => {
  it('نسخهٔ Java را از خروجی استخراج می‌کند', () => {
    expect(parseJavaVersion('openjdk version "26" 2026-01-01')).toBe('26');
    expect(parseJavaVersion('java version "1.8.0_351"')).toBe('1.8.0_351');
    expect(parseJavaVersion('no version here')).toBeNull();
  });

  it('checkMppEnvironment هرگز Crash نمی‌کند و پیام فارسی می‌دهد', async () => {
    const status = await checkMppEnvironment();
    expect(typeof status.javaAvailable).toBe('boolean');
    expect(status.adapterPresent).toBe(true);
    expect(status.message.length).toBeGreaterThan(0);
  });
});

describe('FixtureMppAdapter', () => {
  const fixture: MppParseResult = JSON.parse(
    readFileSync(join(__dirname, '../__fixtures__/mpp-phase5.sample.json'), 'utf8'),
  ) as MppParseResult;

  it('محیط را در دسترس گزارش می‌کند (بدون Java واقعی)', async () => {
    const adapter = new FixtureMppAdapter(fixture);
    const env = await adapter.checkEnvironment();
    expect(env.javaAvailable).toBe(true);
    expect(env.mpxjAvailable).toBe(true);
  });

  it('Fixture را تجزیه می‌کند', async () => {
    const adapter = new FixtureMppAdapter(fixture);
    const result = await adapter.parse('ignored');
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.currency).toBe('TOMAN');
    // COST2 (شرکتی) به‌عنوان منبع پولی MPP.
    expect(result.tasks[0]!.companyCost).toBe(15_000_000_000);
  });
});
