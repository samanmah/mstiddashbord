import { type CanActivate, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  DecisionStatus,
  Probability,
  RiskLevel,
  UserRole,
  jalaliToGregorian,
  monthSortKey,
} from '@ppm/contracts';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app-setup';
import { type AppConfig } from '../src/config/configuration';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export const EDITOR = { username: 'editor', password: 'EditorTest@Passw0rd!' };
export const VIEWER = { username: 'viewer', password: 'ViewerTest@Passw0rd!' };

export function jDate(jy: number, jm: number, jd: number): Date {
  const g = jalaliToGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12, 0, 0));
}

async function hash(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const passThroughGuard: CanActivate = { canActivate: () => true };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    // نرخ‌گیری در تست‌های یکپارچه غیرفعال می‌شود تا ورودهای مکرر باعث 429 نشوند.
    .overrideGuard(ThrottlerGuard)
    .useValue(passThroughGuard)
    .compile();

  const app = moduleRef.createNestApplication();
  const config = app.get(ConfigService).get<AppConfig>('app')!;
  configureApp(app, config);
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/** پاک‌سازی کامل جداول برای شروع تازه هر مجموعه تست. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_logs","import_logs","decisions","risks","activities","monthly_progress","project_indicators","refresh_tokens","projects","users" RESTART IDENTITY CASCADE',
  );
}

export async function seedUsers(prisma: PrismaService): Promise<void> {
  await prisma.user.create({
    data: {
      username: EDITOR.username,
      normalizedUsername: EDITOR.username,
      fullName: 'ویرایشگر پروژه',
      passwordHash: await hash(EDITOR.password),
      role: UserRole.PROJECT_EDITOR,
    },
  });
  await prisma.user.create({
    data: {
      username: VIEWER.username,
      normalizedUsername: VIEWER.username,
      fullName: 'مدیر مشاهده‌گر',
      passwordHash: await hash(VIEWER.password),
      role: UserRole.MANAGER_VIEWER,
    },
  });
}

const MONTHS = [
  { label: 'تیر (1405)', jy: 1405, jm: 4, planned: 5 },
  { label: 'مرداد (1405)', jy: 1405, jm: 5, planned: 15 },
  { label: 'شهریور (1405)', jy: 1405, jm: 6, planned: 20 },
  { label: 'مهر (1405)', jy: 1405, jm: 7, planned: 30 },
  { label: 'آبان (1405)', jy: 1405, jm: 8, planned: 35 },
  { label: 'آذر (1405)', jy: 1405, jm: 9, planned: 40 },
  { label: 'دی (1405)', jy: 1405, jm: 10, planned: 45 },
  { label: 'بهمن (1405)', jy: 1405, jm: 11, planned: 50 },
  { label: 'اسفند (1405)', jy: 1405, jm: 12, planned: 52 },
  { label: 'فروردین (1406)', jy: 1406, jm: 1, planned: 55 },
  { label: 'اردیبهشت (1406)', jy: 1406, jm: 2, planned: 70 },
  { label: 'خرداد (1406)', jy: 1406, jm: 3, planned: 75 },
  { label: 'تیر (1406)', jy: 1406, jm: 4, planned: 90 },
  { label: 'مرداد (1406)', jy: 1406, jm: 5, planned: 100 },
];

const ACTIVITIES = [
  { row: 1, title: 'مطالعات اولیه و بررسی نمونه های مشابه', weight: 20, s: [1405, 4, 1], e: [1405, 6, 31], p: 100, a: 100 },
  { row: 2, title: 'طراحی مفهومی اولیه', weight: 30, s: [1405, 7, 1], e: [1405, 11, 30], p: 50, a: 50 },
  { row: 3, title: 'طراحی Detail و عقد قرارداد ساخت', weight: 20, s: [1405, 10, 30], e: [1406, 3, 31], p: 0, a: 0 },
  { row: 4, title: 'راه اندازی فاز اول ساختمان', weight: 20, s: [1406, 4, 1], e: [1406, 6, 1], p: 0, a: 0 },
  { row: 5, title: 'انتقال پایلوت ها به مرکز', weight: 10, s: [1406, 5, 31], e: [1406, 6, 1], p: 0, a: 0 },
];

/** ساخت پروژه نمونه با همان داده‌های سند مرجع. شناسه پروژه را برمی‌گرداند. */
export async function seedSampleProject(prisma: PrismaService): Promise<string> {
  const project = await prisma.project.create({
    data: {
      titleFa: 'تاسیس پارک تخصصی فناوری و نوآوری فولاد مبارکه (فاز اول)',
      titleEn: 'Innovation NEXUS',
      projectCode: null,
      projectManager: 'MSTID',
      projectType: 'استراتژیک',
      budgetBillionRial: 10000,
      description: 'ایجاد زیرساخت Innovation Nexus',
      startDate: jDate(1405, 4, 1),
      plannedEndDate: jDate(1406, 6, 1),
      reportDate: jDate(1405, 3, 23),
      displayOrder: 1,
    },
  });

  await prisma.projectIndicator.create({
    data: {
      projectId: project.id,
      title: 'تعداد زیرساخت‌ها، تعداد پایلوت‌های منتقل شده',
      plannedValue: 2,
      actualValue: 0,
      isPrimary: true,
      displayOrder: 1,
    },
  });

  for (const m of MONTHS) {
    await prisma.monthlyProgress.create({
      data: {
        projectId: project.id,
        jalaliYear: m.jy,
        jalaliMonth: m.jm,
        monthLabel: m.label,
        sortOrder: monthSortKey(m.jy, m.jm),
        date: jDate(m.jy, m.jm, 1),
        plannedPercent: m.planned,
        actualPercent: null,
      },
    });
  }

  for (const a of ACTIVITIES) {
    await prisma.activity.create({
      data: {
        projectId: project.id,
        rowNumber: a.row,
        title: a.title,
        weightPercent: a.weight,
        startDate: jDate(a.s[0]!, a.s[1]!, a.s[2]!),
        endDate: jDate(a.e[0]!, a.e[1]!, a.e[2]!),
        plannedPercent: a.p,
        actualPercent: a.a,
        displayOrder: a.row,
      },
    });
  }

  await prisma.risk.createMany({
    data: [
      { projectId: project.id, rowNumber: 1, title: 'جذب منابع مالی مورد نیاز', probability: Probability.MEDIUM, riskLevel: RiskLevel.MEDIUM, mitigationAction: 'پیگیری جهت جذب منابع', owner: 'MSTID', displayOrder: 1 },
      { projectId: project.id, rowNumber: 2, title: 'دریافت مجوزهای لازم', probability: Probability.HIGH, riskLevel: RiskLevel.MEDIUM, mitigationAction: 'پیگیری دریافت مجوزهای لازم', owner: 'MSTID', displayOrder: 2 },
    ],
  });

  await prisma.decision.createMany({
    data: [
      { projectId: project.id, rowNumber: 1, status: DecisionStatus.NEW, displayOrder: 1 },
      { projectId: project.id, rowNumber: 2, status: DecisionStatus.IN_PROGRESS, displayOrder: 2 },
      { projectId: project.id, rowNumber: 3, status: DecisionStatus.DONE, displayOrder: 3 },
    ],
  });

  return project.id;
}

export interface AuthedSession {
  cookies: string[];
  csrf: string;
}

function parseCookies(setCookie: string[] | undefined): string[] {
  return (setCookie ?? []).map((c) => c.split(';')[0]!);
}

function extractCsrf(cookies: string[]): string {
  const found = cookies.find((c) => c.startsWith('csrf_token='));
  return found ? found.substring('csrf_token='.length) : '';
}

/** ورود و بازگرداندن کوکی‌ها و توکن CSRF برای درخواست‌های بعدی. */
export async function login(
  app: INestApplication,
  creds: { username: string; password: string },
): Promise<AuthedSession> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ ...creds, rememberMe: true })
    .expect(200);
  const cookies = parseCookies(res.headers['set-cookie'] as unknown as string[]);
  return { cookies, csrf: extractCsrf(cookies) };
}

/** افزودن هدرهای احراز هویت و CSRF به یک درخواست supertest. */
export function withAuth(
  req: request.Test,
  session: AuthedSession,
): request.Test {
  return req
    .set('Cookie', session.cookies)
    .set('X-CSRF-Token', session.csrf);
}
