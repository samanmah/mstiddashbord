/**
 * انتخاب deterministic پروژه Fixture برای Smoke — بدون arr[0].
 */

import { FIXTURE_PROJECT_CODE, FIXTURE_PROJECT_CREATE } from './select-staging-fixture-project.mjs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} raw محتوای staging-project-id.txt
 * @returns {string}
 */
export function readFixtureProjectIdFromArtifact(raw) {
  const id = String(raw ?? '').trim();
  if (!id) {
    throw new Error('Artifact خالی است: artifacts/project-control/staging-project-id.txt');
  }
  if (!UUID_RE.test(id)) {
    throw new Error(`Artifact project ID معتبر نیست (UUID انتظار می‌رود): ${id.slice(0, 64)}`);
  }
  return id;
}

/**
 * @param {object} project پاسخ GET /projects/:id
 * @param {string} artifactId
 */
export function assertSmokeFixtureProject(project, artifactId) {
  if (!project || typeof project !== 'object') {
    throw new Error('پاسخ پروژه برای Smoke نامعتبر است.');
  }
  if (project.id !== artifactId) {
    throw new Error(`id پروژه با Artifact برابر نیست (artifact=${artifactId}, api=${String(project.id)}).`);
  }
  if (project.projectCode !== FIXTURE_PROJECT_CODE) {
    throw new Error(
      `projectCode باید ${FIXTURE_PROJECT_CODE} باشد؛ دریافت شد: ${String(project.projectCode)}`,
    );
  }
  if (project.titleFa !== FIXTURE_PROJECT_CREATE.titleFa) {
    throw new Error(
      `titleFa باید «${FIXTURE_PROJECT_CREATE.titleFa}» باشد؛ دریافت شد: ${String(project.titleFa)}`,
    );
  }
  if (project.projectControlEnabled !== true) {
    throw new Error(
      'projectControlEnabled باید true باشد — Smoke برای Fixture معتبر نباید به Dashboard قدیمی fallback کند.',
    );
  }
  if (!project.activeControlPlanId || typeof project.activeControlPlanId !== 'string') {
    throw new Error('activeControlPlanId نباید خالی باشد.');
  }
}

export { FIXTURE_PROJECT_CODE, FIXTURE_PROJECT_CREATE };
