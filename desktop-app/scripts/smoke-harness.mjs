import { spawn } from "node:child_process";
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

import { AppServerHarness, streamingResponse } from "./app-server-harness.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable =
  process.platform === "win32" ? "codex-app-server.exe" : "codex-app-server";
const appServer =
  process.env.CODEX_DESKTOP_E2E_APP_SERVER ??
  join(appRoot, "resources", "codex-package", "bin", executable);
const output = join(appRoot, "artifacts", "harness-smoke.png");
const queueOutput = join(appRoot, "artifacts", "harness-queue-smoke.png");
const queueMenuOutput = join(
  appRoot,
  "artifacts",
  "harness-queue-menu-smoke.png",
);
const reportOutput = join(appRoot, "artifacts", "harness-smoke.json");
const prompt = "Show me that desktop streaming works end to end.";
const partialText = "Streaming through the real app-server";
const finalText = `${partialText} is now complete.`;
const queuedPrompt = "Review the queued follow-up after this response.";
const queuedFinalText = "The queued follow-up completed automatically.";

await Promise.all([
  access(appServer),
  mkdir(dirname(output), { recursive: true }),
  unlink(output).catch(() => undefined),
  unlink(queueOutput).catch(() => undefined),
  unlink(queueMenuOutput).catch(() => undefined),
  unlink(reportOutput).catch(() => undefined),
]);
const temporaryRoot = await realpath(
  await mkdtemp(join(tmpdir(), "codex-desktop-harness-")),
);
const codexHome = join(temporaryRoot, "codex-home");
const userData = join(temporaryRoot, "user-data");
const workspace = join(temporaryRoot, "workspace");
await Promise.all([mkdir(userData), mkdir(workspace)]);

const harness = new AppServerHarness();
await harness.listen();
const gate = harness.enqueueSse(
  streamingResponse("desktop-stream-1", "desktop-message-1", [
    partialText,
    " is now complete.",
  ]),
  { gateAfterEvents: 3 },
);
if (!gate) throw new Error("Expected the streaming response to have a gate");
harness.enqueueSse(
  streamingResponse("desktop-stream-2", "desktop-message-2", [queuedFinalText]),
);
await harness.writeCodexConfig(codexHome);
await writeFile(
  join(userData, "desktop-preferences.json"),
  JSON.stringify({
    approvalPolicy: "never",
    editorFontSize: 13,
    lastWorkspace: workspace,
    recentWorkspaces: [workspace],
    rightPanelOpen: true,
    sandbox: "read-only",
    selectedEffort: "low",
    selectedModel: null,
    sidebarOpen: true,
    theme: "dark",
  }),
  { encoding: "utf8", mode: 0o600 },
);

const child = spawn(electron, [`--user-data-dir=${userData}`, "."], {
  cwd: appRoot,
  env: {
    ...process.env,
    CODEX_APP_SERVER_DISABLE_MANAGED_CONFIG: "1",
    CODEX_DESKTOP_APP_SERVER_COMMAND: JSON.stringify([
      appServer,
      "--listen",
      "stdio://",
    ]),
    CODEX_DESKTOP_SMOKE_FINAL: finalText,
    CODEX_DESKTOP_SMOKE_HARNESS: "1",
    CODEX_DESKTOP_SMOKE_HARNESS_RELEASE_URL: harness.releaseUrl,
    CODEX_DESKTOP_SMOKE_OUTPUT: output,
    CODEX_DESKTOP_SMOKE_PARTIAL: partialText,
    CODEX_DESKTOP_SMOKE_PROMPT: prompt,
    CODEX_DESKTOP_SMOKE_QUEUED_FINAL: queuedFinalText,
    CODEX_DESKTOP_SMOKE_QUEUED_PROMPT: queuedPrompt,
    CODEX_DESKTOP_SMOKE_QUEUE_MENU_OUTPUT: queueMenuOutput,
    CODEX_DESKTOP_SMOKE_QUEUE_OUTPUT: queueOutput,
    CODEX_DESKTOP_SMOKE_REPORT: reportOutput,
    CODEX_HOME: codexHome,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    RUST_LOG: "warn",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs = `${logs}${chunk}`.slice(-30_000);
});
child.stderr.on("data", (chunk) => {
  logs = `${logs}${chunk}`.slice(-30_000);
});

try {
  const exitCode = await new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Harness smoke test timed out.\n${logs}`));
    }, 45_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });
  if (exitCode !== 0) {
    throw new Error(`Electron exited with ${exitCode}.\n${logs}`);
  }

  await Promise.all([
    access(output),
    access(queueOutput),
    access(queueMenuOutput),
    access(reportOutput),
  ]);
  const [screenshot, queueScreenshot, queueMenuScreenshot, reportJson] =
    await Promise.all([
      readFile(output),
      readFile(queueOutput),
      readFile(queueMenuOutput),
      readFile(reportOutput, "utf8"),
    ]);
  const report = JSON.parse(reportJson);
  const width = screenshot.readUInt32BE(16);
  const height = screenshot.readUInt32BE(20);
  const expectedDimensions =
    (width === 1_361 && height === 881) ||
    (width === 2_722 && height === 1_762);
  if (
    screenshot.length < 20_000 ||
    screenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    !expectedDimensions ||
    queueScreenshot.length < 20_000 ||
    queueScreenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    queueMenuScreenshot.length < 20_000 ||
    queueMenuScreenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  ) {
    throw new Error(
      `Harness smoke screenshot is invalid (${screenshot.length} bytes).`,
    );
  }
  if (
    report.prompt !== prompt ||
    !report.partialRendered ||
    !report.finalRendered ||
    !report.queueEdited ||
    report.queuedPrompt !== queuedPrompt ||
    !report.queuedTurnCompleted ||
    !report.turnCompleted
  ) {
    throw new Error(`Harness smoke report is invalid: ${reportJson}`);
  }
  await gate.waitUntilReady();
  if (!gate.released)
    throw new Error("The desktop did not release the SSE gate");
  const requests = await harness.waitForRequests(2);
  if (!requests[0]?.messageInputTexts("user").includes(prompt)) {
    throw new Error(
      "The real app-server request did not include the desktop prompt",
    );
  }
  if (!requests[1]?.messageInputTexts("user").includes(queuedPrompt)) {
    throw new Error(
      "The queued turn did not include the queued desktop prompt",
    );
  }
  console.log(
    `Desktop harness smoke test passed: real app-server, queue editing, gated streaming, ${output}`,
  );
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await harness.close();
  await rm(temporaryRoot, { force: true, recursive: true });
}
