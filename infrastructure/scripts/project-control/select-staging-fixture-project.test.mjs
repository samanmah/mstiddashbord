import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIXTURE_PROJECT_CODE,
  FIXTURE_PROJECT_CREATE,
  assertFixtureProjectContract,
  selectStagingFixtureProject,
} from './select-staging-fixture-project.mjs';

const seed = {
  id: 'seed-1',
  titleFa: 'تاسیس پارک تخصصی فناوری و نوآوری فولاد مبارکه (فاز اول)',
  titleEn: 'Seed Park',
  projectCode: 'SEED-001',
};

const fixture = {
  id: 'fix-1',
  titleFa: FIXTURE_PROJECT_CREATE.titleFa,
  titleEn: FIXTURE_PROJECT_CREATE.titleEn,
  projectCode: FIXTURE_PROJECT_CODE,
};

describe('selectStagingFixtureProject', () => {
  it('selects STG-PC-001 even when it is not first in the list', () => {
    const result = selectStagingFixtureProject([seed, fixture]);
    assert.equal(result.action, 'reuse');
    assert.equal(result.project.id, 'fix-1');
    assert.equal(result.project.projectCode, FIXTURE_PROJECT_CODE);
  });

  it('creates when STG-PC-001 is absent (never picks unrelated first project)', () => {
    const result = selectStagingFixtureProject([seed]);
    assert.equal(result.action, 'create');
    assert.equal(result.project, null);
  });

  it('never returns the first unrelated project as reuse', () => {
    const result = selectStagingFixtureProject([seed, { id: 'other', titleFa: 'دیگر', projectCode: 'X' }]);
    assert.equal(result.action, 'create');
    assert.notEqual(result.project?.id, seed.id);
  });

  it('creates when titleEn matches but projectCode is missing (no mutate of legacy)', () => {
    const legacy = {
      id: 'legacy-1',
      titleFa: FIXTURE_PROJECT_CREATE.titleFa,
      titleEn: FIXTURE_PROJECT_CREATE.titleEn,
      projectCode: null,
    };
    const result = selectStagingFixtureProject([seed, legacy]);
    assert.equal(result.action, 'create');
  });

  it('reuses when titleEn matches and projectCode is STG-PC-001', () => {
    const result = selectStagingFixtureProject([
      seed,
      {
        id: 'legacy-ok',
        titleFa: FIXTURE_PROJECT_CREATE.titleFa,
        titleEn: FIXTURE_PROJECT_CREATE.titleEn,
        projectCode: FIXTURE_PROJECT_CODE,
      },
    ]);
    assert.equal(result.action, 'reuse');
    assert.equal(result.project.id, 'legacy-ok');
  });

  it('fails when STG-PC-001 exists with wrong titleFa', () => {
    assert.throws(
      () =>
        selectStagingFixtureProject([
          {
            id: 'bad',
            projectCode: FIXTURE_PROJECT_CODE,
            titleFa: 'عنوان اشتباه',
            titleEn: FIXTURE_PROJECT_CREATE.titleEn,
          },
        ]),
      /titleFa ناسازگار/,
    );
  });

  it('assertFixtureProjectContract accepts exact fixture identity', () => {
    assert.doesNotThrow(() => assertFixtureProjectContract(fixture));
  });
});
