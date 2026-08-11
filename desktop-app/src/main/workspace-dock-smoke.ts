import type { BrowserWindow } from "electron";

const SURFACE_TIMEOUT_MS = 8_000;

async function waitForSurface(
  window: BrowserWindow,
  expression: string,
  label: string,
  stableForMs = 0,
): Promise<void> {
  const deadline = Date.now() + SURFACE_TIMEOUT_MS;
  let visibleSince: number | null = null;
  while (Date.now() < deadline) {
    const visible = await window.webContents.executeJavaScript(
      expression,
      true,
    );
    if (visible === true) {
      visibleSince ??= Date.now();
      if (Date.now() - visibleSince >= stableForMs) return;
    } else {
      visibleSince = null;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for the ${label} dock surface`);
}

async function selectLauncherOption(
  window: BrowserWindow,
  label: string,
): Promise<void> {
  const opened = await window.webContents.executeJavaScript(
    `(() => {
      const button = document.querySelector('.workspace-tabs button[aria-label="Open workspace tool"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (opened !== true) throw new Error("Could not open the workspace launcher");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.workspace-open-menu'))`,
    "workspace launcher",
  );
  const selected = await window.webContents.executeJavaScript(
    `(() => {
      const button = Array.from(document.querySelectorAll('.workspace-open-options > button'))
        .find((candidate) => candidate.querySelector('span')?.textContent === ${JSON.stringify(label)});
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (selected !== true) {
    throw new Error(`Could not select ${label} from the workspace launcher`);
  }
}

export async function exerciseWorkspaceDock(
  window: BrowserWindow,
): Promise<void> {
  await selectLauncherOption(window, "File");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.file-explorer-surface .file-tree-row'))`,
    "Explorer",
  );

  const openedFile = await window.webContents.executeJavaScript(
    `(() => {
      const row = Array.from(document.querySelectorAll('.file-explorer-surface .file-tree-row'))
        .find((candidate) => candidate.textContent?.includes('capture-ui.mjs'));
      if (!(row instanceof HTMLButtonElement)) return false;
      row.click();
      return true;
    })()`,
    true,
  );
  if (openedFile !== true) throw new Error("Explorer could not open a file");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.editor-wrap .monaco-editor'))`,
    "Code",
  );

  const openedChanges = await window.webContents.executeJavaScript(
    `(() => {
      const button = Array.from(document.querySelectorAll('.change-actions > button, .thread-changes-header > button'))
        .find((candidate) => candidate.textContent?.trim() === 'Changes' || candidate.textContent?.trim() === 'Review');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (openedChanges !== true) throw new Error("Could not open Changes");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.change-review-panel'))`,
    "Changes",
  );

  await selectLauncherOption(window, "Terminal");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.terminal-container .xterm'))`,
    "Terminal",
  );

  await selectLauncherOption(window, "Canvas");
  await waitForSurface(
    window,
    `Boolean(
      document.querySelector('.workspace-panel:not(.workspace-panel-hidden)') &&
      document.querySelector('.workspace-tool-tab')?.textContent?.trim() === 'Canvas' &&
      document.querySelector('.preview-viewport iframe') &&
      !document.querySelector('.preview-loading')
    )`,
    "Canvas",
  );

  await selectLauncherOption(window, "Browser");
  await waitForSurface(
    window,
    `Boolean(
      document.querySelector('.workspace-panel:not(.workspace-panel-hidden)') &&
      document.querySelector('.workspace-tool-tab')?.textContent?.trim() === 'Browser' &&
      document.querySelector('.embedded-browser-viewport[data-ready="true"]')
    )`,
    "Browser",
  );

  const closedWorkspace = await window.webContents.executeJavaScript(
    `(() => {
      const button = document.querySelector('.workspace-tab-actions button[aria-label="Hide workspace panel"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (closedWorkspace !== true) throw new Error("Could not close workspace");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.workspace-panel.workspace-panel-hidden'))`,
    "closed workspace",
  );

  const reopenedWorkspace = await window.webContents.executeJavaScript(
    `(() => {
      const button = document.querySelector('.conversation-header button[aria-label="Show Apps"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (reopenedWorkspace !== true) throw new Error("Could not reopen workspace");
  await waitForSurface(
    window,
    `Boolean(
      document.querySelector('.workspace-panel:not(.workspace-panel-hidden)') &&
      document.querySelector('.workspace-tool-tab')?.textContent?.trim() === 'Browser' &&
      document.querySelector('.embedded-browser-viewport[data-ready="true"]')
    )`,
    "reopened Browser",
    250,
  );

  const openedLauncher = await window.webContents.executeJavaScript(
    `(() => {
      const button = document.querySelector('.workspace-tabs button[aria-label="Open workspace tool"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (openedLauncher !== true) {
    throw new Error("Could not open the workspace launcher");
  }
  await waitForSurface(
    window,
    `Boolean(
      document.querySelector('.workspace-open-menu input[placeholder="Open any file, URL, …"]') &&
      document.querySelectorAll('.workspace-open-options > button').length === 4
    )`,
    "workspace launcher",
  );

  const submittedPrompt = await window.webContents.executeJavaScript(
    `(() => {
      const launcher = document.querySelector('.workspace-tabs button[aria-label="Open workspace tool"]');
      if (launcher instanceof HTMLButtonElement) launcher.click();
      const newChat = document.querySelector('.repository-new-task[aria-label="New chat in signal-arena"]');
      if (!(newChat instanceof HTMLButtonElement)) return false;
      newChat.click();
      return true;
    })()`,
    true,
  );
  if (submittedPrompt !== true) throw new Error("Could not start a new task");
  await waitForSurface(
    window,
    `Boolean(
      document.querySelector('.new-task-view textarea:not([disabled])') &&
      document.querySelector('.new-task-context-item > button')?.getAttribute('title')?.endsWith('/signal-arena')
    )`,
    "repository-scoped new-task composer",
  );

  const prompt = "Audit the coding workflow end to end";
  const enteredPrompt = await window.webContents.executeJavaScript(
    `(() => {
      const textarea = document.querySelector('.new-task-view textarea');
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, ${JSON.stringify(prompt)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    true,
  );
  if (enteredPrompt !== true)
    throw new Error("Could not enter the mock prompt");
  await waitForSurface(
    window,
    `Boolean(document.querySelector('.new-task-view button[aria-label="Send prompt"]:not([disabled])'))`,
    "enabled send button",
  );
  const sent = await window.webContents.executeJavaScript(
    `(() => {
      const button = document.querySelector('.new-task-view button[aria-label="Send prompt"]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`,
    true,
  );
  if (sent !== true) throw new Error("Could not submit the mock coding task");
  await waitForSurface(
    window,
    `(() => {
      const text = document.querySelector('.conversation-content')?.textContent ?? '';
      return Boolean(
        !document.querySelector('.renderer-error') &&
        text.includes(${JSON.stringify(prompt)}) &&
        text.includes('The mock coding workflow completed successfully.')
      );
    })()`,
    "completed coding workflow",
  );
}
