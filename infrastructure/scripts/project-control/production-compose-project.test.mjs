import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  assertPostgresPreflight,
  discoverProductionComposeProjects,
  EXPECTED_PRODUCTION_COMPOSE_PROJECT,
  resolveProductionComposeProject,
  selectUniqueProductionComposeProject,
  STAGING_COMPOSE_PROJECT,
} from './production-compose-project.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const deployScript = join(here, 'ci-deploy-production-remote.sh');
const scriptSrc = readFileSync(deployScript, 'utf8');
/** خطوط اجرایی (بدون کامنت خالص) برای قراردادهای ممنوع */
const scriptCode = scriptSrc
  .split('\n')
  .filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('#');
  })
  .join('\n');

describe('production-compose-project resolution', () => {
  it('1) Worktree تغییر کند ولی project name همیشه ppm باقی بماند', () => {
    const a = resolveProductionComposeProject({
      explicitProject: null,
      baseEnvComposeProjectName: null,
      containers: [
        { id: 'c1', project: 'ppm', service: 'postgres', running: true },
      ],
    });
    const b = resolveProductionComposeProject({
      explicitProject: 'ppm',
      baseEnvComposeProjectName: null,
      containers: [],
    });
    assert.equal(a.project, EXPECTED_PRODUCTION_COMPOSE_PROJECT);
    assert.equal(b.project, 'ppm');
    assert.match(scriptSrc, /--project-name "\$\{PRODUCTION_COMPOSE_PROJECT\}"/);
    assert.match(scriptSrc, /WT="\$\{WORKTREES_ROOT\}\/\$\{FULL_SHA\}"/);
    assert.match(scriptSrc, /-f "\$\{WT\}\/compose\.production\.yml"/);
  });

  it('2) staging postgres نادیده گرفته شود', () => {
    const projects = discoverProductionComposeProjects([
      {
        id: 'stg',
        project: STAGING_COMPOSE_PROJECT,
        service: 'postgres',
        running: true,
      },
      { id: 'prod', project: 'ppm', service: 'postgres', running: true },
    ]);
    assert.deepEqual(projects, ['ppm']);
    assert.match(scriptSrc, /STAGING_COMPOSE_PROJECT/);
    assert.match(scriptSrc, /ppm_project_control_staging/);
  });

  it('3) production postgres با project=ppm پیدا شود', () => {
    const r = resolveProductionComposeProject({
      containers: [
        { project: STAGING_COMPOSE_PROJECT, service: 'postgres', running: true },
        { project: 'ppm', service: 'postgres', running: true },
      ],
    });
    assert.equal(r.project, 'ppm');
    assert.equal(r.source, 'label');
  });

  it('4) postgres running=false → Fail قبل از Backup', () => {
    assert.throws(
      () =>
        assertPostgresPreflight({
          containerId: 'abc',
          running: false,
          health: 'healthy',
          project: 'ppm',
          service: 'postgres',
          expectedProject: 'ppm',
        }),
      /Running نیست/,
    );
    const backupIdx = scriptSrc.indexOf('pg_dump');
    const preflightIdx = scriptSrc.indexOf('assert_postgres_preflight');
    assert.ok(preflightIdx >= 0 && backupIdx > preflightIdx);
  });

  it('5) label service اشتباه → Fail', () => {
    assert.throws(
      () =>
        assertPostgresPreflight({
          containerId: 'abc',
          running: true,
          health: 'healthy',
          project: 'ppm',
          service: 'db',
          expectedProject: 'ppm',
        }),
      /service اشتباه/,
    );
  });

  it('6) بیش از یک production candidate → Fail', () => {
    assert.throws(
      () => selectUniqueProductionComposeProject(['ppm', 'ppm_other']),
      /بیش از یک/,
    );
    assert.throws(
      () =>
        resolveProductionComposeProject({
          containers: [
            { project: 'ppm', service: 'postgres', running: true },
            { project: 'ppm_legacy', service: 'postgres', running: true },
          ],
        }),
      /بیش از یک/,
    );
  });
});

