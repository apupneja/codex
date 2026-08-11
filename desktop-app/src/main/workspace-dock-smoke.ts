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
      document.querySelector('.workspace-tool-tab.active')?.textContent?.trim() === 'Canvas' &&
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
      document.querySelector('.workspace-tool-tab.active')?.textContent?.trim() === 'Browser' &&
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
      document.querySelector('.workspace-tool-tab.active')?.textContent?.trim() === 'Browser' &&
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

  const prompt = [
    "Good UI typography stays invisible.",
    "Long requests should remain easy to scan at a glance.",
    "The third visible line fades naturally into the card.",
    "Everything below remains available when the prompt is expanded.",
    "Nothing should be discarded or rewritten.",
  ].join("\n");
  const context = [
    "A unified workflow source",
    "with repository context",
    "and deployment constraints",
    "plus customer requirements",
    "that span several teams",
    "with explicit review gates",
    "and production safeguards",
    "before final acceptance.",
  ].join("\n");
  const pastedContext = await window.webContents.executeJavaScript(
    `(() => {
      const textarea = document.querySelector('.new-task-view textarea');
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      const data = new DataTransfer();
      data.setData('text/plain', ${JSON.stringify(context)});
      textarea.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        clipboardData: data,
      }));
      return true;
    })()`,
    true,
  );
  if (pastedContext !== true) throw new Error("Could not paste mock context");
  await waitForSurface(
    window,
    `Boolean(
      document.querySelector('.context-block-card') &&
      document.querySelector('.new-task-view textarea')?.value === ''
    )`,
    "collapsed composer context",
  );
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
        text.includes('The mock coding workflow completed successfully.') &&
        document.querySelector('.submitted-context-chip')?.textContent?.includes('A unified workflow source') &&
        document.querySelector('.reasoning-item .activity-summary')?.getAttribute('aria-expanded') === 'true' &&
        document.querySelector('.reasoning-detail')?.textContent?.includes('independently open')
      );
    })()`,
    "completed coding workflow",
  );
  await waitForSurface(
    window,
    `(() => {
      const content = document.querySelector('.conversation-content');
      const latestMessage = document.querySelector('.conversation-content > .turn:last-of-type > .user-message-group');
      const owningTurn = latestMessage?.closest('.turn');
      if (!(content instanceof HTMLElement) || !(latestMessage instanceof HTMLElement) || !(owningTurn instanceof HTMLElement)) return false;
      const messageRect = latestMessage.getBoundingClientRect();
      const turnRect = owningTurn.getBoundingClientRect();
      const userStyle = getComputedStyle(latestMessage.querySelector('.user-message'));
      const agentStyle = getComputedStyle(owningTurn.querySelector('.agent-message'));
      return parseFloat(getComputedStyle(content).paddingTop) > 0 &&
        getComputedStyle(latestMessage).position === 'sticky' &&
        Math.abs(messageRect.width - turnRect.width) < 1 &&
        userStyle.fontSize === '15px' &&
        agentStyle.fontSize === '15px' &&
        parseFloat(agentStyle.lineHeight) >= 22;
    })()`,
    "full-width sticky turn query",
  );
  await waitForSurface(
    window,
    `(() => {
      const preview = document.querySelector('.conversation-content > .turn:last-of-type .user-message-text');
      if (!(preview instanceof HTMLElement)) return false;
      const style = getComputedStyle(preview);
      return preview.getAttribute('aria-expanded') === 'false' &&
        preview.classList.contains('is-overflowing') &&
        Math.abs(parseFloat(style.maxHeight) - parseFloat(style.lineHeight) * 3) < 1 &&
        style.maskImage !== 'none' &&
        preview.scrollHeight > preview.clientHeight;
    })()`,
    "three-line user-message preview",
  );
  const expandedPreview = await window.webContents.executeJavaScript(
    `(() => {
      const preview = document.querySelector('.conversation-content > .turn:last-of-type .user-message-text');
      if (!(preview instanceof HTMLElement)) return false;
      preview.click();
      return true;
    })()`,
    true,
  );
  if (expandedPreview !== true) {
    throw new Error("Could not expand the user-message preview");
  }
  await waitForSurface(
    window,
    `(() => {
      const preview = document.querySelector('.conversation-content > .turn:last-of-type .user-message-text');
      return preview instanceof HTMLElement &&
        preview.getAttribute('aria-expanded') === 'true' &&
        preview.classList.contains('is-expanded') &&
        preview.clientHeight > parseFloat(getComputedStyle(preview).lineHeight) * 3;
    })()`,
    "expanded user message",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('.conversation-content > .turn:last-of-type .user-message-text')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))`,
    true,
  );
  await waitForSurface(
    window,
    `document.querySelector('.conversation-content > .turn:last-of-type .user-message-text')?.getAttribute('aria-expanded') === 'false'`,
    "keyboard-collapsed user message",
  );
  const followUpDraft =
    "Check the production layout at this width and keep the controls below this naturally wrapped multiline draft";
  const enteredFollowUp = await window.webContents.executeJavaScript(
    `(() => {
      const textarea = document.querySelector('.conversation-composer-wrap textarea');
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, ${JSON.stringify(followUpDraft)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    true,
  );
  if (enteredFollowUp !== true) {
    throw new Error("Could not enter the multiline follow-up");
  }
  await waitForSurface(
    window,
    `(() => {
      const row = document.querySelector('.conversation-composer-wrap .compact-composer-row.multiline');
      const controls = row?.querySelector('.compact-composer-controls');
      return Boolean(
        row &&
        controls?.querySelectorAll('[role="combobox"]').length === 1 &&
        controls.querySelector('[role="combobox"]')?.textContent?.includes('Composer 2.5 Fast') &&
        !controls.querySelector('.lucide-lock-keyhole')
      );
    })()`,
    "multiline composer with unified model selection",
  );
}
