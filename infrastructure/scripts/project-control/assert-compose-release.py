#!/usr/bin/env python3
"""Assert effective docker compose config for Release (بدون چاپ Secret)."""
from __future__ import annotations

import argparse
import json
import sys


def env_map(service: dict) -> dict[str, str]:
    env = service.get("environment") or {}
    if isinstance(env, list):
        mapping: dict[str, str] = {}
        for item in env:
            text = str(item)
            eq = text.find("=")
            if eq > 0:
                mapping[text[:eq]] = text[eq + 1 :]
        return mapping
    return {str(k): str(v) for k, v in env.items()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-image", required=True)
    parser.add_argument("--web-image", required=True)
    parser.add_argument("--full-sha", required=True)
    args = parser.parse_args()

    cfg = json.load(sys.stdin)
    services = cfg.get("services") or {}
    api = services.get("api")
    web = services.get("web")
    if not api or not web:
        raise SystemExit("ERROR: compose config missing api/web services")

    if api.get("image") != args.api_image:
        raise SystemExit("ERROR: api.image mismatch: expected digest image, got different value")
    if web.get("image") != args.web_image:
        raise SystemExit("ERROR: web.image mismatch: expected digest image, got different value")

    api_env = env_map(api)
    if api_env.get("APP_VERSION") != args.full_sha:
        raise SystemExit("ERROR: api.environment.APP_VERSION != FULL_SHA")
    if api_env.get("GIT_SHA") != args.full_sha:
        raise SystemExit("ERROR: api.environment.GIT_SHA != FULL_SHA")

    print("COMPOSE_RELEASE_ASSERT=PASS")


if __name__ == "__main__":
    main()
