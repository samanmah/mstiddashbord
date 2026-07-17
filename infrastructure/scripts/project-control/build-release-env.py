#!/usr/bin/env python3
"""ساخت Release env موقت از فایل Secret ثابت — فایل ثابت را mutate نمی‌کند."""
from __future__ import annotations

import argparse
import os
import sys


def build_release_env_content(base_content: str, overrides: dict[str, str]) -> str:
    lines = base_content.splitlines()
    seen: set[str] = set()
    result: list[str] = []

    for line in lines:
        if not line or line.lstrip().startswith("#"):
            result.append(line)
            continue
        eq = line.find("=")
        if eq <= 0:
            result.append(line)
            continue
        key = line[:eq].strip()
        if key in overrides:
            result.append(f"{key}={overrides[key]}")
            seen.add(key)
        else:
            result.append(line)

    for key, value in overrides.items():
        if key not in seen:
            result.append(f"{key}={value}")

    body = "\n".join(result)
    return body if body.endswith("\n") else body + "\n"


def assert_release_env_overrides(env_content: str, expected: dict[str, str]) -> None:
    mapping: dict[str, str] = {}
    for line in env_content.splitlines():
        if not line or line.lstrip().startswith("#"):
            continue
        eq = line.find("=")
        if eq <= 0:
            continue
        mapping[line[:eq].strip()] = line[eq + 1 :]
    for key, value in expected.items():
        if mapping.get(key) != value:
            raise SystemExit(
                f"ERROR: Release env mismatch for {key}: "
                "expected exact release value, got different/missing"
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--set", action="append", default=[], dest="sets")
    args = parser.parse_args()

    overrides: dict[str, str] = {}
    for item in args.sets:
        eq = item.find("=")
        if eq <= 0:
            raise SystemExit(f"ERROR: Invalid --set {item}")
        overrides[item[:eq]] = item[eq + 1 :]

    with open(args.base, "r", encoding="utf-8") as fh:
        base = fh.read()
    content = build_release_env_content(base, overrides)
    assert_release_env_overrides(content, overrides)

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(content)
    try:
        os.chmod(args.out, 0o600)
    except OSError:
        pass
    print(f"RELEASE_ENV_KEYS={len(overrides)}")


if __name__ == "__main__":
    main()
