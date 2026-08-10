import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertNativePlatform,
  resolveRuntimeTarget,
} from "./runtime-target.mjs";
import {
  OPENAI_APPLE_TEAM_ID,
  assertMacReleaseIdentityConfiguration,
  assertOpenAiMacSignature,
  macIdentityBelongsToOpenAI,
  windowsAuthenticodeVerificationScript,
  windowsCertificateSha256,
  windowsPublisherSubject,
} from "./release-identity.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(appRoot, "release");
const args = process.argv.slice(2);

function argumentValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function hasAll(names) {
  return names.every(present);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture
      ? `\n${result.stdout ?? ""}${result.stderr ?? ""}`
      : "";
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed with exit code ${result.status ?? "unknown"}${detail}`,
    );
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function hasDeveloperIdIdentity() {
  const result = spawnSync(
    "/usr/bin/security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );
  return (
    result.status === 0 &&
    macIdentityBelongsToOpenAI(`${result.stdout}${result.stderr}`)
  );
}

function assertMacCredentials() {
  assertMacReleaseIdentityConfiguration();
  const hasSigningCredential =
    present("CSC_LINK") || present("CSC_NAME") || hasDeveloperIdIdentity();
  if (!hasSigningCredential) {
    throw new Error(
      `macOS release packaging requires CSC_LINK, an OpenAI CSC_NAME, or an installed OpenAI Developer ID Application identity for team ${OPENAI_APPLE_TEAM_ID}.`,
    );
  }

  const hasNotarizationCredential =
    hasAll(["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]) ||
    hasAll(["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"]) ||
    hasAll(["APPLE_KEYCHAIN", "APPLE_KEYCHAIN_PROFILE"]);
  if (!hasNotarizationCredential) {
    throw new Error(
      "macOS release packaging requires a complete electron-builder notarization credential set.",
    );
  }
}

function assertWindowsCredentials() {
  windowsPublisherSubject();
  windowsCertificateSha256();
  if (!present("WIN_CSC_LINK") && !present("CSC_LINK")) {
    throw new Error(
      "Windows release packaging requires WIN_CSC_LINK or CSC_LINK for Authenticode signing.",
    );
  }
}

function linuxSigningKey() {
  const key = process.env.CODEX_DESKTOP_LINUX_GPG_KEY_ID?.trim();
  if (!key) {
    throw new Error(
      "Linux release packaging requires CODEX_DESKTOP_LINUX_GPG_KEY_ID for detached artifact signatures.",
    );
  }
  return key;
}

function assertLinuxCredentials() {
  const key = linuxSigningKey();
  run("gpg", ["--batch", "--list-secret-keys", key], { capture: true });
}

async function walk(root) {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    paths.push(path);
    if (entry.isDirectory() && !entry.name.endsWith(".app")) {
      paths.push(...(await walk(path)));
    }
  }
  return paths;
}

async function requireArtifacts(extensions) {
  const entries = await readdir(releaseRoot, { withFileTypes: true });
  const artifacts = [];
  for (const entry of entries) {
    if (!entry.isFile() || !extensions.includes(extname(entry.name))) continue;
    const path = join(releaseRoot, entry.name);
    if ((await stat(path)).size < 1_000_000) {
      throw new Error(`Release artifact is unexpectedly small: ${path}`);
    }
    artifacts.push(path);
  }
  for (const extension of extensions) {
    if (!artifacts.some((path) => extname(path) === extension)) {
      throw new Error(`Release did not produce a ${extension} artifact`);
    }
  }
  return artifacts;
}

async function verifyRuntimeTarget(expectedTarget, paths) {
  const manifests = paths.filter(
    (path) =>
      path.endsWith("codex-package.json") && path.includes("codex-package"),
  );
  if (manifests.length === 0) {
    throw new Error("Packaged Codex runtime manifest was not found");
  }
  for (const manifest of manifests) {
    const metadata = JSON.parse(await readFile(manifest, "utf8"));
    if (metadata.target !== expectedTarget) {
      throw new Error(
        `Packaged runtime target mismatch: expected ${expectedTarget}, found ${metadata.target} in ${manifest}`,
      );
    }
  }
}

async function verifyMac(target) {
  const paths = await walk(releaseRoot);
  const appPath = paths.find((path) => path.endsWith("Codex Desktop.app"));
  if (!appPath) throw new Error("Packaged macOS application was not found");
  await requireArtifacts([".dmg", ".zip"]);
  await verifyRuntimeTarget(target.rustTarget, await walk(appPath));

  run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
  const signature = run("/usr/bin/codesign", ["-dv", "--verbose=4", appPath], {
    capture: true,
  });
  assertOpenAiMacSignature(signature);
  run("/usr/bin/xcrun", ["stapler", "validate", appPath]);
  run("/usr/sbin/spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=4",
    appPath,
  ]);
}

async function verifyWindows(target) {
  const paths = await walk(releaseRoot);
  await requireArtifacts([".exe"]);
  await verifyRuntimeTarget(target.rustTarget, paths);
  const signedCode = paths.filter(
    (path) =>
      path.toLowerCase().endsWith(".exe") ||
      path.toLowerCase().endsWith(".dll"),
  );
  if (signedCode.length === 0) {
    throw new Error("No packaged Windows executables or libraries were found");
  }
  const publisher = windowsPublisherSubject();
  const certificateSha256 = windowsCertificateSha256();
  for (const path of signedCode) {
    run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      windowsAuthenticodeVerificationScript(path, publisher, certificateSha256),
    ]);
  }
}

async function signAndVerifyLinux(target) {
  const paths = await walk(releaseRoot);
  await verifyRuntimeTarget(target.rustTarget, paths);
  const artifacts = await requireArtifacts([".AppImage", ".deb"]);
  const key = linuxSigningKey();
  for (const artifact of artifacts) {
    const signature = `${artifact}.asc`;
    run("gpg", [
      "--batch",
      "--yes",
      "--armor",
      "--detach-sign",
      "--local-user",
      key,
      "--output",
      signature,
      artifact,
    ]);
    run("gpg", ["--batch", "--verify", signature, artifact]);
  }
}

const target = resolveRuntimeTarget({ target: argumentValue("--target") });
assertNativePlatform(target);

if (args.includes("--preflight")) {
  if (target.platform === "darwin") assertMacCredentials();
  if (target.platform === "win32") assertWindowsCredentials();
  if (target.platform === "linux") assertLinuxCredentials();
  console.log(`Release trust preflight passed for ${target.rustTarget}`);
} else if (target.platform === "darwin") {
  await verifyMac(target);
  console.log(
    `Verified OpenAI Developer ID signature for team ${OPENAI_APPLE_TEAM_ID}, notarization ticket, and Gatekeeper trust`,
  );
} else if (target.platform === "win32") {
  await verifyWindows(target);
  console.log(
    "Verified pinned-publisher Authenticode signatures for packaged Windows executables",
  );
} else {
  await signAndVerifyLinux(target);
  console.log(
    "Created and verified detached GPG signatures for Linux artifacts",
  );
}
