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

import {
  AppServerHarness,
  applyPatchResponse,
  planUpdateResponse,
  shellCommandResponse,
  streamingResponse,
} from "./app-server-harness.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable =
  process.platform === "win32" ? "codex-app-server.exe" : "codex-app-server";
const appServer =
  process.env.CODEX_DESKTOP_E2E_APP_SERVER ??
  join(appRoot, "resources", "codex-package", "bin", executable);
const output = join(appRoot, "artifacts", "harness-smoke.png");
const streamingOutput = join(
  appRoot,
  "artifacts",
  "harness-streaming-smoke.png",
);
const commandOutput = join(appRoot, "artifacts", "harness-command-smoke.png");
const newTaskBrandOutput = join(
  appRoot,
  "artifacts",
  "harness-new-task-brand-smoke.png",
);
const lightNarrowNewTaskBrandOutput = join(
  appRoot,
  "artifacts",
  "harness-new-task-brand-light-narrow-smoke.png",
);
const planProgressOutput = join(
  appRoot,
  "artifacts",
  "harness-plan-progress-smoke.png",
);
const lightNarrowPlanProgressOutput = join(
  appRoot,
  "artifacts",
  "harness-plan-progress-light-narrow-smoke.png",
);
const scrolledAwayOutput = join(
  appRoot,
  "artifacts",
  "harness-scrolled-away-smoke.png",
);
const expandedActivityOutput = join(
  appRoot,
  "artifacts",
  "harness-activity-expanded-smoke.png",
);
const queueOutput = join(appRoot, "artifacts", "harness-queue-smoke.png");
const queueMenuOutput = join(
  appRoot,
  "artifacts",
  "harness-queue-menu-smoke.png",
);
const repositoryMenuOutput = join(
  appRoot,
  "artifacts",
  "harness-repository-menu-smoke.png",
);
const lightNarrowRepositoryMenuOutput = join(
  appRoot,
  "artifacts",
  "harness-repository-menu-light-narrow-smoke.png",
);
const lightNarrowTurnOutput = join(
  appRoot,
  "artifacts",
  "harness-turn-light-narrow-smoke.png",
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
  unlink(streamingOutput).catch(() => undefined),
  unlink(commandOutput).catch(() => undefined),
  unlink(newTaskBrandOutput).catch(() => undefined),
  unlink(lightNarrowNewTaskBrandOutput).catch(() => undefined),
  unlink(planProgressOutput).catch(() => undefined),
  unlink(lightNarrowPlanProgressOutput).catch(() => undefined),
  unlink(scrolledAwayOutput).catch(() => undefined),
  unlink(expandedActivityOutput).catch(() => undefined),
  unlink(queueOutput).catch(() => undefined),
  unlink(queueMenuOutput).catch(() => undefined),
  unlink(repositoryMenuOutput).catch(() => undefined),
  unlink(lightNarrowRepositoryMenuOutput).catch(() => undefined),
  unlink(lightNarrowTurnOutput).catch(() => undefined),
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
const plan = [
  { status: "completed", step: "Inspect the conversation UI" },
  { status: "in_progress", step: "Implement live progress feedback" },
  { status: "pending", step: "Verify streaming interactions" },
  { status: "pending", step: "Run the desktop regression suite" },
];
harness.enqueueSse(
  planUpdateResponse("desktop-plan-1", "desktop-plan-call-1", plan),
);
const patch = `*** Begin Patch
*** Add File: progress-fixture.txt
+first line
+second line
*** End Patch`;
harness.enqueueSse(
  applyPatchResponse("desktop-patch-1", "desktop-patch-call-1", patch),
);
const command = `node -e "setTimeout(() => console.log('desktop command finished'), 2500)"`;
harness.enqueueSse(
  shellCommandResponse("desktop-command-1", "desktop-command-call-1", command),
);
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
    sandbox: "workspace-write",
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
    CODEX_DESKTOP_SMOKE_COMMAND_OUTPUT: commandOutput,
    CODEX_DESKTOP_SMOKE_NEW_TASK_BRAND_OUTPUT: newTaskBrandOutput,
    CODEX_DESKTOP_SMOKE_NEW_TASK_BRAND_LIGHT_NARROW_OUTPUT:
      lightNarrowNewTaskBrandOutput,
    CODEX_DESKTOP_SMOKE_PLAN_PROGRESS_OUTPUT: planProgressOutput,
    CODEX_DESKTOP_SMOKE_PLAN_PROGRESS_LIGHT_NARROW_OUTPUT:
      lightNarrowPlanProgressOutput,
    CODEX_DESKTOP_SMOKE_SCROLLED_AWAY_OUTPUT: scrolledAwayOutput,
    CODEX_DESKTOP_SMOKE_EXPANDED_ACTIVITY_OUTPUT: expandedActivityOutput,
    CODEX_DESKTOP_SMOKE_HARNESS: "1",
    CODEX_DESKTOP_SMOKE_HARNESS_RELEASE_URL: harness.releaseUrl,
    CODEX_DESKTOP_SMOKE_OUTPUT: output,
    CODEX_DESKTOP_SMOKE_PARTIAL: partialText,
    CODEX_DESKTOP_SMOKE_PROMPT: prompt,
    CODEX_DESKTOP_SMOKE_QUEUED_FINAL: queuedFinalText,
    CODEX_DESKTOP_SMOKE_QUEUED_PROMPT: queuedPrompt,
    CODEX_DESKTOP_SMOKE_QUEUE_MENU_OUTPUT: queueMenuOutput,
    CODEX_DESKTOP_SMOKE_QUEUE_OUTPUT: queueOutput,
    CODEX_DESKTOP_SMOKE_REPOSITORY_MENU_OUTPUT: repositoryMenuOutput,
    CODEX_DESKTOP_SMOKE_REPOSITORY_MENU_LIGHT_NARROW_OUTPUT:
      lightNarrowRepositoryMenuOutput,
    CODEX_DESKTOP_SMOKE_REPORT: reportOutput,
    CODEX_DESKTOP_SMOKE_STREAMING_OUTPUT: streamingOutput,
    CODEX_DESKTOP_SMOKE_TURN_LIGHT_NARROW_OUTPUT: lightNarrowTurnOutput,
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
    }, 75_000);
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
    access(streamingOutput),
    access(commandOutput),
    access(newTaskBrandOutput),
    access(lightNarrowNewTaskBrandOutput),
    access(planProgressOutput),
    access(lightNarrowPlanProgressOutput),
    access(scrolledAwayOutput),
    access(expandedActivityOutput),
    access(queueOutput),
    access(queueMenuOutput),
    access(repositoryMenuOutput),
    access(lightNarrowRepositoryMenuOutput),
    access(lightNarrowTurnOutput),
    access(reportOutput),
  ]);
  const [
    screenshot,
    streamingScreenshot,
    commandScreenshot,
    newTaskBrandScreenshot,
    lightNarrowNewTaskBrandScreenshot,
    planProgressScreenshot,
    lightNarrowPlanProgressScreenshot,
    scrolledAwayScreenshot,
    expandedActivityScreenshot,
    queueScreenshot,
    queueMenuScreenshot,
    repositoryMenuScreenshot,
    lightNarrowRepositoryMenuScreenshot,
    lightNarrowTurnScreenshot,
    reportJson,
  ] = await Promise.all([
    readFile(output),
    readFile(streamingOutput),
    readFile(commandOutput),
    readFile(newTaskBrandOutput),
    readFile(lightNarrowNewTaskBrandOutput),
    readFile(planProgressOutput),
    readFile(lightNarrowPlanProgressOutput),
    readFile(scrolledAwayOutput),
    readFile(expandedActivityOutput),
    readFile(queueOutput),
    readFile(queueMenuOutput),
    readFile(repositoryMenuOutput),
    readFile(lightNarrowRepositoryMenuOutput),
    readFile(lightNarrowTurnOutput),
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
    streamingScreenshot.length < 20_000 ||
    streamingScreenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    commandScreenshot.length < 20_000 ||
    commandScreenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    newTaskBrandScreenshot.length < 20_000 ||
    newTaskBrandScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    lightNarrowNewTaskBrandScreenshot.length < 20_000 ||
    lightNarrowNewTaskBrandScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    planProgressScreenshot.length < 20_000 ||
    planProgressScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    lightNarrowPlanProgressScreenshot.length < 20_000 ||
    lightNarrowPlanProgressScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    scrolledAwayScreenshot.length < 20_000 ||
    scrolledAwayScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    expandedActivityScreenshot.length < 20_000 ||
    expandedActivityScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    queueScreenshot.length < 20_000 ||
    queueScreenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    queueMenuScreenshot.length < 20_000 ||
    queueMenuScreenshot.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    repositoryMenuScreenshot.length < 20_000 ||
    repositoryMenuScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    lightNarrowRepositoryMenuScreenshot.length < 20_000 ||
    lightNarrowRepositoryMenuScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a" ||
    lightNarrowTurnScreenshot.length < 20_000 ||
    lightNarrowTurnScreenshot.subarray(0, 8).toString("hex") !==
      "89504e470d0a1a0a"
  ) {
    throw new Error(
      `Harness smoke screenshot is invalid (${screenshot.length} bytes).`,
    );
  }
  if (
    report.prompt !== prompt ||
    !report.completionControlsDelayed ||
    !report.completionControlsRendered ||
    !report.commandStateRendered ||
    !report.dockedEnvironmentPanelRendered ||
    !report.environmentPanelRendered ||
    !report.activePlanProgressRendered ||
    !report.newTaskBrandRendered ||
    !report.lightNarrowNewTaskBrandRendered ||
    !report.lightNarrowEnvironmentPanelRendered ||
    !report.lightNarrowPlanProgressRendered ||
    !report.completedActivityExpanded ||
    !report.partialRendered ||
    !report.finalRendered ||
    !report.queueEdited ||
    !report.repositoryMenuRendered ||
    !report.scrolledAwayWorkingIndicatorRendered ||
    !report.lightNarrowRepositoryMenuRendered ||
    report.queuedPrompt !== queuedPrompt ||
    !report.queuedTurnCompleted ||
    !report.turnCompleted ||
    !report.writingPlanProgressRendered ||
    !report.workingStateRendered
  ) {
    throw new Error(`Harness smoke report is invalid: ${reportJson}`);
  }
  await gate.waitUntilReady();
  if (!gate.released)
    throw new Error("The desktop did not release the SSE gate");
  const requests = await harness.waitForRequests(5);
  if (
    !requests[0]
      ?.messageInputTexts("developer")
      .some((text) => text.includes("<codex-desktop.workspace>"))
  ) {
    throw new Error(
      "The real app-server request did not include desktop workspace context",
    );
  }
  if (!requests[0]?.messageInputTexts("user").includes(prompt)) {
    throw new Error(
      "The real app-server request did not include the desktop prompt",
    );
  }
  if (!requests[4]?.messageInputTexts("user").includes(queuedPrompt)) {
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
  await rm(temporaryRoot, {
    force: true,
    maxRetries: 3,
    recursive: true,
    retryDelay: 50,
  });
}
