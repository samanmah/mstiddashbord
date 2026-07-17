/**
 * منطق idempotent فعال‌سازی Project Control برای Smoke/Fixture Staging.
 * بدون Side-effect — فقط تصمیم‌گیری و اعتبارسنجی پاسخ.
 */

import { sanitizeEnableMessage } from './classify-enable-response.mjs';

export const FIXTURE_PROJECT_CODE = 'STG-PC-001';
export const EXPECTED_ACTIVE_NODES_WITH_ROOT = 174;

/**
 * @param {unknown} project
 * @param {string} expectedId
 * @returns {{ id: string, projectCode: string, projectControlEnabled: boolean }}
 */
export function assertFixtureProjectState(project, expectedId) {
  if (!project || typeof project !== 'object') {
    throw new Error('پاسخ GET پروژه نامعتبر یا خالی است.');
  }
  const p = /** @type {Record<string, unknown>} */ (project);
  if (p.id !== expectedId) {
    throw new Error(`id پروژه با artifact هم‌خوان نیست.`);
  }
  if (p.projectCode !== FIXTURE_PROJECT_CODE) {
    throw new Error(`projectCode باید ${FIXTURE_PROJECT_CODE} باشد.`);
  }
  if (typeof p.projectControlEnabled !== 'boolean') {
    throw new Error('projectControlEnabled باید Boolean معتبر باشد.');
  }
  return {
    id: String(p.id),
    projectCode: String(p.projectCode),
    projectControlEnabled: p.projectControlEnabled,
  };
}

/**
 * @param {boolean} projectControlEnabled
 * @returns {'skip' | 'enable'}
 */
export function decideEnableAction(projectControlEnabled) {
  if (projectControlEnabled === true) return 'skip';
  if (projectControlEnabled === false) return 'enable';
  throw new Error('projectControlEnabled نامعتبر است.');
}

/**
 * @param {{
 *   status: number,
 *   body: unknown,
 *   projectControlEnabledAfter: boolean | null,
 * }} args
 * @returns {{ ok: true, kind: 'enabled' | 'conflict-verified' } | { ok: false, kind: 'error', status: number, code: string, message: string }}
 */
export function resolveEnablePostResult(args) {
  const status = Number(args.status);
  const after = args.projectControlEnabledAfter;
  const obj =
    args.body && typeof args.body === 'object'
      ? /** @type {Record<string, unknown>} */ (args.body)
      : {};
  const code = typeof obj.code === 'string' ? obj.code : '';
  const message =
    typeof obj.message === 'string'
      ? sanitizeEnableMessage(obj.message)
      : 'پاسخ Enable نامعتبر است.';

  if ([200, 201, 204].includes(status)) {
    if (after === true) return { ok: true, kind: 'enabled' };
    return {
      ok: false,
      kind: 'error',
      status,
      code: code || 'POSTCONDITION_FAILED',
      message: 'Enable 2xx بود اما projectControlEnabled هنوز true نیست.',
    };
  }

  if (status === 400 || status === 409) {
    if (after === true) return { ok: true, kind: 'conflict-verified' };
    return {
      ok: false,
      kind: 'error',
      status,
      code: code || 'CONFLICT',
      message:
        after === false
          ? `Enable Conflict بود ولی کنترل پروژه هنوز غیرفعال است: ${message}`
          : `Enable Conflict و تأیید مجدد وضعیت پروژه ممکن نشد: ${message}`,
    };
  }

  return {
    ok: false,
    kind: 'error',
    status: Number.isInteger(status) ? status : 0,
    code: code || 'UNEXPECTED_STATUS',
    message: `Enable با HTTP ${status} شکست خورد: ${message}`,
  };
}

/**
 * اگر تعداد نود فعال شامل Root برابر مقدار مورد انتظار Fixture باشد،
 * Commit مجدد ممنوع است (جلوگیری از Duplicate).
 * @param {number} activeNodeCount
 * @param {number} [expected=174]
 */
export function shouldSkipFixtureCommit(
  activeNodeCount,
  expected = EXPECTED_ACTIVE_NODES_WITH_ROOT,
) {
  return Number.isInteger(activeNodeCount) && activeNodeCount === expected;
}

/**
 * شمارش نودهای فعال از پاسخ تخت WBS.
 * @param {unknown} wbsPayload
 */
export function countActiveWbsNodes(wbsPayload) {
  if (!Array.isArray(wbsPayload)) {
    throw new Error('پاسخ WBS باید آرایه باشد.');
  }
  return wbsPayload.length;
}
