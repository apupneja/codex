import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(appRoot, "release");
const output = join(appRoot, "artifacts", "packaged-smoke.png");

async function resolveExecutable() {
  if (process.env.CODEX_DESKTOP_PACKAGED_EXECUTABLE) {
    return resolve(process.env.CODEX_DESKTOP_PACKAGED_EXECUTABLE);
  }

  const releaseEntries = await readdir(releaseRoot).catch(() => []);
  const candidates = [];
  for (const entry of releaseEntries) {
    if (process.platform === "darwin" && entry.startsWith("mac")) {
      candidates.push(
        join(
          releaseRoot,
          entry,
          "Codex Desktop.app",
          "Contents",
          "MacOS",
          "Codex Desktop",
        ),
      );
    } else if (process.platform === "win32" && entry.includes("unpacked")) {
      candidates.push(join(releaseRoot, entry, "Codex Desktop.exe"));
    } else if (process.platform === "linux" && entry.includes("unpacked")) {
      candidates.push(join(releaseRoot, entry, "codex-desktop"));
      candidates.push(join(releaseRoot, entry, "Codex Desktop"));
    }
  }

  for (const candidate of candidates) {
    try {
      await access(
        candidate,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
      return candidate;
    } catch {
      // Continue until a host-platform package is found.
    }
  }
  throw new Error(
    "No unpacked desktop executable was found. Run `pnpm --dir desktop-app package:dir` first.",
  );
}

const executable = await resolveExecutable();
const temporaryRoot = await mkdtemp(join(tmpdir(), "codex-desktop-packaged-"));
const codexHome = join(temporaryRoot, "codex-home");
const userData = join(temporaryRoot, "user-data");
await Promise.all([
  mkdir(dirname(output), { recursive: true }),
  mkdir(codexHome),
  mkdir(userData),
]);
await unlink(output).catch(() => undefined);

let logs = "";
try {
  const child = spawn(executable, [`--user-data-dir=${userData}`], {
    cwd: appRoot,
    env: {
      ...process.env,
      CODEX_DESKTOP_SMOKE_OUTPUT: output,
      CODEX_HOME: codexHome,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    logs = `${logs}${chunk}`.slice(-20_000);
  });
  child.stderr.on("data", (chunk) => {
    logs = `${logs}${chunk}`.slice(-20_000);
  });

  const exitCode = await new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Packaged smoke test timed out.\n${logs}`));
    }, 45_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });
  if (exitCode !== 0) {
    throw new Error(`Packaged application exited with ${exitCode}.\n${logs}`);
  }

  const screenshot = await readFile(output);
  const pngSignature = "89504e470d0a1a0a";
  const width = screenshot.readUInt32BE(16);
  const height = screenshot.readUInt32BE(20);
  const hasExpectedDimensions =
    (width === 1_361 && height === 881) ||
    (width === 2_722 && height === 1_762);
  if (
    screenshot.length < 20_000 ||
    screenshot.subarray(0, 8).toString("hex") !== pngSignature ||
    !hasExpectedDimensions
  ) {
    throw new Error(
      `Packaged smoke screenshot is invalid (${screenshot.length} bytes).`,
    );
  }
  console.log(
    `Packaged Codex smoke test passed: ${output} (${screenshot.length} bytes)`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
