import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyEnableControlResponse,
  sanitizeEnableMessage,
} from './classify-enable-response.mjs';

describe('classifyEnableControlResponse', () => {
  it('accepts 2xx as enabled', () => {
    assert.deepEqual(classifyEnableControlResponse(201, { id: 'plan-1' }), {
      ok: true,
      kind: 'enabled',
    });
    assert.deepEqual(classifyEnableControlResponse(200, {}), {
      ok: true,
      kind: 'enabled',
    });
  });

  it('accepts known already-enabled CONFLICT (400)', () => {
    const result = classifyEnableControlResponse(400, {
      statusCode: 400,
      code: 'CONFLICT',
      message: 'کنترل پروژه قبلاً برای این پروژه فعال شده است.',
    });
    assert.deepEqual(result, { ok: true, kind: 'already-enabled' });
  });

  it('accepts known already-enabled CONFLICT (409)', () => {
    const result = classifyEnableControlResponse(409, {
      code: 'CONFLICT',
      message: 'کنترل پروژه قبلاً برای این پروژه فعال شده است.',
    });
    assert.deepEqual(result, { ok: true, kind: 'already-enabled' });
  });

  it('rejects generic 400 validation', () => {
    const result = classifyEnableControlResponse(400, {
      code: 'VALIDATION_ERROR',
      message: 'اطلاعات واردشده معتبر نیست.',
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, 'error');
    assert.equal(result.status, 400);
    assert.equal(result.code, 'VALIDATION_ERROR');
  });

  it('rejects CONFLICT without already-enabled message', () => {
    const result = classifyEnableControlResponse(400, {
      code: 'CONFLICT',
      message: 'مقدار تکراری است.',
    });
    assert.equal(result.ok, false);
  });

  it('rejects 401', () => {
    const result = classifyEnableControlResponse(401, {
      code: 'UNAUTHORIZED',
      message: 'احراز هویت لازم است.',
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it('rejects 404', () => {
    const result = classifyEnableControlResponse(404, {
      code: 'NOT_FOUND',
      message: 'پروژه یافت نشد.',
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
  });

  it('sanitizes bearer tokens in messages', () => {
    assert.match(
      sanitizeEnableMessage('fail Bearer abc.def.ghi cookie=secret'),
      /\[redacted\]/,
    );
  });
});
