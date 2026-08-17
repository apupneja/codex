import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electron = require("electron");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target =
  process.env.CODEX_DESKTOP_SMOKE_TARGET ??
  join(root, "artifacts", "smoke.png");
await mkdir(dirname(target), { recursive: true });
const child = spawn(electron, [root], {
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
if (code !== 0) throw new Error(`Electron smoke exited with ${code}`);
await access(target);
console.log(`Smoke capture: ${target}`);
