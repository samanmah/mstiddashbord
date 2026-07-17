import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'assert-compose-release.py');

function run(config, args) {
  return spawnSync('python3', [script, ...args], {
    input: JSON.stringify(config),
    encoding: 'utf8',
  });
}

describe('assert-compose-release.py', () => {
  const full = 'abc3f65cfd03ec16225b7cbaf670db7f0ce8aee3';
  const api =
    'ghcr.io/samanmah/mstiddashbord-api@sha256:37529a7d8b20d40116886dad1d9d11cb5e710944878d0b0aca19df7cf654603b';
  const web =
    'ghcr.io/samanmah/mstiddashbord-web@sha256:c51bac2334934ce929e2277f6031beddbe68e084798193858d9401411bbae949';

  it('وقتی image و SHA درست باشند PASS می‌کند', () => {
    const r = run(
      {
        services: {
          api: {
            image: api,
            environment: { APP_VERSION: full, GIT_SHA: full, POSTGRES_PASSWORD: 'x' },
          },
          web: { image: web, environment: {} },
        },
      },
      ['--api-image', api, '--web-image', web, '--full-sha', full],
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /COMPOSE_RELEASE_ASSERT=PASS/);
  });

  it('وقتی APP_VERSION قدیمی باشد Fail می‌کند', () => {
    const r = run(
      {
        services: {
          api: {
            image: api,
            environment: {
              APP_VERSION: '3ba5a1e0058605e82cb7af064c7b7e91751a45e0',
              GIT_SHA: full,
            },
          },
          web: { image: web },
        },
      },
      ['--api-image', api, '--web-image', web, '--full-sha', full],
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /APP_VERSION/);
  });

  it('وقتی WEB_IMAGE قدیمی باشد Fail می‌کند', () => {
    const r = run(
      {
        services: {
          api: {
            image: api,
            environment: { APP_VERSION: full, GIT_SHA: full },
          },
          web: {
            image: 'ghcr.io/samanmah/mstiddashbord-web:3ba5a1e0058605e82cb7af064c7b7e91751a45e0',
          },
        },
      },
      ['--api-image', api, '--web-image', web, '--full-sha', full],
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /web\.image/);
  });
});
