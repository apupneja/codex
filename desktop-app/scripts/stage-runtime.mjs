import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRuntimeTarget } from "./runtime-target.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "..");
const args = process.argv.slice(2);

function argumentValue(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

const profile = argumentValue("--profile", "dev-small");
const explicitTarget = argumentValue("--target", undefined);
const target = resolveRuntimeTarget({ target: explicitTarget });
const python =
  process.env.CODEX_DESKTOP_PYTHON ??
  (process.platform === "win32" ? "python" : "python3");
const script = join(repositoryRoot, "scripts", "build_codex_package.py");
const packageDirectory = join(appRoot, "resources", "codex-package");

console.log(
  `Staging Codex runtime ${target.rustTarget} with Cargo profile ${profile}`,
);
const result = spawnSync(
  python,
  [
    script,
    "--variant",
    "codex-app-server",
    "--target",
    target.rustTarget,
    "--cargo-profile",
    profile,
    "--package-dir",
    packageDirectory,
    "--force",
  ],
  {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    `Codex runtime staging failed with exit code ${result.status ?? "unknown"}`,
  );
}
