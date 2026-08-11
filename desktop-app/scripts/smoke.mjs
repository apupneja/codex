import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(appRoot, "artifacts", "smoke.png");
const mock = join(appRoot, "scripts", "mock-app-server.mjs");
await mkdir(dirname(output), { recursive: true });
await unlink(output).catch(() => undefined);
const temporaryRoot = await realpath(
  await mkdtemp(join(tmpdir(), "codex-desktop-smoke-")),
);
const userData = join(temporaryRoot, "user-data");
await Promise.all([
  mkdir(userData),
  mkdir(join(temporaryRoot, "signal-arena")),
  mkdir(join(temporaryRoot, "intusent-site")),
]);
await writeFile(
  join(temporaryRoot, "signal-arena", "capture-ui.mjs"),
  'export const capture = "ready";\n',
  "utf8",
);
await writeFile(
  join(userData, "desktop-preferences.json"),
  JSON.stringify({
    approvalPolicy: "on-request",
    editorFontSize: 13,
    lastWorkspace: join(temporaryRoot, "signal-arena"),
    recentWorkspaces: [
      join(temporaryRoot, "signal-arena"),
      join(temporaryRoot, "intusent-site"),
    ],
    rightPanelOpen: true,
    sandbox: "workspace-write",
    selectedEffort: "low",
    selectedModel: "composer-2.5",
    sidebarOpen: true,
    theme: "dark",
  }),
  { encoding: "utf8", mode: 0o600 },
);

const previewServer = createServer((request, response) => {
  if (request.url !== "/") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Signal Arena</title>
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; }
      body { background: #030712; color: #f3f4f6; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      header { align-items: center; background: #0e1423; border-bottom: 1px solid #1e2938; display: flex; height: 57px; padding: 0 16.5px; }
      .brand { color: #ff8904; font-size: 18px; font-weight: 700; letter-spacing: -.4px; margin-right: 31.5px; transform: translateY(-.5px); }
      nav { display: flex; gap: 24px; color: #d1d5dc; font-size: 14px; font-weight: 600; letter-spacing: -.35px; }
      .signin { align-items: center; background: #ff6900; border-radius: 7px; color: white; display: flex; height: 28.5px; margin-left: auto; padding: 0 16px; transform: translateY(.5px); }
      main { min-height: calc(100% - 106px); padding: 26px 16.5px; }
      h1 { font-size: 24px; margin: 0; }
      .empty { color: #6b7282; font-size: 16px; margin-top: 76.5px; text-align: center; }
      footer { border-top: 1px solid #1e2938; color: #4a5565; font-size: 12px; height: 49px; padding-top: 17px; text-align: center; }
    </style>
  </head>
  <body>
    <header><span class="brand">Signal Arena</span><nav><span>Live Arenas</span><span>Agents</span><span>Games</span></nav><span class="signin">Sign in</span></header>
    <main><h1>Live Arenas</h1><div class="empty">No arenas found.</div></main>
    <footer>Signal Arena — AI agents compete. You spectate.</footer>
  </body>
</html>`);
});
function listenForPreview(port) {
  return new Promise((resolvePort, reject) => {
    previewServer.once("error", reject);
    previewServer.listen(port, "127.0.0.1", () => {
      previewServer.removeListener("error", reject);
      const address = previewServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine smoke preview port"));
        return;
      }
      resolvePort(address.port);
    });
  });
}

let previewPort;
try {
  previewPort = await listenForPreview(5173);
} catch (error) {
  if (!(error instanceof Error) || error.code !== "EADDRINUSE") throw error;
  previewPort = await listenForPreview(0);
}
const previewUrl = `http://127.0.0.1:${previewPort}`;

const child = spawn(
  electron,
  [
    `--user-data-dir=${userData}`,
    ".",
    "codex://threads/019mock0-0000-7000-8000-000000000001",
  ],
  {
    cwd: appRoot,
    env: {
      ...process.env,
      CODEX_DESKTOP_APP_SERVER_COMMAND: JSON.stringify([
        process.execPath,
        mock,
      ]),
      CODEX_DESKTOP_SMOKE_OUTPUT: output,
      CODEX_DESKTOP_SMOKE_PREVIEW_URL: previewUrl,
      CODEX_DESKTOP_SMOKE_WORKSPACE_ROOT: temporaryRoot,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let logs = "";
child.stdout.on("data", (chunk) => {
  logs = `${logs}${chunk}`.slice(-20_000);
});
child.stderr.on("data", (chunk) => {
  logs = `${logs}${chunk}`.slice(-20_000);
});

try {
  const exitCode = await new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Electron smoke test timed out.\n${logs}`));
    }, 30_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`Electron exited with ${exitCode}.\n${logs}`);
  }
  await access(output);
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
      `Smoke screenshot is invalid (${screenshot.length} bytes).`,
    );
  }
  console.log(
    `Electron smoke test passed: ${output} (${screenshot.length} bytes)`,
  );
} finally {
  await new Promise((resolveClose) => previewServer.close(resolveClose));
  await rm(temporaryRoot, { recursive: true, force: true });
}
