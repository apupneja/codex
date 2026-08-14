#!/usr/bin/env python3
"""Run a Cargo command with Codex's verified V8 artifacts configured."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


# Keep the local helper package importable when this script is run from any cwd.
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from codex_package.targets import TARGET_SPECS
from codex_package.v8 import resolve_codex_v8_cargo_env


CODEX_RS_ROOT = SCRIPT_DIR.parent / "codex-rs"


def target_from_args(args: list[str]) -> str:
    configured_target = os.environ.get("CARGO_BUILD_TARGET")
    if configured_target:
        return configured_target

    for index, arg in enumerate(args):
        if arg == "--target" and index + 1 < len(args):
            return args[index + 1]
        if arg.startswith("--target="):
            return arg.removeprefix("--target=")

    rustc_version = subprocess.run(
        ["rustc", "-vV"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    for line in rustc_version.splitlines():
        if line.startswith("host:"):
            return line.split(":", 1)[1].strip()

    raise RuntimeError("could not determine the Rust host target")


def main() -> int:
    cargo_args = sys.argv[1:]
    if not cargo_args:
        print("usage: cargo_with_v8.py <cargo-subcommand> [args...]", file=sys.stderr)
        return 2

    target = target_from_args(cargo_args)
    try:
        target_spec = TARGET_SPECS[target]
    except KeyError as error:
        supported_targets = ", ".join(sorted(TARGET_SPECS))
        raise RuntimeError(
            f"no Codex-built V8 artifact is configured for {target}; "
            f"supported targets: {supported_targets}"
        ) from error

    cargo_env = {**os.environ, **resolve_codex_v8_cargo_env(target_spec)}
    command = ["cargo", *cargo_args]
    print("+", " ".join(command), flush=True)
    return subprocess.run(command, cwd=CODEX_RS_ROOT, env=cargo_env).returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
