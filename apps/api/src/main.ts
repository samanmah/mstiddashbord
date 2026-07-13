import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
import { type AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService).get<AppConfig>('app')!;

  configureApp(app, config);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('سامانه پایش پیشرفت پروژه‌های استراتژیک')
    .setDescription('REST API — نسخه ۱')
    .setVersion(config.appVersion)
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(config.port, '0.0.0.0');
  logger.log(`API روی پورت ${config.port} اجرا شد (محیط: ${config.nodeEnv}).`);
  logger.log(`مستندات Swagger: http://localhost:${config.port}/api/docs`);
}

void bootstrap();
