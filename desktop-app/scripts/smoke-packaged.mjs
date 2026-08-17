import { spawn } from "node:child_process";
import { access, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function findExecutable(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findExecutable(path);
      if (nested) return nested;
    } else if (
      (process.platform === "darwin" &&
        path.includes(".app/Contents/MacOS/")) ||
      (process.platform === "win32" &&
        path.endsWith(".exe") &&
        !path.includes("Uninstall")) ||
      (process.platform === "linux" && entry.name === "codex-reimplementation")
    )
      return path;
  }
  return null;
}
const macExecutable = join(
  root,
  "release",
  `mac-${process.arch}`,
  "ChatGPT.app",
  "Contents",
  "MacOS",
  "ChatGPT",
);
let executable = process.platform === "darwin" ? macExecutable : null;
try {
  if (executable) await access(executable);
} catch {
  executable = null;
}
executable ??= await findExecutable(join(root, "release"));
if (!executable) throw new Error("Packaged executable not found");
const target = join(root, "artifacts", "packaged-smoke.png");
await mkdir(dirname(target), { recursive: true });
const child = spawn(executable, [], {
  env: {
    ...process.env,
    CODEX_DESKTOP_SMOKE_PATH: target,
    CODEX_DESKTOP_APP_SERVER_COMMAND: JSON.stringify([
      process.execPath,
      join(root, "scripts", "mock-app-server.mjs"),
    ]),
  },
  stdio: "inherit",
});
const timeout = setTimeout(() => child.kill(), 30_000);
const code = await new Promise((resolve) => child.once("exit", resolve));
clearTimeout(timeout);
if (code !== 0) throw new Error(`Packaged smoke exited with ${code}`);
await access(target);
console.log(`Packaged smoke capture: ${target}`);
