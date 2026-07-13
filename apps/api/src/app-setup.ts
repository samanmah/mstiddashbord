import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { type AppConfig } from './config/configuration';

/**
 * پیکربندی مشترک برنامه Nest که هم در main.ts و هم در تست‌های یکپارچه استفاده می‌شود
 * تا رفتار تست دقیقاً با محیط اجرا یکسان باشد.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser(config.cookie.secret));

  const httpAdapter = app.getHttpAdapter();
  (httpAdapter.getInstance() as { set: (k: string, v: unknown) => void }).set(
    'trust proxy',
    1,
  );

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
}
