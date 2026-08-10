import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertNativePlatform,
  resolveRuntimeTarget,
} from "./runtime-target.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isDirectoryBuild = process.argv.includes("--dir");
const target = resolveRuntimeTarget();
assertNativePlatform(target);

const targetArgs = ["--target", target.rustTarget];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
}

function runPnpm(args) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args]);
    return;
  }
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm", ...args]);
    return;
  }
  run("pnpm", args);
}

if (!isDirectoryBuild) {
  run(process.execPath, [
    join(appRoot, "scripts", "release-trust.mjs"),
    "--preflight",
    ...targetArgs,
  ]);
}

run(process.execPath, [
  join(appRoot, "scripts", "stage-runtime.mjs"),
  "--profile",
  isDirectoryBuild ? "dev-small" : "release",
  ...targetArgs,
]);
runPnpm(["run", "build"]);

const builderArgs = [
  "exec",
  "electron-builder",
  "--config",
  "electron-builder.yml",
  `--${target.arch}`,
];
if (isDirectoryBuild) {
  builderArgs.push(
    "--dir",
    "--config.mac.forceCodeSigning=false",
    "--config.mac.notarize=false",
    "--config.win.forceCodeSigning=false",
  );
}
runPnpm(builderArgs);

if (isDirectoryBuild) {
  run(process.execPath, [join(appRoot, "scripts", "adhoc-sign.mjs")]);
} else {
  run(process.execPath, [
    join(appRoot, "scripts", "release-trust.mjs"),
    ...targetArgs,
  ]);
}
