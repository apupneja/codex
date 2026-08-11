import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { BrowserWindow, net } from "electron";

const DEFAULT_TIMEOUT_MS = 20_000;

type HarnessSmokeReport = {
  finalRendered: boolean;
  finalText: string;
  partialRendered: boolean;
  partialText: string;
  prompt: string;
  queueEdited: boolean;
  queuedPrompt: string;
  queuedTurnCompleted: boolean;
  turnCompleted: boolean;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for harness smoke tests`);
  return value;
}

async function waitForRenderer<T>(
  window: BrowserWindow,
  expression: string,
  description: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      throw new Error(`The renderer closed while waiting for ${description}`);
    }
    const result = (await window.webContents.executeJavaScript(
      expression,
      true,
    )) as T | false;
    if (result !== false) return result;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

export function harnessSmokeRequested(): boolean {
  return process.env.CODEX_DESKTOP_SMOKE_HARNESS === "1";
}

export async function runHarnessSmoke(window: BrowserWindow): Promise<void> {
  const destination = requiredEnvironment("CODEX_DESKTOP_SMOKE_OUTPUT");
  const reportDestination = requiredEnvironment("CODEX_DESKTOP_SMOKE_REPORT");
  const queueDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_QUEUE_OUTPUT",
  );
  const queueMenuDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_QUEUE_MENU_OUTPUT",
  );
  const prompt = requiredEnvironment("CODEX_DESKTOP_SMOKE_PROMPT");
  const partialText = requiredEnvironment("CODEX_DESKTOP_SMOKE_PARTIAL");
  const finalText = requiredEnvironment("CODEX_DESKTOP_SMOKE_FINAL");
  const releaseUrl = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_HARNESS_RELEASE_URL",
  );
  const queuedFinalText = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_QUEUED_FINAL",
  );
  const queuedPrompt = requiredEnvironment("CODEX_DESKTOP_SMOKE_QUEUED_PROMPT");

  await waitForRenderer(
    window,
    `Boolean(document.querySelector('.new-task-view textarea:not([disabled])'))`,
    "the new-task composer",
  );
  await window.webContents.executeJavaScript(
    `(() => {
      localStorage.setItem('codex-workspace-dock-tab', 'browser');
      const textarea = document.querySelector('.new-task-view textarea');
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, ${JSON.stringify(prompt)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    true,
  );
  await waitForRenderer(
    window,
    `Boolean(document.querySelector('.new-task-view button[aria-label="Send prompt"]:not([disabled])'))`,
    "the enabled send button",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('.new-task-view button[aria-label="Send prompt"]')?.click()`,
    true,
  );

  const partial = await waitForRenderer<{ active: boolean; text: string }>(
    window,
    `(() => {
      const text = document.querySelector('.conversation-content')?.textContent ?? '';
      const active = Boolean(document.querySelector('button[aria-label="Stop generation"]'));
      const modelLocked = Boolean(document.querySelector('button[aria-label="Model"]:disabled'));
      const duplicateProgress = Boolean(document.querySelector('.turn-working'));
      return active && modelLocked && !duplicateProgress && text.includes(${JSON.stringify(partialText)}) && !text.includes(${JSON.stringify(finalText)})
        ? { active, text }
        : false;
    })()`,
    "the partial streamed answer",
  );
  await window.webContents.executeJavaScript(
    `(() => {
      const textarea = document.querySelector('.conversation-composer-wrap textarea');
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, ${JSON.stringify(queuedPrompt)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    true,
  );
  await waitForRenderer(
    window,
    `Boolean(document.querySelector('button[aria-label="Queue prompt"]:not([disabled])'))`,
    "the queue prompt action",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Queue prompt"]')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `document.querySelector('.prompt-queue')?.textContent?.includes(${JSON.stringify(queuedPrompt)}) ?? false`,
    "the queued follow-up",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('.queued-prompt-menu-wrap > button')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `Boolean([...document.querySelectorAll('.queued-prompt-menu button')].find((button) => button.textContent?.includes('Edit prompt')))`,
    "the queued prompt edit action",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const queueMenuImage = (await window.webContents.capturePage()).toPNG();
  await window.webContents.executeJavaScript(
    `[...document.querySelectorAll('.queued-prompt-menu button')].find((button) => button.textContent?.includes('Edit prompt'))?.click()`,
    true,
  );
  const queueEdited = await waitForRenderer<boolean>(
    window,
    `(() => {
      const textarea = document.querySelector('.conversation-composer-wrap textarea');
      return textarea instanceof HTMLTextAreaElement && textarea.value === ${JSON.stringify(queuedPrompt)} && !document.querySelector('.prompt-queue');
    })()`,
    "the queued prompt restored to the composer",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Queue prompt"]')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `(() => {
      const queue = document.querySelector('.prompt-queue');
      const textarea = document.querySelector('.conversation-composer-wrap textarea');
      if (!(queue instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) return false;
      const rect = queue.getBoundingClientRect();
      return queue.textContent?.includes(${JSON.stringify(queuedPrompt)}) && textarea.value === '' && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
    })()`,
    "the edited prompt re-queued",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const queueImage = (await window.webContents.capturePage()).toPNG();
  const releaseResponse = await net.fetch(releaseUrl, { method: "POST" });
  if (!releaseResponse.ok) {
    throw new Error(
      `Harness gate release failed with HTTP ${releaseResponse.status}`,
    );
  }
  const completed = await waitForRenderer<{
    active: boolean;
    streamingTurn: boolean;
    text: string;
  }>(
    window,
    `(() => {
      const text = document.querySelector('.conversation-content')?.textContent ?? '';
      const active = Boolean(document.querySelector('button[aria-label="Stop generation"]'));
      const streamingTurn = Boolean(document.querySelector('.turn.is-streaming, .turn-working'));
      return !active && !streamingTurn && text.includes(${JSON.stringify(finalText)}) && text.includes(${JSON.stringify(queuedFinalText)})
        ? { active, streamingTurn, text }
        : false;
    })()`,
    "the completed streamed answer",
  );
  await waitForRenderer(
    window,
    `(() => {
      const workspace = document.querySelector('.main-workspace')?.getBoundingClientRect();
      return !document.querySelector('.workspace-dock-rail') && workspace && Math.abs(workspace.right - window.innerWidth) < 1;
    })()`,
    "the rail-free workspace layout",
  );

  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );

  const report: HarnessSmokeReport = {
    finalRendered: completed.text.includes(finalText),
    finalText,
    partialRendered:
      partial.active &&
      partial.text.includes(partialText) &&
      !partial.text.includes(finalText),
    partialText,
    prompt,
    queueEdited,
    queuedPrompt,
    queuedTurnCompleted: completed.text.includes(queuedFinalText),
    turnCompleted: !completed.active && !completed.streamingTurn,
  };
  const image = await window.webContents.capturePage();
  await Promise.all([
    mkdir(dirname(destination), { recursive: true }),
    mkdir(dirname(queueDestination), { recursive: true }),
    mkdir(dirname(queueMenuDestination), { recursive: true }),
    mkdir(dirname(reportDestination), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(destination, image.toPNG()),
    writeFile(queueDestination, queueImage),
    writeFile(queueMenuDestination, queueMenuImage),
    writeFile(reportDestination, JSON.stringify(report, null, 2)),
  ]);
}
