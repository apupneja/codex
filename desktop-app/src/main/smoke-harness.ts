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
  const prompt = requiredEnvironment("CODEX_DESKTOP_SMOKE_PROMPT");
  const partialText = requiredEnvironment("CODEX_DESKTOP_SMOKE_PARTIAL");
  const finalText = requiredEnvironment("CODEX_DESKTOP_SMOKE_FINAL");
  const releaseUrl = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_HARNESS_RELEASE_URL",
  );

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
      const active = Boolean(document.querySelector('button[aria-label="Stop task"]'));
      return active && text.includes(${JSON.stringify(partialText)}) && !text.includes(${JSON.stringify(finalText)})
        ? { active, text }
        : false;
    })()`,
    "the partial streamed answer",
  );
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
      const active = Boolean(document.querySelector('button[aria-label="Stop task"]'));
      const streamingTurn = Boolean(document.querySelector('.turn.is-streaming, .turn-working'));
      return !active && !streamingTurn && text.includes(${JSON.stringify(finalText)})
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
    turnCompleted: !completed.active && !completed.streamingTurn,
  };
  const image = await window.webContents.capturePage();
  await Promise.all([
    mkdir(dirname(destination), { recursive: true }),
    mkdir(dirname(reportDestination), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(destination, image.toPNG()),
    writeFile(reportDestination, JSON.stringify(report, null, 2)),
  ]);
}
