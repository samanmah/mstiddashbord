import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  EDITOR,
  VIEWER,
  createTestApp,
  login,
  resetDatabase,
  seedSampleProject,
  seedUsers,
  withAuth,
  type AuthedSession,
} from './utils';

/**
 * نکته: نرخ‌گیری ورود (۱۰ درخواست در دقیقه) در محیط اجرا فعال است. برای پرهیز از 429 در تست‌ها،
 * نشست‌های Editor/Viewer یک بار ساخته و در همه تست‌ها بازاستفاده می‌شوند؛ فقط تست‌های جریان
 * احراز هویت (refresh/logout/invalid) ورود اختصاصی دارند.
 */
describe('API integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let editor: AuthedSession;
  let viewer: AuthedSession;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.prisma;
    await resetDatabase(prisma);
    await seedUsers(prisma);
    projectId = await seedSampleProject(prisma);
    editor = await login(app, EDITOR);
    viewer = await login(app, VIEWER);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('rejects invalid credentials with a generic message (no enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: EDITOR.username, password: 'wrong-password' })
        .expect(401);
      expect(res.body.message).not.toContain('یافت نشد');
    });

    it('issues auth + csrf cookies on the shared editor session', () => {
      expect(editor.cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(editor.cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
      expect(editor.csrf.length).toBeGreaterThan(0);
    });

    it('returns the current user via /auth/me', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get('/api/v1/auth/me'),
        viewer,
      ).expect(200);
      expect(res.body.user.username).toBe(VIEWER.username);
      expect(res.body.user.role).toBe('MANAGER_VIEWER');
    });

    it('rotates the refresh token and revokes the old one', async () => {
      const session = await login(app, EDITOR);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', session.cookies)
        .expect(200);
      // استفاده مجدد از refresh token قدیمی باید رد شود
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', session.cookies)
        .expect(401);
    });

    it('logs out and revokes the refresh token', async () => {
      const session = await login(app, EDITOR);
      await withAuth(
        request(app.getHttpServer()).post('/api/v1/auth/logout'),
        session,
      ).expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', session.cookies)
        .expect(401);
    });
  });

  describe('RBAC', () => {
    it('allows the viewer to read the dashboard', async () => {
      await withAuth(
        request(app.getHttpServer()).get(`/api/v1/projects/${projectId}/dashboard`),
        viewer,
      ).expect(200);
    });

    it('forbids the viewer from mutating projects', async () => {
      await withAuth(
        request(app.getHttpServer()).patch(`/api/v1/projects/${projectId}`),
        viewer,
      )
        .send({ projectManager: 'HACKER', version: 1 })
        .expect(403);
    });

    it('forbids the viewer from listing users', async () => {
      await withAuth(request(app.getHttpServer()).get('/api/v1/users'), viewer).expect(403);
    });

    it('allows the editor to list users', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get('/api/v1/users'),
        editor,
      ).expect(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body).toHaveProperty('total');
    });

    it('rejects mutations without a CSRF token', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${projectId}`)
        .set('Cookie', editor.cookies)
        .send({ projectManager: 'X', version: 1 })
        .expect(403);
    });
  });

  describe('Dashboard calculations (acceptance criteria)', () => {
    it('returns planned 35, actual 35, achievement 100, indicator 0', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get(`/api/v1/projects/${projectId}/dashboard`),
        viewer,
      ).expect(200);
      expect(res.body.summary.plannedProjectProgress).toBe(35);
      expect(res.body.summary.actualProjectProgress).toBe(35);
      expect(res.body.summary.achievementPercent).toBe(100);
      expect(res.body.indicatorSummary.achievementPercent).toBe(0);
      expect(res.body.monthlyProgress).toHaveLength(14);
      expect(res.body.activities).toHaveLength(5);
      expect(res.body.risks).toHaveLength(2);
      expect(res.body.decisions).toHaveLength(3);
    });
  });

  describe('Project CRUD + optimistic concurrency', () => {
    it('updates the project and bumps the version', async () => {
      const before = await withAuth(
        request(app.getHttpServer()).get(`/api/v1/projects/${projectId}`),
        editor,
      ).expect(200);
      const version = before.body.version;

      const res = await withAuth(
        request(app.getHttpServer()).patch(`/api/v1/projects/${projectId}`),
        editor,
      )
        .send({ projectManager: 'MSTID-Updated', version })
        .expect(200);
      expect(res.body.projectManager).toBe('MSTID-Updated');
      expect(res.body.version).toBe(version + 1);
    });

    it('returns 409 on a stale version', async () => {
      await withAuth(
        request(app.getHttpServer()).patch(`/api/v1/projects/${projectId}`),
        editor,
      )
        .send({ projectManager: 'Stale', version: 0 })
        .expect(409);
    });
  });

  describe('Bulk activities weight validation', () => {
    it('rejects a bulk save whose weights do not total 100', async () => {
      await withAuth(
        request(app.getHttpServer()).put(`/api/v1/projects/${projectId}/activities/bulk`),
        editor,
      )
        .send({
          items: [
            {
              rowNumber: 1,
              title: 'فعالیت نامعتبر',
              weightPercent: 40,
              startDate: '1405/04/01',
              endDate: '1405/06/31',
              plannedPercent: 0,
              actualPercent: 0,
            },
          ],
        })
        .expect(400);
    });

    it('accepts a valid bulk save and reflects it on the dashboard', async () => {
      await withAuth(
        request(app.getHttpServer()).put(`/api/v1/projects/${projectId}/activities/bulk`),
        editor,
      )
        .send({
          items: [
            { rowNumber: 1, title: 'فعالیت الف', weightPercent: 50, startDate: '1405/04/01', endDate: '1405/06/31', plannedPercent: 100, actualPercent: 100 },
            { rowNumber: 2, title: 'فعالیت ب', weightPercent: 50, startDate: '1405/07/01', endDate: '1405/11/30', plannedPercent: 100, actualPercent: 50 },
          ],
        })
        .expect(200);

      const dash = await withAuth(
        request(app.getHttpServer()).get(`/api/v1/projects/${projectId}/dashboard`),
        editor,
      ).expect(200);
      // planned = (50*100 + 50*100)/100 = 100 ; actual = (50*100 + 50*50)/100 = 75
      expect(dash.body.summary.plannedProjectProgress).toBe(100);
      expect(dash.body.summary.actualProjectProgress).toBe(75);
      expect(dash.body.summary.achievementPercent).toBe(75);
    });
  });

  describe('Risks & Decisions', () => {
    it('creates a risk', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).post(`/api/v1/projects/${projectId}/risks`),
        editor,
      )
        .send({
          rowNumber: 3,
          title: 'ریسک آزمایشی',
          probability: 'HIGH',
          riskLevel: 'HIGH',
          mitigationAction: 'اقدام',
          owner: 'QA',
        })
        .expect(201);
      expect(res.body.title).toBe('ریسک آزمایشی');
    });

    it('creates a decision', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).post(`/api/v1/projects/${projectId}/decisions`),
        editor,
      )
        .send({ rowNumber: 4, subject: 'موضوع آزمایشی', status: 'NEW' })
        .expect(201);
      expect(res.body.subject).toBe('موضوع آزمایشی');
    });
  });

  describe('Excel export', () => {
    it('returns a valid XLSX file (PK zip header)', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get(`/api/v1/projects/${projectId}/export/excel`),
        editor,
      )
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const body = res.body as Buffer;
      expect(body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    });
  });

  describe('Audit log', () => {
    it('records mutations and is readable by the editor', async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get('/api/v1/audit-logs'),
        editor,
      ).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items[0]).toHaveProperty('action');
    });
  });

  describe('Health', () => {
    it('reports a healthy database connection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/readiness')
        .expect(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
