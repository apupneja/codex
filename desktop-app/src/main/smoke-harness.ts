import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { BrowserWindow, net } from "electron";

const DEFAULT_TIMEOUT_MS = 20_000;

type HarnessSmokeReport = {
  activePlanProgressRendered: boolean;
  commandStateRendered: boolean;
  completedActivityExpanded: boolean;
  completionControlsDelayed: boolean;
  completionControlsRendered: boolean;
  dockedEnvironmentPanelRendered: boolean;
  environmentPanelRendered: boolean;
  finalRendered: boolean;
  finalText: string;
  lightNarrowRepositoryMenuRendered: boolean;
  lightNarrowNewTaskBrandRendered: boolean;
  lightNarrowPlanProgressRendered: boolean;
  lightNarrowEnvironmentPanelRendered: boolean;
  newTaskBrandRendered: boolean;
  partialRendered: boolean;
  partialText: string;
  prompt: string;
  queueEdited: boolean;
  queuedPrompt: string;
  queuedTurnCompleted: boolean;
  repositoryMenuRendered: boolean;
  scrolledAwayWorkingIndicatorRendered: boolean;
  turnCompleted: boolean;
  writingPlanProgressRendered: boolean;
  workingStateRendered: boolean;
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
  const streamingDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_STREAMING_OUTPUT",
  );
  const commandDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_COMMAND_OUTPUT",
  );
  const newTaskBrandDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_NEW_TASK_BRAND_OUTPUT",
  );
  const lightNarrowNewTaskBrandDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_NEW_TASK_BRAND_LIGHT_NARROW_OUTPUT",
  );
  const planProgressDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_PLAN_PROGRESS_OUTPUT",
  );
  const lightNarrowPlanProgressDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_PLAN_PROGRESS_LIGHT_NARROW_OUTPUT",
  );
  const scrolledAwayDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_SCROLLED_AWAY_OUTPUT",
  );
  const expandedActivityDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_EXPANDED_ACTIVITY_OUTPUT",
  );
  const reportDestination = requiredEnvironment("CODEX_DESKTOP_SMOKE_REPORT");
  const queueDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_QUEUE_OUTPUT",
  );
  const queueMenuDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_QUEUE_MENU_OUTPUT",
  );
  const repositoryMenuDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_REPOSITORY_MENU_OUTPUT",
  );
  const lightNarrowRepositoryMenuDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_REPOSITORY_MENU_LIGHT_NARROW_OUTPUT",
  );
  const lightNarrowTurnDestination = requiredEnvironment(
    "CODEX_DESKTOP_SMOKE_TURN_LIGHT_NARROW_OUTPUT",
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
  const originalWindowBounds = window.getBounds();

  await waitForRenderer(
    window,
    `Boolean(document.querySelector('.new-task-view textarea:not([disabled])'))`,
    "the new-task composer",
  );
  const newTaskBrandRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const hero = document.querySelector('.hero-mark');
      const mark = hero?.querySelector('.codex-mark');
      if (!(hero instanceof HTMLElement) || !(mark instanceof SVGElement)) return false;
      const style = getComputedStyle(hero);
      const bounds = mark.getBoundingClientRect();
      return style.backgroundImage === 'none'
        && style.borderTopWidth === '0px'
        && style.boxShadow === 'none'
        && mark.getAttribute('viewBox') === '0 0 1024 1024'
        && bounds.width === 48
        && bounds.height === 48;
    })()`,
    "the unboxed Codex brand mark",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const newTaskBrandImage = (await window.webContents.capturePage()).toPNG();
  await window.webContents.executeJavaScript(
    `(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.dataset.themeVariant = 'light';
      document.documentElement.style.colorScheme = 'light';
    })()`,
    true,
  );
  window.setSize(620, 720, false);
  const lightNarrowNewTaskBrandRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const hero = document.querySelector('.hero-mark');
      const mark = hero?.querySelector('.codex-mark');
      const bounds = mark?.getBoundingClientRect();
      const style = hero ? getComputedStyle(hero) : null;
      return Boolean(bounds
        && style
        && document.documentElement.dataset.themeVariant === 'light'
        && bounds.left >= 0
        && bounds.top >= 0
        && bounds.right <= window.innerWidth
        && bounds.bottom <= window.innerHeight
        && style.backgroundImage === 'none'
        && style.borderTopWidth === '0px'
        && style.boxShadow === 'none');
    })()`,
    "the light narrow unboxed Codex brand mark",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const lightNarrowNewTaskBrandImage = (
    await window.webContents.capturePage()
  ).toPNG();
  await window.webContents.executeJavaScript(
    `(() => {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.dataset.themeVariant = 'dark';
      document.documentElement.style.colorScheme = 'dark';
    })()`,
    true,
  );
  window.setSize(
    originalWindowBounds.width,
    originalWindowBounds.height,
    false,
  );
  await waitForRenderer(
    window,
    `document.documentElement.dataset.themeVariant === 'dark' && window.innerWidth > 1000`,
    "the restored wide new-task layout",
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

  const commandStateRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const summary = [...document.querySelectorAll('button.turn-activity-summary')]
        .find((element) => element.textContent?.includes('Running'));
      const activity = summary?.closest('.turn-activity');
      const completionHidden = !document.querySelector('button[aria-label="Helpful response"]')
        && ![...document.querySelectorAll('.turn-activity-summary')]
          .some((element) => element.textContent?.includes('Worked'));
      return Boolean(summary?.getAttribute('aria-expanded') === 'false'
        && activity?.classList.contains('is-active')
        && !activity.querySelector('.command-item')
        && document.querySelector('.context-ring-spinner')
        && completionHidden);
    })()`,
    "the compact live command activity",
  );
  await waitForRenderer(
    window,
    `!document.querySelector('[aria-label="Environment"]') && (document.querySelector('.conversation-stage')?.getBoundingClientRect().width ?? Infinity) < 904`,
    "the compact conversation layout without an automatic environment overlay",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Toggle Environment"]')?.click()`,
    true,
  );
  const environmentPanelRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const panel = document.querySelector('[aria-label="Environment"]');
      const stage = document.querySelector('.conversation-stage');
      const bounds = panel?.getBoundingClientRect();
      const stageBounds = stage?.getBoundingClientRect();
      const text = panel?.textContent ?? '';
      return Boolean(bounds
        && stageBounds
        && panel?.classList.contains('environment-panel-drawer')
        && panel.getAttribute('role') === 'dialog'
        && document.querySelector('.environment-panel-scrim')
        && bounds.width >= 320
        && bounds.left >= stageBounds.left
        && bounds.top >= stageBounds.top
        && bounds.right <= stageBounds.right
        && bounds.bottom <= stageBounds.bottom
        && bounds.height < stageBounds.height - 24
        && text.includes('Changes')
        && text.includes('Computer Use')
        && text.includes('Sources'));
    })()`,
    "the compact environment drawer",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => setTimeout(resolve, 250))`,
    true,
  );
  const commandImage = (await window.webContents.capturePage()).toPNG();
  await window.webContents.executeJavaScript(
    `document.querySelector('.environment-panel-drawer button[aria-label="Close Environment"]')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `!document.querySelector('[aria-label="Environment"]')`,
    "the closed compact environment drawer",
  );
  const activePlanProgressRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const trigger = document.querySelector('button.active-turn-progress-trigger');
      return Boolean(trigger
        && trigger.getAttribute('aria-expanded') === 'false'
        && trigger.textContent?.includes('Step 2 / 4')
        && trigger.textContent?.includes('1 file changed')
        && trigger.textContent?.includes('+2')
        && trigger.textContent?.includes('−0'));
    })()`,
    "the compact active plan progress",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button.active-turn-progress-trigger')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `(() => {
      const trigger = document.querySelector('button.active-turn-progress-trigger');
      const progress = document.querySelector('[aria-label="Task progress details"]');
      return trigger?.getAttribute('aria-expanded') === 'true'
        && progress?.querySelectorAll('.active-turn-progress-step').length === 4
        && Boolean(progress.querySelector('.active-turn-progress-step.is-inProgress'));
    })()`,
    "the expanded active plan progress",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => setTimeout(resolve, 250))`,
    true,
  );
  const planProgressImage = (await window.webContents.capturePage()).toPNG();

  await window.webContents.executeJavaScript(
    `(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.dataset.themeVariant = 'light';
      document.documentElement.style.colorScheme = 'light';
    })()`,
    true,
  );
  window.setSize(620, 720, false);
  const lightNarrowPlanProgressRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const trigger = document.querySelector('button.active-turn-progress-trigger');
      const progress = document.querySelector('[aria-label="Task progress details"]');
      const bounds = progress?.getBoundingClientRect();
      return Boolean(trigger
        && progress
        && bounds
        && bounds.left >= 0
        && bounds.top >= 0
        && bounds.right <= window.innerWidth
        && bounds.bottom <= window.innerHeight);
    })()`,
    "the light narrow active plan progress",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => setTimeout(resolve, 250))`,
    true,
  );
  const lightNarrowPlanProgressImage = (
    await window.webContents.capturePage()
  ).toPNG();
  await window.webContents.executeJavaScript(
    `(() => {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.dataset.themeVariant = 'dark';
      document.documentElement.style.colorScheme = 'dark';
      document.querySelector('button.active-turn-progress-trigger')?.click();
    })()`,
    true,
  );
  window.setSize(
    originalWindowBounds.width,
    originalWindowBounds.height,
    false,
  );
  await waitForRenderer(
    window,
    `document.documentElement.dataset.themeVariant === 'dark' && !document.querySelector('[aria-label="Task progress details"]')`,
    "the restored wide active layout",
  );
  await window.webContents.executeJavaScript(
    `(() => {
      const scroll = document.querySelector('.conversation-scroll');
      const content = document.querySelector('.conversation-content');
      if (!(scroll instanceof HTMLElement) || !(content instanceof HTMLElement)) return false;
      content.style.minHeight = String(scroll.clientHeight + 800) + 'px';
      scroll.scrollTop = 0;
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
      return true;
    })()`,
    true,
  );
  const scrolledAwayWorkingIndicatorRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const button = document.querySelector('button[aria-label="Agent working — scroll to latest"]');
      return Boolean(button
        && button.querySelectorAll('.scroll-working-dots > span').length === 3
        && document.querySelector('.context-ring-spinner'));
    })()`,
    "the offscreen working indicator",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const scrolledAwayImage = (await window.webContents.capturePage()).toPNG();
  await window.webContents.executeJavaScript(
    `(() => {
      const scroll = document.querySelector('.conversation-scroll');
      const content = document.querySelector('.conversation-content');
      if (!(scroll instanceof HTMLElement) || !(content instanceof HTMLElement)) return false;
      content.style.minHeight = '';
      scroll.scrollTop = scroll.scrollHeight;
      scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
      return true;
    })()`,
    true,
  );

  const partial = await waitForRenderer<{
    active: boolean;
    completionControlsDelayed: boolean;
    text: string;
    writingPlanProgressRendered: boolean;
    workingStateRendered: boolean;
  }>(
    window,
    `(() => {
      const text = document.querySelector('.conversation-content')?.textContent ?? '';
      const active = Boolean(document.querySelector('button[aria-label="Stop generation"]'));
      const modelLocked = Boolean(document.querySelector('button[aria-label="Model"]:disabled'));
      const workingStateRendered = [...document.querySelectorAll('.turn-activity-summary')]
        .some((element) => element.textContent?.includes('Writing response'));
      const writingPlanProgressRendered = document.querySelector('button.active-turn-progress-trigger')
        ?.textContent?.includes('Step 2 / 4') ?? false;
      const completionControlsDelayed = !document.querySelector('button[aria-label="Helpful response"]')
        && ![...document.querySelectorAll('.turn-activity-summary')]
          .some((element) => element.textContent?.includes('Worked'));
      return active && modelLocked && workingStateRendered && writingPlanProgressRendered && completionControlsDelayed && text.includes(${JSON.stringify(partialText)}) && !text.includes(${JSON.stringify(finalText)})
        ? { active, completionControlsDelayed, text, writingPlanProgressRendered, workingStateRendered }
        : false;
    })()`,
    "the partial streamed answer",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const streamingImage = (await window.webContents.capturePage()).toPNG();
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
    completionControlsRendered: boolean;
    streamingTurn: boolean;
    text: string;
  }>(
    window,
    `(() => {
      const text = document.querySelector('.conversation-content')?.textContent ?? '';
      const active = Boolean(document.querySelector('button[aria-label="Stop generation"]'));
      const streamingTurn = Boolean(document.querySelector('.turn.is-streaming'));
      const helpful = document.querySelector('button[aria-label="Helpful response"]');
      const worked = [...document.querySelectorAll('.turn-activity-summary')]
        .find((element) => element.textContent?.includes('Worked'));
      const completionControlsRendered = Boolean(helpful
        && worked
        && helpful.closest('.turn-activity-header') === worked.closest('.turn-activity-header'));
      return !active && !streamingTurn && completionControlsRendered && text.includes(${JSON.stringify(finalText)}) && text.includes(${JSON.stringify(queuedFinalText)})
        ? { active, completionControlsRendered, streamingTurn, text }
        : false;
    })()`,
    "the completed streamed answer",
  );
  await window.webContents.executeJavaScript(
    `(() => {
      const workspace = document.querySelector('.workspace-panel:not(.workspace-panel-hidden)');
      if (workspace) document.querySelector('button[aria-label="Show Apps"]')?.click();
    })()`,
    true,
  );
  await waitForRenderer(
    window,
    `(() => {
      const stage = document.querySelector('.conversation-stage');
      return !document.querySelector('.workspace-panel:not(.workspace-panel-hidden)')
        && (stage?.getBoundingClientRect().width ?? 0) >= 904;
    })()`,
    "the wide conversation lane",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Toggle Environment"]')?.click()`,
    true,
  );
  const dockedEnvironmentPanelRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const stage = document.querySelector('.conversation-stage')?.getBoundingClientRect();
      const main = document.querySelector('.conversation-main')?.getBoundingClientRect();
      const content = document.querySelector('.conversation-content')?.getBoundingClientRect();
      const panel = document.querySelector('.environment-panel-docked')?.getBoundingClientRect();
      return Boolean(stage
        && main
        && content
        && panel
        && panel.width >= 320
        && panel.left > main.right
        && panel.right <= stage.right
        && panel.height < stage.height - 24
        && Math.abs((content.left + content.right) / 2 - (main.left + main.right) / 2) < 1);
    })()`,
    "the docked environment rail and centered chat lane",
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

  await window.webContents.executeJavaScript(
    `(() => {
      const disclosure = [...document.querySelectorAll('button.turn-activity-summary')]
        .find((element) => element.textContent?.includes('Worked'));
      disclosure?.click();
      return Boolean(disclosure);
    })()`,
    true,
  );
  const completedActivityExpanded = await waitForRenderer<boolean>(
    window,
    `(() => {
      const disclosure = [...document.querySelectorAll('button.turn-activity-summary')]
        .find((element) => element.textContent?.includes('Worked'));
      return disclosure?.getAttribute('aria-expanded') === 'true'
        && Boolean(disclosure.closest('.turn-activity')?.querySelector('.command-item'));
    })()`,
    "the expanded completed activity",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const expandedActivityImage = (
    await window.webContents.capturePage()
  ).toPNG();
  await window.webContents.executeJavaScript(
    `(() => {
      const disclosure = [...document.querySelectorAll('button.turn-activity-summary')]
        .find((element) => element.textContent?.includes('Worked') && element.getAttribute('aria-expanded') === 'true');
      disclosure?.click();
    })()`,
    true,
  );

  await window.webContents.executeJavaScript(
    `(() => {
      const repository = document.querySelector('.sidebar-row-repository');
      if (!(repository instanceof HTMLElement)) return false;
      const bounds = repository.getBoundingClientRect();
      repository.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        button: 2,
        clientX: bounds.right - 20,
        clientY: bounds.bottom,
      }));
      return true;
    })()`,
    true,
  );
  const repositoryMenuRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const menu = document.querySelector('.repository-context-menu');
      const text = menu?.textContent ?? '';
      const bounds = menu?.getBoundingClientRect();
      return Boolean(bounds && bounds.left >= 0 && bounds.top >= 0 && bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight && text.includes('Mark All as Read') && text.includes('Archive All') && text.includes('Remove from Sidebar'));
    })()`,
    "the repository context menu",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const repositoryMenuImage = (await window.webContents.capturePage()).toPNG();
  await window.webContents.executeJavaScript(
    `document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))`,
    true,
  );
  const image = await window.webContents.capturePage();

  await window.webContents.executeJavaScript(
    `(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.dataset.themeVariant = 'light';
      document.documentElement.style.colorScheme = 'light';
    })()`,
    true,
  );
  window.setSize(620, 720, false);
  await waitForRenderer(
    window,
    `document.documentElement.dataset.themeVariant === 'light' && Boolean(document.querySelector('button[aria-label="Show Sidebar"]')) && !document.querySelector('[aria-label="Environment"]')`,
    "the light narrow layout",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Toggle Environment"]')?.click()`,
    true,
  );
  const lightNarrowEnvironmentPanelRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
        const panel = document.querySelector('[aria-label="Environment"]');
        const stage = document.querySelector('.conversation-stage');
        const main = document.querySelector('.conversation-main');
        const bounds = panel?.getBoundingClientRect();
        const stageBounds = stage?.getBoundingClientRect();
        const mainBounds = main?.getBoundingClientRect();
        return Boolean(bounds
          && stageBounds
          && mainBounds
          && panel?.classList.contains('environment-panel-drawer')
          && panel.getAttribute('role') === 'dialog'
          && document.querySelector('.environment-panel-scrim')
          && bounds.width >= 320
          && bounds.left >= stageBounds.left
          && bounds.top >= stageBounds.top
          && bounds.right <= stageBounds.right
          && bounds.bottom <= stageBounds.bottom
          && bounds.height < stageBounds.height - 24
          && Math.abs(mainBounds.width - stageBounds.width) < 1);
      })()`,
    "the light narrow environment drawer",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => setTimeout(resolve, 250))`,
    true,
  );
  const lightNarrowTurnImage = (await window.webContents.capturePage()).toPNG();
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Toggle Environment"]')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `!document.querySelector('[aria-label="Environment"]')`,
    "the closed light narrow environment side panel",
  );
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Show Sidebar"]')?.click()`,
    true,
  );
  await waitForRenderer(
    window,
    `Boolean(document.querySelector('.narrow-sidebar-layer .sidebar-row-repository'))`,
    "the narrow sidebar overlay",
  );
  await window.webContents.executeJavaScript(
    `(() => {
      const repository = document.querySelector('.narrow-sidebar-layer .sidebar-row-repository');
      if (!(repository instanceof HTMLElement)) return false;
      const bounds = repository.getBoundingClientRect();
      repository.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        button: 2,
        clientX: bounds.right - 20,
        clientY: bounds.bottom,
      }));
      return true;
    })()`,
    true,
  );
  const lightNarrowRepositoryMenuRendered = await waitForRenderer<boolean>(
    window,
    `(() => {
      const menu = document.querySelector('.repository-context-menu');
      const bounds = menu?.getBoundingClientRect();
      return Boolean(bounds && bounds.left >= 0 && bounds.top >= 0 && bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight);
    })()`,
    "the light narrow repository context menu",
  );
  await window.webContents.executeJavaScript(
    `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
    true,
  );
  const lightNarrowRepositoryMenuImage = (
    await window.webContents.capturePage()
  ).toPNG();

  const report: HarnessSmokeReport = {
    activePlanProgressRendered,
    commandStateRendered,
    completedActivityExpanded,
    completionControlsDelayed: partial.completionControlsDelayed,
    completionControlsRendered: completed.completionControlsRendered,
    dockedEnvironmentPanelRendered,
    environmentPanelRendered,
    finalRendered: completed.text.includes(finalText),
    finalText,
    lightNarrowNewTaskBrandRendered,
    lightNarrowRepositoryMenuRendered,
    lightNarrowPlanProgressRendered,
    lightNarrowEnvironmentPanelRendered,
    newTaskBrandRendered,
    partialRendered:
      partial.active &&
      partial.text.includes(partialText) &&
      !partial.text.includes(finalText),
    partialText,
    prompt,
    queueEdited,
    queuedPrompt,
    queuedTurnCompleted: completed.text.includes(queuedFinalText),
    repositoryMenuRendered,
    scrolledAwayWorkingIndicatorRendered,
    turnCompleted: !completed.active && !completed.streamingTurn,
    writingPlanProgressRendered: partial.writingPlanProgressRendered,
    workingStateRendered: partial.workingStateRendered,
  };
  await Promise.all([
    mkdir(dirname(destination), { recursive: true }),
    mkdir(dirname(streamingDestination), { recursive: true }),
    mkdir(dirname(commandDestination), { recursive: true }),
    mkdir(dirname(newTaskBrandDestination), { recursive: true }),
    mkdir(dirname(lightNarrowNewTaskBrandDestination), { recursive: true }),
    mkdir(dirname(planProgressDestination), { recursive: true }),
    mkdir(dirname(lightNarrowPlanProgressDestination), { recursive: true }),
    mkdir(dirname(scrolledAwayDestination), { recursive: true }),
    mkdir(dirname(expandedActivityDestination), { recursive: true }),
    mkdir(dirname(queueDestination), { recursive: true }),
    mkdir(dirname(queueMenuDestination), { recursive: true }),
    mkdir(dirname(repositoryMenuDestination), { recursive: true }),
    mkdir(dirname(lightNarrowRepositoryMenuDestination), { recursive: true }),
    mkdir(dirname(lightNarrowTurnDestination), { recursive: true }),
    mkdir(dirname(reportDestination), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(destination, image.toPNG()),
    writeFile(streamingDestination, streamingImage),
    writeFile(commandDestination, commandImage),
    writeFile(newTaskBrandDestination, newTaskBrandImage),
    writeFile(lightNarrowNewTaskBrandDestination, lightNarrowNewTaskBrandImage),
    writeFile(planProgressDestination, planProgressImage),
    writeFile(lightNarrowPlanProgressDestination, lightNarrowPlanProgressImage),
    writeFile(scrolledAwayDestination, scrolledAwayImage),
    writeFile(expandedActivityDestination, expandedActivityImage),
    writeFile(queueDestination, queueImage),
    writeFile(queueMenuDestination, queueMenuImage),
    writeFile(repositoryMenuDestination, repositoryMenuImage),
    writeFile(
      lightNarrowRepositoryMenuDestination,
      lightNarrowRepositoryMenuImage,
    ),
    writeFile(lightNarrowTurnDestination, lightNarrowTurnImage),
    writeFile(reportDestination, JSON.stringify(report, null, 2)),
  ]);
}
