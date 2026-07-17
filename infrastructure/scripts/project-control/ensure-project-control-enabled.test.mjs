import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertFixtureProjectState,
  countActiveWbsNodes,
  decideEnableAction,
  EXPECTED_ACTIVE_NODES_WITH_ROOT,
  resolveEnablePostResult,
  shouldSkipFixtureCommit,
} from './ensure-project-control-enabled.mjs';

const PROJECT_ID = 'c023bee2-d0c8-460a-8166-d66bdf8bc928';

describe('ensure-project-control-enabled', () => {
  it('Test1: already enabled → skip (بدون POST)', () => {
    const state = assertFixtureProjectState(
      {
        id: PROJECT_ID,
        projectCode: 'STG-PC-001',
        projectControlEnabled: true,
      },
      PROJECT_ID,
    );
    assert.equal(decideEnableAction(state.projectControlEnabled), 'skip');
  });

  it('Test2: false → enable → 200 → after true → enabled', () => {
    assert.equal(decideEnableAction(false), 'enable');
    const result = resolveEnablePostResult({
      status: 200,
      body: { id: 'plan-1' },
      projectControlEnabledAfter: true,
    });
    assert.deepEqual(result, { ok: true, kind: 'enabled' });
  });

  it('Test3: false → POST 400 → after true → conflict-verified', () => {
    const result = resolveEnablePostResult({
      status: 400,
      body: {
        code: 'CONFLICT',
        message: 'کنترل پروژه قبلاً برای این پروژه فعال شده است.',
      },
      projectControlEnabledAfter: true,
    });
    assert.deepEqual(result, { ok: true, kind: 'conflict-verified' });
  });

  it('Test4: false → POST 400 → after false → FAIL', () => {
    const result = resolveEnablePostResult({
      status: 400,
      body: { code: 'CONFLICT', message: 'کنترل پروژه قبلاً برای این پروژه فعال شده است.' },
      projectControlEnabledAfter: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, 'error');
  });

  it('Test5: POST 500 → FAIL', () => {
    const result = resolveEnablePostResult({
      status: 500,
      body: { code: 'INTERNAL', message: 'خطای داخلی' },
      projectControlEnabledAfter: null,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
  });

  it('Test6: malformed project JSON → FAIL', () => {
    assert.throws(() => assertFixtureProjectState(null, PROJECT_ID), /نامعتبر/);
    assert.throws(
      () =>
        assertFixtureProjectState(
          { id: PROJECT_ID, projectCode: 'STG-PC-001', projectControlEnabled: 'yes' },
          PROJECT_ID,
        ),
      /Boolean/,
    );
  });

  it('Test7: node count=174 → skip commit (no duplicates)', () => {
    assert.equal(shouldSkipFixtureCommit(174), true);
    assert.equal(shouldSkipFixtureCommit(173), false);
    assert.equal(shouldSkipFixtureCommit(348), false);
    assert.equal(countActiveWbsNodes(Array.from({ length: 174 }, (_, i) => ({ id: i }))), 174);
    assert.equal(EXPECTED_ACTIVE_NODES_WITH_ROOT, 174);
  });

  it('accepts 201/204 as enabled when postcondition true', () => {
    assert.deepEqual(
      resolveEnablePostResult({
        status: 201,
        body: {},
        projectControlEnabledAfter: true,
      }),
      { ok: true, kind: 'enabled' },
    );
    assert.deepEqual(
      resolveEnablePostResult({
        status: 204,
        body: null,
        projectControlEnabledAfter: true,
      }),
      { ok: true, kind: 'enabled' },
    );
  });

  it('2xx without postcondition true fails', () => {
    const result = resolveEnablePostResult({
      status: 200,
      body: {},
      projectControlEnabledAfter: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'POSTCONDITION_FAILED');
  });
});
