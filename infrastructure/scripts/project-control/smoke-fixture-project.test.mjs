import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIXTURE_PROJECT_CODE,
  FIXTURE_PROJECT_CREATE,
  assertSmokeFixtureProject,
  readFixtureProjectIdFromArtifact,
} from './smoke-fixture-project.mjs';

const ARTIFACT_ID = '2d900215-87fb-49ce-bb14-7f2370cf3b65';

describe('readFixtureProjectIdFromArtifact', () => {
  it('reads valid UUID from artifact content', () => {
    assert.equal(readFixtureProjectIdFromArtifact(`\n${ARTIFACT_ID}\n`), ARTIFACT_ID);
  });

  it('fails on empty artifact', () => {
    assert.throws(() => readFixtureProjectIdFromArtifact('  \n'), /خالی/);
  });

  it('fails on non-UUID', () => {
    assert.throws(() => readFixtureProjectIdFromArtifact('not-a-uuid'), /معتبر نیست/);
  });
});

describe('assertSmokeFixtureProject', () => {
  const good = {
    id: ARTIFACT_ID,
    projectCode: FIXTURE_PROJECT_CODE,
    titleFa: FIXTURE_PROJECT_CREATE.titleFa,
    projectControlEnabled: true,
    activeControlPlanId: 'plan-1',
  };

  it('accepts matching fixture project from artifact id', () => {
    assert.doesNotThrow(() => assertSmokeFixtureProject(good, ARTIFACT_ID));
  });

  it('never accepts unrelated first project as fixture', () => {
    assert.throws(
      () =>
        assertSmokeFixtureProject(
          {
            id: 'seed-1',
            projectCode: 'SEED-001',
            titleFa: 'پروژه Seed',
            projectControlEnabled: false,
            activeControlPlanId: null,
          },
          ARTIFACT_ID,
        ),
      /Artifact/,
    );
  });

  it('fails when Project Control is disabled', () => {
    assert.throws(
      () =>
        assertSmokeFixtureProject(
          { ...good, projectControlEnabled: false, activeControlPlanId: null },
          ARTIFACT_ID,
        ),
      /projectControlEnabled/,
    );
  });

  it('fails when activeControlPlanId is missing', () => {
    assert.throws(
      () => assertSmokeFixtureProject({ ...good, activeControlPlanId: null }, ARTIFACT_ID),
      /activeControlPlanId/,
    );
  });
});