describe('ci-deploy-production-remote.sh static contract', () => {
  it('7) همه Compose commandها شامل --project-name باشند', () => {
    assert.match(scriptSrc, /COMPOSE=\(/);
    assert.match(scriptSrc, /--project-name "\$\{PRODUCTION_COMPOSE_PROJECT\}"/);
    // فراخوانی عملیاتی فقط از طریق "${COMPOSE[@]}" / "${ROLLBACK_COMPOSE[@]}"
    const invokeLines = scriptSrc
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(docker compose|"\$\{(?:COMPOSE|ROLLBACK_COMPOSE)\[@\]\}")\s+\S+/.test(l));
    for (const line of invokeLines) {
      assert.match(
        line,
        /^"\$\{(?:COMPOSE|ROLLBACK_COMPOSE)\[@\]\}"/,
        `compose invoke must use COMPOSE array: ${line}`,
      );
    }
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+config/);
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+ps/);
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+exec/);
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+run/);
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+pull/);
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+up/);
    assert.match(scriptSrc, /"\$\{COMPOSE\[@\]\}"\s+logs/);
  });

  it('8) همه شامل --project-directory /opt/ppm باشند', () => {
    assert.match(scriptSrc, /--project-directory "\$\{DEPLOY_PATH\}"/);
    const projectDirCount = (scriptSrc.match(/--project-directory "\$\{DEPLOY_PATH\}"/g) || [])
      .length;
    assert.ok(projectDirCount >= 2, 'COMPOSE و ROLLBACK_COMPOSE هر دو project-directory دارند');
  });

  it('9) Backup قبل از Migration باشد', () => {
    const backup = scriptSrc.indexOf('pg_dump');
    const migrate = scriptSrc.indexOf('migrate deploy');
    assert.ok(backup >= 0 && migrate > backup);
  });

  it('10) Backup قبل از Pull/Recreate باشد', () => {
    const backup = scriptSrc.indexOf('pg_dump');
    const pull = scriptSrc.indexOf('pull api web');
    const recreate = scriptSrc.indexOf('--force-recreate api web');
    assert.ok(backup >= 0 && pull > backup && recreate > backup);
  });

  it('11) postgres هیچ‌وقت force-recreate نشود', () => {
    assert.doesNotMatch(scriptCode, /force-recreate[^\n]*\bpostgres\b/);
    assert.doesNotMatch(scriptCode, /\brestart\b[^\n]*\bpostgres\b/);
    const upLines = scriptCode
      .split('\n')
      .filter((l) => /"\$\{(?:COMPOSE|ROLLBACK_COMPOSE)\[@\]\}"\s+up\b/.test(l));
    assert.ok(upLines.length >= 1);
    for (const line of upLines) {
      assert.doesNotMatch(line, /\bpostgres\b/);
      assert.match(line, /\b(api|web|nginx)\b/);
    }
  });

  it('12) PostgreSQL container ID قبل و بعد یکسان باشد', () => {
    assert.match(scriptSrc, /PRE_DEPLOY_POSTGRES_CID/);
    assert.match(scriptSrc, /POST_DEPLOY_POSTGRES_CID/);
    assert.match(
      scriptSrc,
      /POST_DEPLOY_POSTGRES_CID.*"\$\{PRE_DEPLOY_POSTGRES_CID\}"/,
    );
  });

  it('13) API/Web exact SHA deploy شوند', () => {
    assert.match(scriptSrc, /APP_VERSION=\$\{FULL_SHA\}/);
    assert.match(scriptSrc, /GIT_SHA=\$\{FULL_SHA\}/);
    assert.match(scriptSrc, /API_IMAGE=.*@\$\{API_DIGEST\}/);
    assert.match(scriptSrc, /WEB_IMAGE=.*@\$\{WEB_DIGEST\}/);
    assert.match(scriptSrc, /container APP_VERSION != FULL_SHA/);
    assert.match(scriptSrc, /liveness gitSha mismatch/);
  });

  it('14) Rollback از project=ppm استفاده کند', () => {
    assert.match(scriptSrc, /ROLLBACK_COMPOSE=\(/);
    const rbBlock = scriptSrc.slice(scriptSrc.indexOf('rollback_full'));
    assert.match(rbBlock, /--project-name "\$\{PRODUCTION_COMPOSE_PROJECT\}"/);
    assert.match(rbBlock, /--project-directory "\$\{DEPLOY_PATH\}"/);
    assert.match(rbBlock, /automatic DB restore NOT performed/);
  });

  it('15) /var/backups استفاده نشود', () => {
    assert.match(scriptSrc, /\/var\/backups/);
    assert.match(scriptSrc, /BACKUP_ROOT تحت \/var\/backups مجاز نیست|BACKUP_ROOT زیر \/var\/backups/);
    assert.match(scriptSrc, /backups\/production/);
  });

  it('16) Backupهای قبلی حذف نشوند', () => {
    assert.doesNotMatch(scriptSrc, /\brm\s+-rf\s+.*BACKUP/);
    assert.doesNotMatch(scriptSrc, /find\s+.*backup.*-delete/);
    assert.match(scriptSrc, /previous backups retained/);
  });

  it('17) down -v وجود نداشته باشد', () => {
    assert.doesNotMatch(scriptCode, /\bdown\s+-v\b/);
    assert.doesNotMatch(scriptCode, /\bdown\s+--volumes\b/);
    assert.match(scriptSrc, /down -v/); // فقط به‌عنوان ممنوع در توضیح
  });

  it('bash -n روی اسکریپت Production معتبر است', () => {
    const r = spawnSync('bash', ['-n', deployScript], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it('اولویت env صریح بر label غلبه دارد و خروجی امن ppm است', () => {
    const r = resolveProductionComposeProject({
      explicitProject: 'ppm',
      baseEnvComposeProjectName: 'ignored',
      containers: [{ project: 'other', service: 'postgres', running: true }],
    });
    assert.equal(r.project, 'ppm');
    assert.equal(r.source, 'env');
    assert.match(scriptSrc, /echo "PRODUCTION_COMPOSE_PROJECT=\$\{PRODUCTION_COMPOSE_PROJECT\}"/);
  });

  it('COMPOSE_PROJECT_NAME از base env اولویت دوم است', () => {
    const r = resolveProductionComposeProject({
      explicitProject: '',
      baseEnvComposeProjectName: 'ppm',
      containers: [{ project: 'other', service: 'postgres', running: true }],
    });
    assert.equal(r.project, 'ppm');
    assert.equal(r.source, 'base-env');
  });
});
