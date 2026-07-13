import { type INestApplication } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  EDITOR,
  createTestApp,
  login,
  resetDatabase,
  seedUsers,
  withAuth,
  type AuthedSession,
} from './utils';

// از نسخه با نام ASCII استفاده می‌شود تا نام فارسی فایل در multipart مشکل‌ساز نشود.
const REFERENCE_FILE = resolve(
  __dirname,
  '../../../references/project-charter-template.xlsm',
);

/** پیوست فایل مرجع از روی مسیر تا filename و contentType به‌درستی تنظیم شوند. */
function attachReference(req: request.Test): request.Test {
  return req.attach('file', REFERENCE_FILE);
}

const describeIfFile = existsSync(REFERENCE_FILE) ? describe : describe.skip;

describeIfFile('Excel import (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let editor: AuthedSession;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.prisma;
    await resetDatabase(prisma);
    await seedUsers(prisma);
    editor = await login(app, EDITOR);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a non-Excel / fake file', async () => {
    await withAuth(
      request(app.getHttpServer()).post('/api/v1/imports/excel/preview'),
      editor,
    )
      .attach('file', Buffer.from('not really an excel file'), {
        filename: 'evil.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(400);
  });

  it('previews the reference file with the expected counts', async () => {
    const res = await attachReference(
      withAuth(
        request(app.getHttpServer()).post('/api/v1/imports/excel/preview'),
        editor,
      ),
    ).expect(200);

    expect(res.body.isValid).toBe(true);
    expect(res.body.counts.projects).toBe(1);
    expect(res.body.counts.months).toBe(14);
    expect(res.body.counts.activities).toBe(5);
    expect(res.body.counts.risks).toBe(2);
    expect(res.body.counts.decisions).toBe(3);
    expect(res.body.computed.plannedProjectProgress).toBe(35);
    expect(res.body.computed.actualProjectProgress).toBe(35);
    expect(res.body.computed.achievementPercent).toBe(100);
  });

  it('commits the import atomically and stores it in PostgreSQL', async () => {
    const preview = await attachReference(
      withAuth(
        request(app.getHttpServer()).post('/api/v1/imports/excel/preview'),
        editor,
      ),
    ).expect(200);

    const commit = await withAuth(
      request(app.getHttpServer()).post('/api/v1/imports/excel/commit'),
      editor,
    )
      .send({
        storedFilename: preview.body.storedFilename,
        fileHash: preview.body.fileHash,
      })
      .expect(201);

    const projectId: string = commit.body.projectId;
    expect(projectId).toBeDefined();

    const activities = await prisma.activity.count({
      where: { projectId, deletedAt: null },
    });
    const months = await prisma.monthlyProgress.count({ where: { projectId } });
    expect(activities).toBe(5);
    expect(months).toBe(14);

    const dash = await withAuth(
      request(app.getHttpServer()).get(`/api/v1/projects/${projectId}/dashboard`),
      editor,
    ).expect(200);
    expect(dash.body.summary.plannedProjectProgress).toBe(35);
    expect(dash.body.summary.actualProjectProgress).toBe(35);
    expect(dash.body.summary.achievementPercent).toBe(100);
    expect(dash.body.indicatorSummary.achievementPercent).toBe(0);
  });

  it('rejects a commit with a tampered file hash (no partial write)', async () => {
    const preview = await attachReference(
      withAuth(
        request(app.getHttpServer()).post('/api/v1/imports/excel/preview'),
        editor,
      ),
    ).expect(200);

    const projectsBefore = await prisma.project.count();
    await withAuth(
      request(app.getHttpServer()).post('/api/v1/imports/excel/commit'),
      editor,
    )
      .send({
        storedFilename: preview.body.storedFilename,
        fileHash: 'deadbeef'.repeat(8),
      })
      .expect(400);
    const projectsAfter = await prisma.project.count();
    expect(projectsAfter).toBe(projectsBefore);
  });
});
