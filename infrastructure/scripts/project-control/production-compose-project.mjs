/**
 * تشخیص Production Compose Project — بدون Side-effect و بدون Docker.
 * اولویت با caller است؛ این ماژول فقط فیلتر/انتخاب قطعی را انجام می‌دهد.
 */

export const STAGING_COMPOSE_PROJECT = 'ppm_project_control_staging';
export const EXPECTED_PRODUCTION_COMPOSE_PROJECT = 'ppm';

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeComposeProject(value) {
  return String(value || '').trim();
}

/**
 * خواندن اولویت ۱ و ۲ بدون حدس.
 * @param {{
 *   explicitProject?: string | null,
 *   baseEnvComposeProjectName?: string | null,
 * }} args
 * @returns {{ project: string | null, source: 'env' | 'base-env' | null }}
 */
export function resolveComposeProjectFromEnv(args) {
  const explicit = normalizeComposeProject(args.explicitProject);
  if (explicit) {
    return { project: explicit, source: 'env' };
  }
  const fromBase = normalizeComposeProject(args.baseEnvComposeProjectName);
  if (fromBase) {
    return { project: fromBase, source: 'base-env' };
  }
  return { project: null, source: null };
}

/**
 * @param {{
 *   project: string,
 *   service: string,
 *   running: boolean,
 * }} candidate
 */
export function isStagingComposeProject(project) {
  return normalizeComposeProject(project) === STAGING_COMPOSE_PROJECT;
}

/**
 * فقط کاندیدهای running با service=postgres؛ staging حذف می‌شود.
 * @param {Array<{
 *   id?: string,
 *   project?: string,
 *   service?: string,
 *   running?: boolean,
 * }>} containers
 * @returns {string[]} پروژه‌های یکتا (مرتب)
 */
export function discoverProductionComposeProjects(containers) {
  const projects = new Set();
  for (const c of containers || []) {
    if (c?.running !== true) continue;
    if (normalizeComposeProject(c.service) !== 'postgres') continue;
    const project = normalizeComposeProject(c.project);
    if (!project) continue;
    if (isStagingComposeProject(project)) continue;
    projects.add(project);
  }
  return [...projects].sort();
}

/**
 * انتخاب قطعی: صفر یا بیش از یک → خطا (حدس ممنوع).
 * @param {string[]} projects
 * @returns {string}
 */
export function selectUniqueProductionComposeProject(projects) {
  const unique = [...new Set((projects || []).map(normalizeComposeProject).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error(
      'هیچ PostgreSQL Production در حال اجرا با label service=postgres یافت نشد.',
    );
  }
  if (unique.length > 1) {
    throw new Error(
      `بیش از یک Production Compose Project محتمل: ${unique.join(', ')} — حدس ممنوع است.`,
    );
  }
  return unique[0];
}

/**
 * اولویت کامل تشخیص.
 * @param {{
 *   explicitProject?: string | null,
 *   baseEnvComposeProjectName?: string | null,
 *   containers?: Array<{
 *     id?: string,
 *     project?: string,
 *     service?: string,
 *     running?: boolean,
 *   }>,
 * }} args
 * @returns {{ project: string, source: 'env' | 'base-env' | 'label' }}
 */
export function resolveProductionComposeProject(args) {
  const fromEnv = resolveComposeProjectFromEnv(args);
  if (fromEnv.project) {
    return { project: fromEnv.project, source: fromEnv.source };
  }
  const projects = discoverProductionComposeProjects(args.containers || []);
  const project = selectUniqueProductionComposeProject(projects);
  return { project, source: 'label' };
}

/**
 * Assert preflight روی یک container PostgreSQL شناخته‌شده.
 * @param {{
 *   containerId?: string | null,
 *   running?: boolean,
 *   health?: string | null,
 *   project?: string | null,
 *   service?: string | null,
 *   expectedProject: string,
 * }} args
 */
export function assertPostgresPreflight(args) {
  const id = normalizeComposeProject(args.containerId);
  if (!id) {
    throw new Error('POSTGRES_CID خالی است — service postgres در Compose Project یافت نشد.');
  }
  if (args.running !== true) {
    throw new Error('PostgreSQL Running نیست — Deploy قبل از Backup متوقف شد.');
  }
  const service = normalizeComposeProject(args.service);
  if (service !== 'postgres') {
    throw new Error(`label service اشتباه است: expected=postgres got=${service || '(empty)'}`);
  }
  const project = normalizeComposeProject(args.project);
  if (project !== normalizeComposeProject(args.expectedProject)) {
    throw new Error(
      `label project mismatch: expected=${args.expectedProject} got=${project || '(empty)'}`,
    );
  }
  const health = args.health == null || args.health === '' ? null : String(args.health);
  if (health != null && health !== 'healthy') {
    throw new Error(`PostgreSQL Health ناسالم است: ${health}`);
  }
  return {
    POSTGRES_CONTAINER_ID: id,
    POSTGRES_PROJECT: project,
    POSTGRES_SERVICE: service,
    POSTGRES_RUNNING: true,
    POSTGRES_HEALTH: health ?? 'none',
  };
}
