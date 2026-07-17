import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type MppParseResult } from '@ppm/contracts';
import {
  checkMppEnvironment,
  detectJava,
  parseJavaVersion,
  type MppCommandRunner,
} from './mpp-environment';
import { FixtureMppAdapter } from './fixture-mpp.adapter';

describe('mpp-environment', () => {
  it('نسخهٔ Java را از خروجی استخراج می‌کند', () => {
    expect(parseJavaVersion('openjdk version "26" 2026-01-01')).toBe('26');
    expect(parseJavaVersion('java version "1.8.0_351"')).toBe('1.8.0_351');
    expect(parseJavaVersion('no version here')).toBeNull();
  });

  it('checkMppEnvironment هرگز Crash نمی‌کند و پیام فارسی می‌دهد', async () => {
    const status = await checkMppEnvironment({
      detectJava: async () => ({ available: false, version: null }),
      helperJarPath: () => null,
    });
    expect(status.javaAvailable).toBe(false);
    expect(status.adapterPresent).toBe(true);
    expect(status.mpxjAvailable).toBe(false);
    expect(status.message.length).toBeGreaterThan(0);
    expect(/[\u0600-\u06FF]/.test(status.message)).toBe(true);
  });

  it('وقتی Java و Helper موجودند محیط را آماده گزارش می‌کند', async () => {
    const status = await checkMppEnvironment({
      detectJava: async () => ({ available: true, version: '21.0.8' }),
      helperJarPath: () => '/app/mpp/mpxj-helper.jar',
      fileReadable: async () => true,
    });
    expect(status.javaAvailable).toBe(true);
    expect(status.javaVersion).toBe('21.0.8');
    expect(status.mpxjAvailable).toBe(true);
    expect(status.message).toContain('آماده');
  });

  it('وقتی Helper خوانا نیست mpxjAvailable=false می‌دهد', async () => {
    const status = await checkMppEnvironment({
      detectJava: async () => ({ available: true, version: '21.0.8' }),
      helperJarPath: () => '/app/mpp/mpxj-helper.jar',
      fileReadable: async () => false,
    });
    expect(status.javaAvailable).toBe(true);
    expect(status.mpxjAvailable).toBe(false);
    expect(status.message.length).toBeGreaterThan(0);
    expect(/[\u0600-\u06FF]/.test(status.message)).toBe(true);
    expect(status.message).toMatch(/Helper|MPXJ|jar/i);
  });

  describe('detectJava با Runner Mock', () => {
    it('نسخه را از stderr موفق استخراج می‌کند', async () => {
      const runner: MppCommandRunner = async () => ({
        code: 0,
        stdout: '',
        stderr: 'openjdk version "21.0.8"',
      });
      const result = await detectJava(runner);
      expect(result.available).toBe(true);
      expect(result.version).toBe('21.0.8');
    });

    it('با code≠0 در دسترس نیست', async () => {
      const runner: MppCommandRunner = async () => ({
        code: 1,
        stdout: '',
        stderr: 'java: not found',
      });
      const result = await detectJava(runner);
      expect(result.available).toBe(false);
      expect(result.version).toBeNull();
    });

    it('با Reject شدن Runner Crash نمی‌کند', async () => {
      const runner: MppCommandRunner = async () => {
        throw new Error('spawn ENOENT');
      };
      const result = await detectJava(runner);
      expect(result.available).toBe(false);
      expect(result.version).toBeNull();
    });
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
