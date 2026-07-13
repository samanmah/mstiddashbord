import {
  DecisionStatus,
  Probability,
  RiskLevel,
  UserRole,
} from '@ppm/contracts';
import { jalaliToGregorian, monthSortKey } from '@ppm/contracts';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function jDate(jy: number, jm: number, jd: number): Date {
  const g = jalaliToGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12, 0, 0));
}

function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

const MONTHS: Array<{ label: string; jy: number; jm: number; planned: number }> = [
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

async function seedUsers(): Promise<void> {
  const editorUsername = process.env.SEED_EDITOR_USERNAME ?? 'editor';
  const editorPassword = process.env.SEED_EDITOR_PASSWORD;
  const viewerUsername = process.env.SEED_VIEWER_USERNAME ?? 'viewer';
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD;

  if (!editorPassword || !viewerPassword) {
    throw new Error(
      'SEED_EDITOR_PASSWORD و SEED_VIEWER_PASSWORD باید تعریف شده باشند تا کاربران اولیه ساخته شوند.',
    );
  }

  await prisma.user.upsert({
    where: { normalizedUsername: normalizeUsername(editorUsername) },
    update: {},
    create: {
      username: editorUsername,
      normalizedUsername: normalizeUsername(editorUsername),
      fullName: 'ویرایشگر پروژه',
      passwordHash: await hashPassword(editorPassword),
      role: UserRole.PROJECT_EDITOR,
    },
  });

  await prisma.user.upsert({
    where: { normalizedUsername: normalizeUsername(viewerUsername) },
    update: {},
    create: {
      username: viewerUsername,
      normalizedUsername: normalizeUsername(viewerUsername),
      fullName: 'مدیر مشاهده‌گر',
      passwordHash: await hashPassword(viewerPassword),
      role: UserRole.MANAGER_VIEWER,
    },
  });

  console.warn('✓ کاربران Seed ایجاد/به‌روزرسانی شدند.');
}

async function seedProject(): Promise<void> {
  const existing = await prisma.project.findFirst({ where: { titleEn: 'Innovation NEXUS' } });
  if (existing) {
    console.warn('✓ پروژه نمونه از قبل وجود دارد؛ از ایجاد مجدد صرف‌نظر شد.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        titleFa: 'تاسیس پارک تخصصی فناوری و نوآوری فولاد مبارکه (فاز اول)',
        titleEn: 'Innovation NEXUS',
        projectCode: null,
        projectManager: 'MSTID',
        projectType: 'استراتژیک',
        budgetBillionRial: 10000,
        description:
          'ایجاد زیرساخت Innovation Nexus در راستای پیوند ظرفیت های داخلی و بین المللی با هدف تکنولوژی محور شدن گروه فولاد مبارکه',
        startDate: jDate(1405, 4, 1),
        plannedEndDate: jDate(1406, 6, 1),
        reportDate: jDate(1405, 3, 23),
        displayOrder: 1,
      },
    });

    await tx.projectIndicator.create({
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
      await tx.monthlyProgress.create({
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
      await tx.activity.create({
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

    await tx.risk.createMany({
      data: [
        {
          projectId: project.id,
          rowNumber: 1,
          title: 'جذب منابع مالی مورد نیاز',
          probability: Probability.MEDIUM,
          riskLevel: RiskLevel.MEDIUM,
          mitigationAction: 'پیگیری جهت جذب منابع',
          owner: 'MSTID',
          displayOrder: 1,
        },
        {
          projectId: project.id,
          rowNumber: 2,
          title: 'دریافت مجوزهای لازم',
          probability: Probability.HIGH,
          riskLevel: RiskLevel.MEDIUM,
          mitigationAction: 'پیگیری دریافت مجوزهای لازم',
          owner: 'MSTID',
          displayOrder: 2,
        },
      ],
    });

    await tx.decision.createMany({
      data: [
        { projectId: project.id, rowNumber: 1, status: DecisionStatus.NEW, displayOrder: 1 },
        { projectId: project.id, rowNumber: 2, status: DecisionStatus.IN_PROGRESS, displayOrder: 2 },
        { projectId: project.id, rowNumber: 3, status: DecisionStatus.DONE, displayOrder: 3 },
      ],
    });
  });

  console.warn('✓ پروژه نمونه «Innovation NEXUS» با تمام داده‌ها ایجاد شد.');
}

async function main(): Promise<void> {
  await seedUsers();
  await seedProject();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('خطا در اجرای Seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
