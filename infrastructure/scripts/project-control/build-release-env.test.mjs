import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const py = join(here, 'build-release-env.py');

function build(baseContent, sets) {
  const dir = mkdtempSync(join(tmpdir(), 'ppm-release-env-'));
  const base = join(dir, 'base.env');
  const out = join(dir, 'release.env');
  writeFileSync(base, baseContent);
  const args = [py, '--base', base, '--out', out];
  for (const [k, v] of Object.entries(sets)) {
    args.push('--set', `${k}=${v}`);
  }
  const r = spawnSync('python3', args, { encoding: 'utf8' });
  const content = r.status === 0 ? readFileSync(out, 'utf8') : '';
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, content };
}

describe('build-release-env.py', () => {
  it('Override می‌کند APP_VERSION و GIT_SHA قدیمی را با FULL_SHA جدید', () => {
    const full = 'abc3f65cfd03ec16225b7cbaf670db7f0ce8aee3';
    const r = build(
      [
        'POSTGRES_PASSWORD=secret',
        'APP_VERSION=3ba5a1e0058605e82cb7af064c7b7e91751a45e0',
        'GIT_SHA=3ba5a1e0058605e82cb7af064c7b7e91751a45e0',
        'SEED_EDITOR_PASSWORD=keep-me',
        '',
      ].join('\n'),
      {
        APP_VERSION: full,
        GIT_SHA: full,
        RUN_SEED_ON_START: 'false',
      },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.content, new RegExp(`^APP_VERSION=${full}$`, 'm'));
    assert.match(r.content, new RegExp(`^GIT_SHA=${full}$`, 'm'));
    assert.match(r.content, /^RUN_SEED_ON_START=false$/m);
    assert.match(r.content, /^POSTGRES_PASSWORD=secret$/m);
    assert.match(r.content, /^SEED_EDITOR_PASSWORD=keep-me$/m);
    assert.doesNotMatch(r.content, /3ba5a1e0058605e82cb7af064c7b7e91751a45e0/);
  });

  it('API_IMAGE و WEB_IMAGE قدیمی را با Digest جاری جایگزین می‌کند', () => {
    const api =
      'ghcr.io/samanmah/mstiddashbord-api@sha256:37529a7d8b20d40116886dad1d9d11cb5e710944878d0b0aca19df7cf654603b';
    const web =
      'ghcr.io/samanmah/mstiddashbord-web@sha256:c51bac2334934ce929e2277f6031beddbe68e084798193858d9401411bbae949';
    const r = build(
      [
        'API_IMAGE=ghcr.io/samanmah/mstiddashbord-api:3ba5a1e0058605e82cb7af064c7b7e91751a45e0',
        'WEB_IMAGE=ghcr.io/samanmah/mstiddashbord-web:3ba5a1e0058605e82cb7af064c7b7e91751a45e0',
        'COOKIE_SECURE=false',
      ].join('\n'),
      { API_IMAGE: api, WEB_IMAGE: web },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.content, new RegExp(`^API_IMAGE=${api.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(r.content, new RegExp(`^WEB_IMAGE=${web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(r.content, /^COOKIE_SECURE=false$/m);
    assert.equal((r.content.match(/^API_IMAGE=/gm) || []).length, 1);
    assert.equal((r.content.match(/^WEB_IMAGE=/gm) || []).length, 1);
  });
});
