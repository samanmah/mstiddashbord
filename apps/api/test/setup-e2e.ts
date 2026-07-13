/**
 * تنظیم متغیرهای محیطی پیش از بارگذاری ماژول‌ها برای تست‌های یکپارچه.
 * از یک پایگاه‌داده تست مجزا استفاده می‌شود تا داده‌های توسعه دست‌نخورده بمانند.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://ppm_user:dev_pass_123@localhost:5434/ppm_test?schema=public';

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test_access_secret_min_32_chars_abcdefgh_0001';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test_refresh_secret_min_32_chars_abcdefgh_002';
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET ?? 'test_cookie_secret_min_32_chars_abcdefgh_0003';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAMESITE = 'lax';

process.env.SEED_EDITOR_USERNAME = process.env.SEED_EDITOR_USERNAME ?? 'editor';
process.env.SEED_EDITOR_PASSWORD =
  process.env.SEED_EDITOR_PASSWORD ?? 'EditorTest@Passw0rd!';
process.env.SEED_VIEWER_USERNAME = process.env.SEED_VIEWER_USERNAME ?? 'viewer';
process.env.SEED_VIEWER_PASSWORD =
  process.env.SEED_VIEWER_PASSWORD ?? 'ViewerTest@Passw0rd!';

// آپلودها در یک پوشه موقت انجام شوند تا فضای کاری آلوده نشود.
process.env.UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? mkdtempSync(join(tmpdir(), 'ppm-uploads-'));

// نرخ‌گیری را در تست بالا نگه می‌داریم تا تست‌ها به‌خاطر throttling شکست نخورند.
process.env.RATE_LIMIT_MAX = '100000';
process.env.LOGIN_RATE_LIMIT_MAX = '100000';

jest.setTimeout(60000);
