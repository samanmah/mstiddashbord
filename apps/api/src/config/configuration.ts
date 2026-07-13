/** بارگذاری و ساختاردهی متغیرهای محیطی. */

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  cookie: {
    secret: string;
    domain: string | undefined;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };
  login: {
    maxAttempts: number;
    lockMinutes: number;
    rateLimitMax: number;
  };
  rateLimit: {
    ttl: number;
    max: number;
  };
  upload: {
    dir: string;
    maxBytes: number;
  };
  seed: {
    editorUsername: string;
    editorPassword: string;
    viewerUsername: string;
    viewerPassword: string;
  };
  appVersion: string;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

export function loadConfiguration(): AppConfig {
  const env = process.env;
  const nodeEnv = (env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development';

  return {
    nodeEnv,
    port: num(env.API_PORT, 4000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    databaseUrl: env.DATABASE_URL ?? '',
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET ?? '',
      refreshSecret: env.JWT_REFRESH_SECRET ?? '',
      accessTtl: num(env.JWT_ACCESS_TTL, 900),
      refreshTtl: num(env.JWT_REFRESH_TTL, 604800),
    },
    cookie: {
      secret: env.COOKIE_SECRET ?? '',
      domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN.length > 0 ? env.COOKIE_DOMAIN : undefined,
      secure: bool(env.COOKIE_SECURE, nodeEnv === 'production'),
      sameSite: (env.COOKIE_SAMESITE as AppConfig['cookie']['sameSite']) ?? 'lax',
    },
    login: {
      maxAttempts: num(env.LOGIN_MAX_ATTEMPTS, 5),
      lockMinutes: num(env.LOGIN_LOCK_MINUTES, 15),
      rateLimitMax: num(env.LOGIN_RATE_LIMIT_MAX, 10),
    },
    rateLimit: {
      ttl: num(env.RATE_LIMIT_TTL, 60),
      max: num(env.RATE_LIMIT_MAX, 120),
    },
    upload: {
      dir: env.UPLOAD_DIR ?? './uploads',
      maxBytes: num(env.UPLOAD_MAX_BYTES, 20 * 1024 * 1024),
    },
    seed: {
      editorUsername: env.SEED_EDITOR_USERNAME ?? 'editor',
      editorPassword: env.SEED_EDITOR_PASSWORD ?? '',
      viewerUsername: env.SEED_VIEWER_USERNAME ?? 'viewer',
      viewerPassword: env.SEED_VIEWER_PASSWORD ?? '',
    },
    appVersion: env.APP_VERSION ?? '1.0.0',
  };
}

/** رمزهای پیش‌فرض ناامن که در Production مجاز نیستند. */
const INSECURE_DEFAULTS = [
  'dev_access_secret_change_me_min_32_chars_0000',
  'dev_refresh_secret_change_me_min_32_chars_00',
  'dev_cookie_secret_change_me_min_32_chars_00',
  'Editor@Passw0rd!',
  'Viewer@Passw0rd!',
  'change_me_strong_password',
];

/**
 * اعتبارسنجی سخت‌گیرانه در زمان Startup.
 * در Production استفاده از مقادیر پیش‌فرض ناامن باعث توقف برنامه می‌شود.
 */
export function validateConfiguration(config: AppConfig): void {
  const errors: string[] = [];

  if (!config.databaseUrl) errors.push('DATABASE_URL تعریف نشده است.');

  const secrets: Array<[string, string]> = [
    ['JWT_ACCESS_SECRET', config.jwt.accessSecret],
    ['JWT_REFRESH_SECRET', config.jwt.refreshSecret],
    ['COOKIE_SECRET', config.cookie.secret],
  ];
  for (const [name, value] of secrets) {
    if (!value || value.length < 32) {
      errors.push(`${name} باید حداقل ۳۲ کاراکتر باشد.`);
    }
  }

  if (config.nodeEnv === 'production') {
    const prodSecrets: Array<[string, string]> = [
      ['JWT_ACCESS_SECRET', config.jwt.accessSecret],
      ['JWT_REFRESH_SECRET', config.jwt.refreshSecret],
      ['COOKIE_SECRET', config.cookie.secret],
      ['SEED_EDITOR_PASSWORD', config.seed.editorPassword],
      ['SEED_VIEWER_PASSWORD', config.seed.viewerPassword],
    ];
    for (const [name, value] of prodSecrets) {
      if (INSECURE_DEFAULTS.includes(value)) {
        errors.push(`${name} از مقدار پیش‌فرض ناامن استفاده می‌کند و در Production مجاز نیست.`);
      }
    }
    if (!config.cookie.secure) {
      errors.push('در Production باید COOKIE_SECURE=true باشد.');
    }
    if (config.jwt.accessSecret === config.jwt.refreshSecret) {
      errors.push('JWT_ACCESS_SECRET و JWT_REFRESH_SECRET نباید یکسان باشند.');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `پیکربندی محیط نامعتبر است:\n - ${errors.join('\n - ')}\n` +
        'لطفاً فایل .env را بر اساس .env.example تکمیل کنید.',
    );
  }
}
