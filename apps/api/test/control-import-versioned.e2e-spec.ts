import { type INestApplication } from '@nestjs/common';
import { ImportCommitMode } from '@ppm/contracts';
import request from 'supertest';
import { buildGanttFixtureBuffer } from '../src/modules/project-control/import/__fixtures__/gantt-fixture';
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

describe('Control Import versioned (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let editor: AuthedSession;
  let viewer: AuthedSession;
  let projectId: string;
  let fixtureBuf: Buffer;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.prisma;
    await resetDatabase(prisma);
    await seedUsers(prisma);
    projectId = await seedSampleProject(prisma);
    editor = await login(app, EDITOR);
    viewer = await login(app, VIEWER);
    fixtureBuf = await buildGanttFixtureBuffer();
  });

  afterAll(async () => {
    await app.close();
  });

  async function uploadAndPreview(): Promise<{ batchId: string; preview: Record<string, unknown> }> {
    const upload = await withAuth(
      request(app.getHttpServer()).post(`/api/v1/projects/${projectId}/control/imports/upload`),
      editor,
    )
      .attach('file', fixtureBuf, {
        filename: 'gantt-fixture.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('sourceType', 'EXCEL')
      .expect(201);

    const batchId = upload.body.importBatchId as string;
    expect(batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const previewRes = await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/imports/${batchId}/preview`,
      ),
      editor,
    )
      .send({ dryRun: true })
      .expect(200);

    return { batchId, preview: previewRes.body as Record<string, unknown> };
  }

  it('Preview → Dry Run → Commit نسخه‌ای با Period Snapshots', async () => {
    const { batchId, preview } = await uploadAndPreview();
    const stats = preview.periodMatrixStats as {
      periodColumnCount: number;
      periodSnapshotsParsed: number;
      explicitZeroCount: number;
    };
    expect(stats.periodColumnCount).toBe(147);
    expect(preview.counts).toMatchObject({
      phases: 7,
      break1: 24,
      tasks: 142,
      totalNodes: 173,
    });
    expect(preview.orphanCount).toBe(0);
    expect(preview.criticalCount).toBe(0);
    expect(preview.canCommit).toBe(true);

    const dry = await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/imports/${batchId}/validate`,
      ),
      editor,
    ).expect(200);
    expect(dry.body.canCommit).toBe(true);

    const commit = await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/imports/${batchId}/commit`,
      ),
      editor,
    )
      .send({
        confirm: true,
        allowWarnings: true,
        mode: ImportCommitMode.CREATE_NEW_VERSION,
      })
      .expect(201);

    expect(commit.body.activePlanSwitched).toBe(true);
    expect(commit.body.createdNodes).toBe(173);
    expect(commit.body.periodSnapshotsCreated).toBe(stats.periodSnapshotsParsed);
    expect(commit.body.newPlanVersion).toBe(1);
    expect(commit.body.rollbackAvailable).toBe(false);

    const planId = commit.body.controlPlanId as string;
    const nodesWithRoot = await prisma.wbsNode.count({
      where: { controlPlanId: planId, deletedAt: null },
    });
    expect(nodesWithRoot).toBe(174);

    const snapshots = await prisma.nodePeriodSnapshot.count({
      where: { controlPlanId: planId },
    });
    expect(snapshots).toBe(stats.periodSnapshotsParsed);

    const zeros = await prisma.nodePeriodSnapshot.count({
      where: { controlPlanId: planId, zeroIsExplicit: true, normalizedValue: 0 },
    });
    expect(zeros).toBe(stats.explicitZeroCount);

    const activePlans = await prisma.projectControlPlan.count({
      where: { projectId, isActive: true },
    });
    expect(activePlans).toBe(1);
  });

  it('همان fileHash با REUSE_EXISTING Duplicate فعال نمی‌سازد', async () => {
    const { batchId, preview } = await uploadAndPreview();
    expect(preview.existingCommittedImport).toBeTruthy();
    expect(preview.suggestedCommitMode).toBe(ImportCommitMode.REUSE_EXISTING);

    const beforePlans = await prisma.projectControlPlan.count({ where: { projectId } });
    const commit = await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/imports/${batchId}/commit`,
      ),
      editor,
    )
      .send({
        confirm: true,
        allowWarnings: true,
        mode: ImportCommitMode.REUSE_EXISTING,
      })
      .expect(201);

    expect(commit.body.reusedExisting).toBe(true);
    expect(commit.body.status).toBe('REUSED');
    expect(commit.body.createdNodes).toBe(0);
    const afterPlans = await prisma.projectControlPlan.count({ where: { projectId } });
    expect(afterPlans).toBe(beforePlans);
  });

  it('CREATE_NEW_VERSION صریح Plan جدید می‌سازد و Rollback کار می‌کند', async () => {
    const { batchId } = await uploadAndPreview();
    const before = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeControlPlanId: true },
    });
    const previousPlanId = before!.activeControlPlanId!;

    const commit = await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/imports/${batchId}/commit`,
      ),
      editor,
    )
      .send({
        confirm: true,
        allowWarnings: true,
        mode: ImportCommitMode.CREATE_NEW_VERSION,
      })
      .expect(201);

    expect(commit.body.activePlanSwitched).toBe(true);
    expect(commit.body.rollbackAvailable).toBe(true);
    expect(commit.body.previousControlPlanId).toBe(previousPlanId);
    expect(commit.body.newPlanVersion).toBeGreaterThan(1);

    const newPlanId = commit.body.controlPlanId as string;
    const activeAfter = await prisma.projectControlPlan.findMany({
      where: { projectId, isActive: true },
      select: { id: true },
    });
    expect(activeAfter).toHaveLength(1);
    expect(activeAfter[0]!.id).toBe(newPlanId);

    // Parentها فقط داخل همان Plan
    const crossPlanParents = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c
       FROM wbs_nodes child
       JOIN wbs_nodes parent ON child."parentId" = parent.id
       WHERE child."controlPlanId" = $1::uuid
         AND parent."controlPlanId" <> $1::uuid`,
      newPlanId,
    );
    expect(Number(crossPlanParents[0]!.c)).toBe(0);

    const rolled = await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/plans/${previousPlanId}/activate`,
      ),
      editor,
    ).expect(201);

    expect(rolled.body.id).toBe(previousPlanId);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeControlPlanId: true },
    });
    expect(project?.activeControlPlanId).toBe(previousPlanId);
    const prevActive = await prisma.projectControlPlan.findUnique({
      where: { id: previousPlanId },
      select: { isActive: true },
    });
    const newInactive = await prisma.projectControlPlan.findUnique({
      where: { id: newPlanId },
      select: { isActive: true },
    });
    expect(prevActive?.isActive).toBe(true);
    expect(newInactive?.isActive).toBe(false);
  });

  it('Viewer نمی‌تواند Commit یا Rollback کند', async () => {
    const { batchId } = await uploadAndPreview();
    await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/imports/${batchId}/commit`,
      ),
      viewer,
    )
      .send({ confirm: true, allowWarnings: true, mode: ImportCommitMode.CREATE_NEW_VERSION })
      .expect(403);

    const plan = await prisma.projectControlPlan.findFirst({
      where: { projectId },
      select: { id: true },
    });
    await withAuth(
      request(app.getHttpServer()).post(
        `/api/v1/projects/${projectId}/control/plans/${plan!.id}/activate`,
      ),
      viewer,
    ).expect(403);
  });
});
