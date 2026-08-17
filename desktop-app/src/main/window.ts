import { basename, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  app,
  BrowserWindow,
  nativeTheme,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";

let smokeCaptureActive = false;

export function createPrimaryWindow(
  titlebarOptions: Pick<
    BrowserWindowConstructorOptions,
    "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition"
  >,
): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 600,
    title: "ChatGPT",
    ...titlebarOptions,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#181818" : "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      webviewTag: true,
    },
  });
  window.webContents.on(
    "will-attach-webview",
    (_event, preferences, params) => {
      const url = new URL(params.src || "about:blank");
      if (!["about:", "http:", "https:"].includes(url.protocol)) {
        throw new Error(`Unsupported browser URL protocol: ${url.protocol}`);
      }
      delete preferences.preload;
      preferences.contextIsolation = true;
      preferences.nodeIntegration = false;
      preferences.sandbox = true;
    },
  );
  window.webContents.on("did-attach-webview", (_event, guest) => {
    guest.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: "deny" };
    });
  });
  const developmentUrl = process.env.CODEX_DESKTOP_DEV_URL;
  if (developmentUrl) void window.loadURL(developmentUrl);
  else void window.loadFile(join(__dirname, "../renderer/index.html"));
  return window;
}

export async function captureSmoke(window: BrowserWindow): Promise<void> {
  const output = process.env.CODEX_DESKTOP_SMOKE_PATH;
  if (!output || smokeCaptureActive) return;
  smokeCaptureActive = true;
  await new Promise((resolve) => setTimeout(resolve, 700));
  const view = process.env.CODEX_DESKTOP_SMOKE_VIEW ?? "home";
  const smokeTheme = process.env.CODEX_DESKTOP_SMOKE_THEME;
  if (smokeTheme === "dark" || smokeTheme === "light") {
    const themeChanged = await window.webContents.executeJavaScript(`(() => {
      const theme = ${JSON.stringify(smokeTheme)};
      if (localStorage.getItem("appearance-theme") === theme) return false;
      localStorage.setItem("appearance-theme", theme);
      location.reload();
      return true;
    })()`);
    await new Promise((resolve) => setTimeout(resolve, themeChanged ? 700 : 0));
  }
  if (view === "migration") {
    const modalVisible = await window.webContents.executeJavaScript(
      'Boolean(document.querySelector(".migration-modal"))',
    );
    if (!modalVisible) {
      await window.webContents
        .executeJavaScript(
          'localStorage.setItem("chatgpt.product-mode", "codex"); localStorage.removeItem("chatgpt.migration-complete"); location.reload()',
        )
        .catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  if (view !== "migration") {
    await window.webContents.executeJavaScript(
      'document.querySelector(".migration-modal__start")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 160));
  }
  const preservesProjectFixture = [
    "codex-local-history",
    "codex-project-menu",
    "codex-project-selected",
    "codex-projects-populated",
    "codex-run-location",
  ].includes(view);
  if (!preservesProjectFixture) {
    const projectStateChanged = await window.webContents
      .executeJavaScript(`(() => {
      const hasProjects = localStorage.getItem("chatgpt.local-projects") !== null;
      const hasSelection = localStorage.getItem("chatgpt.selected-project") !== null;
      if (!hasProjects && !hasSelection) return false;
      localStorage.removeItem("chatgpt.local-projects");
      localStorage.removeItem("chatgpt.selected-project");
      location.reload();
      return true;
    })()`);
    await new Promise((resolve) =>
      setTimeout(resolve, projectStateChanged ? 700 : 0),
    );
  }
  const codexView =
    view.startsWith("codex") ||
    view === "mode-menu" ||
    view === "project-create" ||
    view === "project-marker" ||
    view.startsWith("thread") ||
    view === "settings" ||
    view.startsWith("settings-");
  if (view !== "migration") {
    const modeChanged = await window.webContents.executeJavaScript(`(() => {
      const desiredMode = ${codexView} ? "codex" : "work";
      if (localStorage.getItem("chatgpt.product-mode") === desiredMode) {
        return false;
      }
      localStorage.setItem("chatgpt.product-mode", desiredMode);
      location.reload();
      return true;
    })()`);
    await new Promise((resolve) =>
      setTimeout(resolve, modeChanged ? 700 : 180),
    );
  }
  if (view === "access-snake") {
    await window.webContents.executeJavaScript(
      `document.querySelector('button[aria-label="Play Snake"]')?.click()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
  } else if (view === "access-alt") {
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Sign in another way')
        ?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  if (
    view === "codex-project-selected" ||
    view === "codex-local-history" ||
    view === "codex-project-menu" ||
    view === "codex-projects-populated" ||
    view === "codex-run-location"
  ) {
    const smokeProjectRoot =
      process.env.CODEX_DESKTOP_SMOKE_PROJECT_ROOT ??
      "/Users/reference/Projects/sample";
    const smokeProjectName =
      process.env.CODEX_DESKTOP_SMOKE_PROJECT_NAME ??
      basename(smokeProjectRoot);
    const projectStateChanged = await window.webContents
      .executeJavaScript(`(() => {
      const projectId = "project-reference";
      const projects = {
        [projectId]: {
          createdAt: 1786847000000,
          id: projectId,
          name: ${JSON.stringify(smokeProjectName)},
          rootPaths: [${JSON.stringify(smokeProjectRoot)}],
          updatedAt: 1786848000000,
        },
      };
      const serialized = JSON.stringify(projects);
      if (
        localStorage.getItem("chatgpt.local-projects") === serialized &&
        localStorage.getItem("chatgpt.selected-project") === projectId
      ) {
        return false;
      }
      localStorage.setItem("chatgpt.local-projects", serialized);
      localStorage.setItem("chatgpt.selected-project", projectId);
      location.reload();
      return true;
    })()`);
    await new Promise((resolve) =>
      setTimeout(resolve, projectStateChanged ? 700 : 100),
    );
  }
  if (view === "codex-run-location") {
    await window.webContents.executeJavaScript(`
      document.querySelector('[data-composer-navigation-target="run-location"]')?.click();
    `);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (view.startsWith("thread")) {
    if (view === "thread-pin") {
      await window.webContents.executeJavaScript(`
        localStorage.removeItem("chatgpt.thread-pinned.smoke-thread");
        window.dispatchEvent(new CustomEvent("chatgpt:thread-pins-changed"));
      `);
    }
    if (view === "thread-usage") {
      await window.webContents.executeJavaScript(`localStorage.setItem(
        "chatgpt.thread-usage.smoke-thread",
        JSON.stringify({
          costUsd: 0.145,
          creditsUsed: 12.5,
          groups: [
            {
              creditsMicros: 8500000,
              model: "gpt-5.2-codex",
              reasoning_effort: "medium",
              speed: "standard",
            },
            {
              creditsMicros: 4000000,
              model: "gpt-5.1-codex",
              reasoning_effort: "high",
              speed: "fast",
            },
          ],
        }),
      )`);
    }
    await window.webContents.executeJavaScript(
      'document.querySelector("[data-thread-id]")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (view === "thread-main-chat-overflow-expanded") {
      await window.webContents.executeJavaScript(
        `document.querySelector('.user-message__bubble button[aria-label="Show more"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-main-chat-table-expanded") {
      await window.webContents.executeJavaScript(
        `document.querySelector('button[aria-label="Expand table"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-permissions") {
      await window.webContents.executeJavaScript(
        `document.querySelector('.composer--thread-dock .codex-composer-control')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-compressed") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('button')]
          .find((button) => button.getAttribute('aria-label') === 'Hide sidebar')
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-streaming" || view === "thread-compressed") {
      const prompt =
        view === "thread-compressed"
          ? "but what happens after sending a few messages? how does streaming happen after sending a new message? the new chat button on project is also missing. Load in the local sqlitedb and show the chats on the interface to show completeness"
          : "What happens when I send another message?";
      await window.webContents.executeJavaScript(`(() => {
        const textarea = document.querySelector('.thread-composer-region textarea');
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        setter?.call(textarea, ${JSON.stringify(prompt)});
        textarea?.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 60));
      await window.webContents.executeJavaScript(
        `document.querySelector('.thread-composer-region button[aria-label="Send"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 420));
    }
    const actionLabel =
      view.startsWith("thread-menu") ||
      view === "thread-rename" ||
      view === "thread-pin"
        ? "Chat actions"
        : view === "thread-summary"
          ? "Toggle summary"
          : view === "thread-compressed"
            ? "Toggle summary"
            : view === "thread-usage"
              ? "View chat usage"
              : view.startsWith("thread-side-")
                ? "Toggle side panel"
                : view === "thread-bottom-panel"
                  ? "Toggle bottom panel"
                  : null;
    if (actionLabel) {
      await window.webContents.executeJavaScript(`(() => {
        const label = ${JSON.stringify(actionLabel)};
        [...document.querySelectorAll('button')]
          .filter((button) => button.getBoundingClientRect().width > 0)
          .find((button) => button.getAttribute('aria-label') === label)
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (view === "thread-context-picker-menu") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('button')]
          .find((button) => button.textContent?.trim() === 'Browse all')
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (view === "thread-mcp-url-opened") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.mcp-url-card button')]
          .find((button) => button.textContent?.trim() === 'Open link⏎')
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const threadMenuAction =
      view === "thread-menu-copy"
        ? "Copy"
        : view === "thread-menu-continue"
          ? "Continue in…"
          : view === "thread-rename"
            ? "Rename chat"
            : view === "thread-pin"
              ? "Pin chat"
              : null;
    if (threadMenuAction) {
      await window.webContents.executeJavaScript(`(() => {
        const label = ${JSON.stringify(threadMenuAction)};
        const item = [...document.querySelectorAll('.thread-action-menu__item')]
          .find((item) => item.textContent?.trim().startsWith(label));
        item?.focus();
        if (label !== 'Copy' && label !== 'Continue in…') item?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const sideChoice =
      view === "thread-side-browser"
        ? "Browser"
        : view === "thread-side-files"
          ? "Files"
          : view === "thread-side-terminal"
            ? "Terminal"
            : view.startsWith("thread-side-chat")
              ? "Side chat"
              : null;
    if (sideChoice) {
      await window.webContents.executeJavaScript(`(() => {
        const label = ${JSON.stringify(sideChoice)};
        [...document.querySelectorAll('.side-panel-chooser button')]
          .find((button) => button.textContent?.trim().startsWith(label))
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (
      view === "thread-side-chat-plus" ||
      view === "thread-side-chat-browser"
    ) {
      await window.webContents.executeJavaScript(
        `document.querySelector('.side-panel__new-tab > button')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-side-chat-browser") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.side-panel-tab-menu [role="menuitem"]')]
          .find((item) => item.textContent?.trim().startsWith('Browser'))
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (view === "thread-side-chat-approval") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.side-chat-panel .codex-composer-control')]
          .find((button) => button.textContent?.includes('Ask for approval'))
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-side-chat-model") {
      await window.webContents.executeJavaScript(
        `document.querySelector('.side-chat-panel .codex-composer-model-trigger')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-side-chat-context") {
      await window.webContents.executeJavaScript(
        `document.querySelector('.side-chat-panel button[aria-label="Turn off IDE context"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (view === "thread-side-chat-close") {
      await window.webContents.executeJavaScript(`(() => {
        const textarea = document.querySelector('.side-chat-panel textarea');
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        setter?.call(textarea, 'Temporary side chat message');
        textarea?.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await window.webContents.executeJavaScript(
        `document.querySelector('.side-chat-panel button[aria-label="Send"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 80));
      await window.webContents.executeJavaScript(
        `document.querySelector('.side-panel__tab-item > button[aria-label^="Close "]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  } else if (view === "mode-menu") {
    await window.webContents.executeJavaScript(
      'document.querySelector(".sidebar-mode")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
  } else if (view === "codex-subagents-try") {
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Try now')
        ?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 180));
  } else if (view === "codex-project-options") {
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.getAttribute('aria-label') === 'Project sidebar options')
        ?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 180));
  } else if (
    view === "work-surface" ||
    view === "work-project-picker" ||
    view === "work-plugins" ||
    view === "work-run" ||
    view === "work-agent-permissions" ||
    view === "work-agent-model" ||
    view === "work-agent-model-model" ||
    view === "work-agent-model-effort"
  ) {
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('.titlebar__work-modes button')]
        .find((button) => button.textContent?.trim() === 'Work')
        ?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const controlLabel =
      view === "work-project-picker"
        ? "Choose project"
        : view === "work-plugins"
          ? "Connect plugins"
          : view === "work-run"
            ? "Choose where to run this chat"
            : view === "work-agent-permissions"
              ? "Ask for approval"
              : view.startsWith("work-agent-model")
                ? "5.2 CodexMedium"
                : null;
    if (controlLabel) {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('button')]
          .find((button) =>
            button.getAttribute('aria-label') === ${JSON.stringify(controlLabel)} ||
            button.textContent?.replace(/\\s+/g, '').trim() === ${JSON.stringify(controlLabel.replaceAll(" ", ""))}
          )
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (
        view === "work-agent-model-model" ||
        view === "work-agent-model-effort"
      ) {
        const submenuLabel =
          view === "work-agent-model-model" ? "Model" : "Effort";
        await window.webContents.executeJavaScript(`(() => {
          [...document.querySelectorAll('.composer--work-home .codex-model-menu > button')]
            .find((button) => button.getAttribute('aria-label')?.startsWith(${JSON.stringify(submenuLabel)}))
            ?.click();
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    }
  } else if (view === "temporary-chat") {
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('button')]
        .find((button) => button.getAttribute('aria-label') === 'Turn on temporary chat')
        ?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 180));
  } else if (view === "chat-model-menu" || view === "chat-model-effort") {
    await window.webContents.executeJavaScript(
      'document.querySelector(".home-composer-model")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (view === "chat-model-effort") {
      await window.webContents.executeJavaScript(
        'document.querySelector(".home-model-menu > button")?.click()',
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  } else if (view === "add-menu" || view === "add-project-menu") {
    await window.webContents.executeJavaScript(
      'document.querySelector(".home-composer-add")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (view === "add-project-menu") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.home-add-menu button')]
          .find((button) => button.textContent?.replace(/\\s+/g, ' ').trim().startsWith('Work in a project'))
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  } else if (view === "codex-add-menu") {
    await window.webContents.executeJavaScript(
      'document.querySelector(".codex-composer-icon-button")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
  } else if (view === "codex-project-picker" || view === "codex-project-menu") {
    await window.webContents.executeJavaScript(
      'document.querySelector(".codex-project-trigger")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
  } else if (view === "project-create" || view === "project-marker") {
    await window.webContents.executeJavaScript(
      `document.querySelector('button[aria-label="Add new project"]')?.click()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (view === "project-marker") {
      await window.webContents.executeJavaScript(
        `document.querySelector('button[aria-label^="Change marker for"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  } else if (view === "codex-projects" || view === "codex-projects-populated") {
    await window.webContents.executeJavaScript(`(() => {
      history.pushState({}, '', '/projects');
      window.dispatchEvent(new PopStateEvent('popstate'));
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  } else if (
    view === "codex-pull-requests" ||
    view === "codex-scheduled" ||
    view.startsWith("scheduled-") ||
    view === "codex-plugins" ||
    view.startsWith("plugins-")
  ) {
    const label =
      view === "codex-pull-requests"
        ? "Pull requests"
        : view === "codex-scheduled" || view.startsWith("scheduled-")
          ? "Scheduled"
          : "Plugins";
    await window.webContents.executeJavaScript(`(() => {
      const label = ${JSON.stringify(label)};
      [...document.querySelectorAll('.sidebar-primary-nav button')]
        .find((button) => button.textContent?.trim() === label)
        ?.click();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (view === "scheduled-split" || view === "scheduled-manual") {
      await window.webContents.executeJavaScript(
        `document.querySelector('button[aria-label="Create scheduled task options"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (view === "scheduled-manual") {
        await window.webContents.executeJavaScript(`(() => {
          [...document.querySelectorAll('.scheduled-create-menu [role=menuitem]')]
            .find((button) => button.textContent?.trim() === 'Set up manually')
            ?.click();
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    } else if (view === "scheduled-create") {
      await window.webContents.executeJavaScript(
        `document.querySelector('.scheduled-titlebar-actions button[aria-label="Create"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
    } else if (view === "scheduled-suggestion") {
      await window.webContents.executeJavaScript(
        `document.querySelector('button[aria-label="Daily brief"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    } else if (view === "plugins-skills") {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.route-titlebar-tabs button')]
          .find((button) => button.textContent?.trim() === 'Skills')
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 180));
    } else if (
      view === "plugins-add" ||
      view === "plugins-marketplace" ||
      view === "plugins-create"
    ) {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.route-titlebar-actions button')]
          .find((button) => button.textContent?.trim() === 'Add')
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (view !== "plugins-add") {
        await window.webContents.executeJavaScript(`(() => {
          const action = ${JSON.stringify(view === "plugins-create" ? "Create plugin" : "Add a marketplace")};
          [...document.querySelectorAll('.plugins-add-popup [role=menuitem]')]
            .find((button) => button.textContent?.trim() === action)
            ?.click();
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    } else if (view === "plugins-manage" || view === "plugins-manage-add") {
      await window.webContents.executeJavaScript(
        `document.querySelector('button[aria-label="Manage"]')?.click()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (view === "plugins-manage-add") {
        await window.webContents.executeJavaScript(`(() => {
          [...document.querySelectorAll('button')]
            .find((button) => button.textContent?.trim() === 'Add server')
            ?.click();
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    }
  } else if (
    view === "profile-menu" ||
    view === "settings" ||
    view.startsWith("settings-")
  ) {
    await window.webContents.executeJavaScript(
      'document.querySelector(".sidebar-settings")?.click()',
    );
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (view === "settings" || view.startsWith("settings-")) {
      await window.webContents.executeJavaScript(`(() => {
        [...document.querySelectorAll('.profile-menu [role="menuitem"]')]
          .find((item) => item.textContent?.trim().startsWith('Settings'))
          ?.click();
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (view.startsWith("settings-")) {
        if (view === "settings-open-source-licenses") {
          await window.webContents.executeJavaScript(`(() => {
            [...document.querySelectorAll('.settings-sidebar nav button')]
              .find((button) => button.textContent?.trim() === 'General')
              ?.click();
          })()`);
          await new Promise((resolve) => setTimeout(resolve, 180));
          await window.webContents.executeJavaScript(`(() => {
            [...document.querySelectorAll('.settings-card__row')]
              .find((row) => row.textContent?.includes('Open source licenses'))
              ?.querySelector('button')
              ?.click();
          })()`);
          await new Promise((resolve) => setTimeout(resolve, 250));
        } else {
          const routeView = view.startsWith("settings-configuration-")
            ? "settings-configuration"
            : view.startsWith("settings-general-")
              ? "settings-general"
              : view === "settings-appearance-code-theme"
                ? "settings-appearance"
                : view === "settings-personalization-personality"
                  ? "settings-personalization"
                  : view.startsWith("settings-browser-")
                    ? "settings-browser"
                    : view === "settings-plugins-add"
                      ? "settings-plugins"
                      : view;
          const label = routeView
            .slice("settings-".length)
            .split("-")
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(" ")
            .replace("Keyboard Shortcuts", "Keyboard shortcuts")
            .replace("Usage Billing", "Usage & billing")
            .replace("Computer Use", "Computer use")
            .replace("Archived Chats", "Archived chats");
          await window.webContents.executeJavaScript(`(() => {
          const label = ${JSON.stringify(label)};
          [...document.querySelectorAll('.settings-sidebar nav button')]
            .find((button) => button.textContent?.trim().startsWith(label))
            ?.click();
          })()`);
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (view.startsWith("settings-configuration-")) {
            const action = view
              .slice("settings-configuration-".length)
              .split("-")
              .map((part) => part[0]?.toUpperCase() + part.slice(1))
              .join(" ")
              .replace("User Config", "User config")
              .replace("On Request", "On request")
              .replace("Read Only", "Read only")
              .replace("Model Default", "Model default");
            await window.webContents.executeJavaScript(`(() => {
              const action = ${JSON.stringify(action)};
              [...document.querySelectorAll('.configuration-choice > button')]
                .find((button) => button.textContent?.trim() === action)
                ?.click();
            })()`);
            await new Promise((resolve) => setTimeout(resolve, 180));
          } else if (view.startsWith("settings-general-")) {
            const title =
              view === "settings-general-language-menu"
                ? "Language"
                : view === "settings-general-send-shortcut-menu"
                  ? "Send shortcut"
                  : "Turn completion notifications";
            await window.webContents.executeJavaScript(`(() => {
              const title = ${JSON.stringify(title)};
              const row = [...document.querySelectorAll('.settings-card__row')]
                .find((candidate) => candidate.querySelector('strong')?.textContent?.trim() === title);
              const trigger = row?.querySelector('.settings-dropdown > button');
              const scrollTop =
                title === 'Language'
                  ? 73
                  : title === 'Send shortcut'
                    ? 629
                    : 639.5;
              const main = document.querySelector('.settings-main');
              if (main) main.scrollTop = scrollTop;
              trigger?.click();
            })()`);
            await new Promise((resolve) => setTimeout(resolve, 180));
          } else if (view === "settings-appearance-code-theme") {
            await window.webContents.executeJavaScript(
              `document.querySelector('button[aria-label="Light code theme"]')?.click()`,
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
          } else if (view === "settings-personalization-personality") {
            await window.webContents.executeJavaScript(
              `document.querySelector('button[aria-label="Personality"]')?.click()`,
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
          } else if (view.startsWith("settings-browser-")) {
            const browserAction = view.slice("settings-browser-".length);
            await window.webContents.executeJavaScript(`(() => {
              const action = ${JSON.stringify(browserAction)};
              if (action === 'import') {
                [...document.querySelectorAll('.browser-settings button')]
                  .find((button) => button.textContent?.trim() === 'Import…')
                  ?.click();
                return;
              }
              const titles = {
                'browsing-data': 'Browsing data',
                'contact-info': 'Contact info',
                'download-history': 'Download history',
                'password-manager': 'Password manager',
                'site-settings': 'Site settings',
              };
              const title = titles[action];
              [...document.querySelectorAll('.browser-settings .settings-route-row')]
                .find((row) => row.querySelector('strong')?.textContent?.trim() === title)
                ?.querySelector('button')
                ?.click();
            })()`);
            await new Promise((resolve) => setTimeout(resolve, 250));
          } else if (view === "settings-plugins-add") {
            await window.webContents.executeJavaScript(`(() => {
              [...document.querySelectorAll('.plugins-settings button')]
                .find((button) => button.textContent?.trim() === 'Add')
                ?.click();
            })()`);
            await new Promise((resolve) => setTimeout(resolve, 180));
          }
        }
      }
    }
  }
  const smokeWidth = Number(process.env.CODEX_DESKTOP_SMOKE_WIDTH);
  const smokeHeight = Number(process.env.CODEX_DESKTOP_SMOKE_HEIGHT);
  if (Number.isFinite(smokeWidth) && Number.isFinite(smokeHeight)) {
    window.setContentSize(smokeWidth, smokeHeight);
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  if (view === "thread-main-chat-table-hover") {
    window.show();
    window.focus();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const tablePoint = await window.webContents.executeJavaScript(`(() => {
      const rect = document
        .querySelector('.markdown-table-container')
        ?.getBoundingClientRect();
      const scale = window.devicePixelRatio;
      return rect
        ? {
            x: Math.round((rect.right - 18) * scale),
            y: Math.round((rect.top + 16) * scale),
          }
        : { x: 1, y: 1 };
    })()`);
    window.webContents.sendInputEvent({ type: "mouseMove", ...tablePoint });
    await window.webContents.executeJavaScript(
      `document.querySelector('.markdown-table-container')?.focus({ preventScroll: true })`,
    );
  } else {
    window.webContents.sendInputEvent({ type: "mouseMove", x: 1, y: 1 });
  }
  await new Promise((resolve) => setTimeout(resolve, 40));
  if (process.env.CODEX_DESKTOP_SMOKE_METRICS === "1") {
    const metrics = await window.webContents.executeJavaScript(`(() => {
      const describeElement = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          background: style.backgroundColor,
          border: style.border,
          color: style.color,
          display: style.display,
          font: style.font,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          opacity: style.opacity,
          gap: style.gap,
          justifyContent: style.justifyContent,
          padding: style.padding,
        };
      };
      const describe = (selector) => describeElement(document.querySelector(selector));
      return {
        accessPage: describe('.access-page'),
        accessContent: describe('.access-page__content'),
        accessLogo: describe('.access-page__logo'),
        accessHeading: describe('.access-page h1'),
        accessContinue: describe('.access-page__continue'),
        accessAlternate: describe('.access-page__alternate'),
        accessSignup: describe('.access-page__signup'),
        accessApiForm: describe('.access-page__api-form'),
        accessApiInput: describe('.access-page__api-form input'),
        accessApiActions: describe('.access-page__api-actions'),
        accessSnake: describe('.access-snake'),
        accessSnakeCanvas: describe('.access-snake canvas'),
        aside: describe('.sidebar'),
        sidebarToolbar: describe('.sidebar-toolbar'),
        sidebarModeRow: describe('.sidebar-mode-row'),
        sidebarMode: describe('.sidebar-mode'),
        sidebarSearchButton: describe('.sidebar-mode-row > .icon-button'),
        sidebarNewChat: describe('.sidebar-new-chat'),
        sidebarNewChatItems: [...document.querySelectorAll('.sidebar-new-chat, .sidebar-new-chat *')].map(describeElement),
        sidebarPrimaryNav: describe('.sidebar-primary-nav'),
        sidebarPrimaryRows: [...document.querySelectorAll('.sidebar-primary-nav > button')].map(describeElement),
        sidebarProjects: describe('.sidebar-section--projects'),
        sidebarProjectsHeader: describe('.sidebar-section--projects > header'),
        sidebarNoProjects: describe('.sidebar-section--projects > p'),
        sidebarRecents: describe('.sidebar-section--recents'),
        sidebarRecentsHeader: describe('.sidebar-section--recents > header'),
        sidebarThreads: describe('.sidebar-section--recents > .sidebar-threads'),
        sidebarThreadRows: [...document.querySelectorAll('.sidebar-section--recents .thread-row')].map(describeElement),
        sidebarBottom: describe('.sidebar-bottom'),
        modeMenu: describe('.mode-menu'),
        modeMenuItems: [...document.querySelectorAll('.mode-menu, .mode-menu *')].map(describeElement),
        banner: describe('.codex-home__banner'),
        bannerItems: [...document.querySelectorAll('.codex-home__banner, .codex-home__banner *')].map(describeElement),
        hero: describe('.codex-home__hero'),
        codexHeroHeading: describe('.codex-home__hero h1'),
        codexHeroProject: describe('.codex-home__hero h1 button'),
        project: describe('.codex-project-strip'),
        projectMenu: describe('.codex-project-menu'),
        projectMenuSearch: describe('.codex-project-menu__search'),
        projectMenuItems: [...document.querySelectorAll('.codex-project-menu > button, .codex-project-menu__projects > button')].map(describeElement),
        projectsPage: describe('.projects-index-page'),
        projectsHeader: describe('.projects-index-page__header'),
        projectsEmpty: describe('.projects-index-page__empty'),
        projectsNew: describe('.projects-index-page__new'),
        projectsSearch: describe('.projects-index-page__search'),
        projectsColumns: describe('.projects-index-page__columns'),
        projectsRow: describe('.projects-index-page__row'),
        projectCreateDialog: describe('.project-create-dialog'),
        projectCreateName: describe('.project-create-dialog__name'),
        projectCreateSource: describe('.project-create-dialog__source'),
        projectCreateFolderPicker: describe(
          '.project-create-dialog__folder-picker',
        ),
        projectCreateFolderPrompt: describe(
          '.project-create-dialog__folder-picker span',
        ),
        projectCreateFooter: describe('.project-create-dialog__footer'),
        pluginsMarketplaceDialog: describe('.plugins-marketplace-dialog'),
        pluginsMarketplaceHeading: describe(
          '.plugins-marketplace-dialog h2',
        ),
        pluginsMarketplaceDescription: describe(
          '.plugins-marketplace-dialog > p',
        ),
        pluginsMarketplaceFields: [
          ...document.querySelectorAll(
            '.plugins-marketplace-dialog input, .plugins-marketplace-dialog textarea',
          ),
        ].map(describeElement),
        pluginsMarketplaceActions: describe(
          '.plugins-marketplace-dialog__actions',
        ),
        pluginsMarketplaceButtons: [
          ...document.querySelectorAll(
            '.plugins-marketplace-dialog__close, .plugins-marketplace-dialog__actions button',
          ),
        ].map(describeElement),
        projectMarker: describe('.project-marker-popover'),
        composer: describe('.composer--codex-home'),
        workModes: describe('.titlebar__work-modes'),
        workModeChildren: [
          ...document.querySelectorAll('.titlebar__work-modes > *'),
        ].map(describeElement),
        workHeading: describe('.new-task-page h1'),
        workComposer: describe('.composer--home'),
        workEditor: describe('.composer--home textarea'),
        workModel: describe('.home-composer-model'),
        workSend: describe('.composer--home .composer-submit'),
        pluginPrefill: describe('.home-composer-plugin-prefill'),
        workAgentComposer: describe('.composer--work-home'),
        workAgentControls: [
          ...document.querySelectorAll(
            '.composer--work-home .codex-composer-icon-button, .composer--work-home .codex-composer-icon-button svg, .composer--work-home .codex-composer-control, .composer--work-home .codex-composer-control svg, .composer--work-home .codex-composer-control span, .composer--work-home .codex-composer-model-trigger, .composer--work-home .codex-composer-model-trigger span, .composer--work-home .composer-submit, .composer--work-home .composer-submit svg',
          ),
        ].map(describeElement),
        workAgentPermissions: describe(
          '.composer--work-home .codex-permissions-menu',
        ),
        workAgentPermissionItems: [
          ...document.querySelectorAll(
            '.composer--work-home .codex-permissions-menu, .composer--work-home .codex-permissions-menu *',
          ),
        ].map(describeElement),
        workAgentModelMenu: describe(
          '.composer--work-home .codex-model-menu',
        ),
        workAgentModelItems: [
          ...document.querySelectorAll(
            '.composer--work-home .codex-model-menu, .composer--work-home .codex-model-menu *',
          ),
        ].map(describeElement),
        workAgentModelSubmenus: [
          ...document.querySelectorAll(
            '.composer--work-home .codex-model-submenu, .composer--work-home .codex-model-submenu *',
          ),
        ].map(describeElement),
        workContextStrip: describe('.work-home-context-strip'),
        workProjectTrigger: describe('.work-project-trigger'),
        workPluginTrigger: describe('.work-home-context-button'),
        workRunTrigger: describe('.work-home-run-trigger'),
        workProjectMenu: describe('.work-project-selector .codex-project-menu'),
        workPluginsMenu: describe('.work-control-menu--plugins'),
        workRunMenu: describe('.work-control-menu--run'),
        workPopupItems: [...document.querySelectorAll('.work-project-selector .codex-project-menu, .work-project-selector .codex-project-menu *, .work-control-menu, .work-control-menu *')].map(describeElement),
        temporaryChatDialog: describe('.temporary-chat-dialog'),
        temporaryChatFeatures: [...document.querySelectorAll('.temporary-chat-dialog__feature, .temporary-chat-dialog__feature > div, .temporary-chat-dialog__feature strong, .temporary-chat-dialog__feature p, .temporary-chat-dialog__continue')].map(describeElement),
        workAdd: describe('.home-composer-add'),
        workAddMenu: describe('.home-add-menu'),
        workAddMenuItems: [...document.querySelectorAll('.home-add-menu, .home-add-menu *')].map(describeElement),
        workProjectSubmenu: describe('.home-project-menu'),
        workProjectSubmenuItems: [...document.querySelectorAll('.home-project-menu, .home-project-menu *')].map(describeElement),
        chatModelMenu: describe('.home-model-menu'),
        chatModelMenuItems: [...document.querySelectorAll('.home-model-menu, .home-model-menu *')].map(describeElement),
        chatModelSubmenu: describe('.home-model-submenu'),
        chatModelSubmenuItems: [...document.querySelectorAll('.home-model-submenu, .home-model-submenu *')].map(describeElement),
        settings: describe('.sidebar-settings'),
        profileMenu: describe('.profile-menu'),
        profileMenuItems: [...document.querySelectorAll('.profile-menu [role="menuitem"]')].map(describeElement),
        sidebarOptionsMenu: describe('.sidebar-options-menu'),
        sidebarOptionsMenuItems: [...document.querySelectorAll('.sidebar-options-menu > *')].map(describeElement),
        routePage: describe('.codex-route-page'),
        routeHeading: describe('.codex-route-page h1'),
        routeSearch: describe('.route-search'),
        routeStatus: describe('.scheduled-error, .plugins-loading, .pull-request-skeletons'),
        planCard: describe('.plan-card'),
        planCardHeader: describe('.plan-card > header'),
        planCardContent: describe('.plan-card__content'),
        planCardHeading: describe('.plan-card__content h1'),
        planCardItems: [...document.querySelectorAll('.plan-card__content li')].map(describeElement),
        scheduledCreateMenu: describe('.scheduled-create-menu'),
        scheduledList: describe('.scheduled-page__list'),
        scheduledDetail: describe('.scheduled-detail-panel'),
        scheduledDetailTitle: describe('.scheduled-detail-panel__title'),
        scheduledDetailPrompt: describe('.scheduled-detail-panel__prompt'),
        scheduledFieldGroups: [...document.querySelectorAll('.scheduled-field-group, .scheduled-field-group > div, .scheduled-field-row')].map(describeElement),
        scheduledButtons: [...document.querySelectorAll('.scheduled-error button, .scheduled-suggestion > button, .scheduled-field-row > button')].map(describeElement),
        scheduledFatalError: describe('.scheduled-fatal-error'),
        settingsWindow: describe('.settings-window'),
        settingsInput: describe('.settings-search input'),
        settingsFirstNav: describe('.settings-sidebar nav button'),
        settingsContent: describe('.settings-content'),
        settingsHeading: describe('.settings-content h1'),
        settingsSection: describe('.settings-panel-section'),
        settingsPanelSections: [
          ...document.querySelectorAll('.settings-panel-section'),
        ].map((element) => ({
          text: element.textContent?.trim().replace(/\\s+/g, ' ').slice(0, 80),
          ...describeElement(element),
        })),
        settingsCard: describe('.settings-panel-section .settings-card'),
        settingsRow: describe('.settings-panel-section .settings-card__row'),
        settingsRouteHeader: describe('.settings-route-header'),
        settingsRouteSection: describe('.settings-route-section'),
        settingsRouteCard: describe('.settings-route-card'),
        settingsRouteRow: describe('.settings-route-row'),
        settingsRouteRows: [...document.querySelectorAll('.settings-route-row')].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        }),
        settingsCopies: [
          ...document.querySelectorAll(
            '.settings-card__copy, .settings-card__copy > *',
          ),
        ].map(describeElement),
        settingsFullAccessLines: (() => {
          const element = document.querySelector(
            '.settings-panel-section--permissions .settings-card__row:last-child .settings-card__copy > span',
          );
          if (!element) return [];
          const lines = new Map();
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
          );
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            for (let index = 0; index < node.textContent.length; index += 1) {
              const range = document.createRange();
              range.setStart(node, index);
              range.setEnd(node, index + 1);
              const rect = range.getBoundingClientRect();
              if (rect.width === 0 && /\s/.test(node.textContent[index])) {
                continue;
              }
              const key = rect.top.toFixed(3);
              lines.set(
                key,
                (lines.get(key) ?? "") + node.textContent[index],
              );
            }
          }
          return [...lines.entries()];
        })(),
        settingsControls: [...document.querySelectorAll('.settings-content button, .settings-content input, .settings-content textarea')].map((element) => ({
          text: element.textContent?.trim(),
          aria: element.getAttribute('aria-label'),
          ...describeElement(element),
        })),
        settingsPopupRoles: [
          ...document.querySelectorAll(
            '[role="menu"], [role="listbox"]',
          ),
        ].map(describeElement),
        settingsPopupItems: [
          ...document.querySelectorAll(
            '[role="menuitem"], [role="menuitemradio"], [role="option"]',
          ),
        ].map((element) => ({
          text: element.textContent?.trim().replace(/\\s+/g, ' '),
          role: element.getAttribute('role'),
          ...describeElement(element),
        })),
        configurationMenu: describe('.configuration-choice__menu'),
        configurationMenuItems: [...document.querySelectorAll('.configuration-choice__menu [role="menuitem"]')].map(describeElement),
        browserImportBackdrop: describe('.browser-import-backdrop'),
        browserImportDialog: describe('.browser-import-dialog'),
        browserImportDialogNodes: [...document.querySelectorAll('.browser-import-dialog h2, .browser-import-dialog > p, .browser-import-dialog > label, .browser-import-dialog > label > span, .browser-import-dialog > label > button, .browser-import-dialog footer, .browser-import-dialog footer button, .browser-import-dialog__close')].map((element) => ({
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        settingsError: describe('.settings-error'),
        settingsErrorControls: [...document.querySelectorAll('.settings-error button')].map((element) => ({
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        settingsRouteTextarea: describe('.settings-route-textarea'),
        settingsMainBack: describe('.settings-main__back'),
        settingsOpenSourceHeader: describe('.settings-open-source-licenses > header'),
        settingsOpenSourceSection: describe('.settings-open-source-licenses > section'),
        mcpPage: describe('.mcp-server-page'),
        mcpToolbar: describe('.mcp-server-page > .plugins-manage-page__toolbar'),
        mcpBack: describe('.mcp-server-page__back'),
        mcpHeading: describe('.mcp-server-page > h1'),
        mcpDocs: describe('.mcp-server-page__docs'),
        mcpCards: [...document.querySelectorAll('.mcp-form-card')].map(describeElement),
        mcpInputs: [...document.querySelectorAll('.mcp-server-page input')].map(describeElement),
        mcpButtons: [...document.querySelectorAll('.mcp-form-type button, .mcp-form-list__add, .mcp-server-page__actions button')].map(describeElement),
        migrationDialog: describe('.migration-modal'),
        migrationMedia: describe('.migration-modal__art'),
        migrationBody: describe('.migration-modal__body'),
        migrationTitle: describe('.migration-modal__body h2'),
        migrationRule: describe('.migration-modal__rule'),
        migrationFeature: describe('.migration-modal__feature'),
        migrationStart: describe('.migration-modal__start'),
        migrationCheckbox: describe('.migration-modal__checkbox'),
        themePreview: describe('.theme-preview__window'),
        themeDiff: describe('.theme-diff'),
        themeDiffRemoved: describe('.theme-diff .is-removed'),
        themeDiffRemovedGutter: describe('.theme-diff .is-removed > span'),
        themeDiffAdded: describe('.theme-diff .is-added'),
        themeDiffAddedGutter: describe('.theme-diff .is-added > span'),
        themeEditor: describe('.theme-editor'),
        themePreference: describe('.appearance-preferences'),
        threadTitle: describe('.titlebar__thread-title'),
        threadUsageTrigger: describe('.thread-usage__trigger'),
        threadTimeline: describe('.thread-timeline'),
        threadUserGroup: describe('.user-message-group'),
        threadUserBubble: describe('.user-message__bubble'),
        threadCommand: describe('.tool-item summary'),
        threadActivities: [...document.querySelectorAll('.activity-group__trigger')].map(describeElement),
        threadAgent: describe('.agent-message'),
        threadAgentActions: describe('.agent-message-actions'),
        threadMarkdownTable: describe('.markdown-table'),
        threadMarkdownTableContainer: describe('.markdown-table-container'),
        threadMarkdownTableScroller: describe('.markdown-table-scroller'),
        threadMarkdownTableActions: describe('.markdown-table-actions'),
        threadMarkdownTableActionButtons: [...document.querySelectorAll('.markdown-table-actions button')].map((element) => ({
          aria: element.getAttribute('aria-label'),
          ...describeElement(element),
        })),
        threadMarkdownTableHeaders: [...document.querySelectorAll('.markdown-table-header-cell')].map((element) => ({
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        threadMarkdownTableFirstRow: [...document.querySelectorAll('.markdown-table-body .markdown-table-row:first-child .markdown-table-cell')].map((element) => ({
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        threadMarkdownTablePreview: describe('.markdown-table-preview'),
        threadMarkdownTablePreviewSurface: describe('.markdown-table-preview__surface'),
        threadDiffCard: describe('.diff-summary-card'),
        threadDiffHeader: describe('.diff-summary-card > header'),
        threadDiffRows: [...document.querySelectorAll('.diff-summary-card__files > div')].map(describeElement),
        threadPlanCard: describe('.plan-card'),
        threadPlanHeader: describe('.plan-card > header'),
        threadPlanContent: describe('.plan-card__content'),
        threadComposer: describe('.composer--thread-dock'),
        threadModel: describe('.composer--thread-dock .codex-composer-model-trigger'),
        threadContext: describe('.composer--thread-dock .thread-composer-context'),
        threadContextDivider: describe('.composer--thread-dock .thread-composer-context-divider'),
        threadPermissions: describe('.composer--thread-dock .codex-permissions-menu'),
        threadPermissionParts: [...document.querySelectorAll('.composer--thread-dock .codex-permissions-menu, .composer--thread-dock .codex-permissions-menu *')].map((element) => ({
          aria: element.getAttribute('aria-label'),
          checked: element.getAttribute('aria-checked'),
          role: element.getAttribute('role'),
          text: element.textContent?.trim().replace(/\s+/g, ' '),
          ...describeElement(element),
        })),
        threadApproval: describe('[data-codex-approval-surface]'),
        threadApprovalParts: [
          '.approval-request-card__header',
          '.approval-request-card__identity',
          '.approval-request-card__title',
          '.approval-request-card__title h2',
          '.approval-request-card__title p',
          '.permission-path',
          '.approval-request-card__actions',
          '.approval-request-card__action-group',
          '.approval-request-button--deny',
          '.approval-request-button--approve',
          '.approval-request-button--options',
        ].map((selector) => ({ selector, ...describe(selector) })),
        threadQuestion: describe('.user-input-card'),
        threadQuestionStatus: describe('.thread-request-status'),
        threadQuestionParts: [
          '.user-input-card__header',
          '.user-input-card__header h2',
          '.user-input-card__navigation',
          '.user-input-card__dismiss',
          '.user-input-card__body',
          '.user-input-card__options',
          '.user-input-card__options > button',
          '.user-input-card__options > button:nth-child(2)',
          '.user-input-card__other',
          '.user-input-card__other textarea',
          '.user-input-card__other > button',
        ].map((selector) => ({ selector, ...describe(selector) })),
        threadOptionPicker: describe('.option-picker-card'),
        threadOptionPickerParts: [
          '.option-picker-card__header',
          '.option-picker-card__header h2',
          '.option-picker-card__header button',
          '.option-picker-card__options',
          '.option-picker-card__options > button:nth-child(1)',
          '.option-picker-card__options > button:nth-child(2)',
          '.option-picker-card__options > button:nth-child(3)',
          '.option-picker-card__options > input',
          '.option-picker-card__actions',
          '.option-picker-card__skip',
          '.option-picker-card__submit',
        ].map((selector) => ({ selector, ...describe(selector) })),
        threadContextPicker: describe('.setup-context-card'),
        threadContextPickerParts: [
          '.setup-context-card__header',
          '.setup-context-card__header h2',
          '.setup-context-card__header button',
          '.setup-context-card__sources',
          '.setup-context-card__source:nth-child(1)',
          '.setup-context-card__source:nth-child(1) .setup-context-card__logo',
          '.setup-context-card__source:nth-child(1) .setup-context-card__source-copy',
          '.setup-context-card__source:nth-child(1) > button',
          '.setup-context-card__source:nth-child(2)',
          '.setup-context-card__source:nth-child(3)',
          '.setup-context-card__footer',
          '.setup-context-card__browse > button',
          '.setup-context-card__skip',
          '.setup-context-card__continue',
        ].map((selector) => ({ selector, ...describe(selector) })),
        threadContextMenu: describe('.setup-context-menu'),
        threadContextMenuInput: describe('.setup-context-menu input'),
        threadContextMenuItems: [...document.querySelectorAll('.setup-context-menu__items > button')].map(describeElement),
        threadMenu: describe('.thread-menu .menu'),
        threadMenuItems: [...document.querySelectorAll('.thread-action-menu__item')].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        }),
        threadSubmenus: [...document.querySelectorAll('.thread-action-submenu')].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        }),
        threadRename: describe('.thread-rename-dialog'),
        threadRenameInput: describe('.thread-rename-dialog input'),
        threadSummary: describe('.titlebar-summary'),
        threadUsageTrigger: describe('.thread-usage__trigger'),
        threadUsageMenu: describe('.thread-usage__menu'),
        threadUsageSummary: describe('.thread-usage__summary'),
        threadUsageBreakdown: describe('.thread-usage-breakdown'),
        threadUsageSettings: describe('.thread-usage__settings'),
        mcpFormCard: describe('.mcp-elicitation-form-card'),
        mcpSuggestionCard: describe('.mcp-suggestion-card'),
        mcpSuggestionBody: describe('.mcp-suggestion-card__body'),
        mcpSuggestionFooter: describe('.mcp-suggestion-card__footer'),
        mcpToolCard: describe('.mcp-tool-approval-card'),
        mcpToolDetails: describe('.mcp-tool-approval-card__details'),
        mcpToolActions: describe('.mcp-tool-approval-card__actions'),
        mcpFormHeader: describe('.mcp-form-card__header'),
        mcpFormFields: describe('.mcp-form-card__fields'),
        mcpFormControls: [...document.querySelectorAll('.mcp-elicitation-form-card input, .mcp-elicitation-form-card button, .mcp-elicitation-form-card legend, .mcp-form-card__description')].map(describeElement),
        mcpFormFooter: describe('.mcp-form-card__footer'),
        openAIFormCard: describe('.openai-form-card'),
        openAIFormHeader: describe('.openai-form-card__header'),
        openAIFormFields: describe('.openai-form-card__fields'),
        openAIFormFooter: describe('.openai-form-card__footer'),
        openAIFormUnsupported: describe('.openai-form-unsupported'),
        openAIFormParts: [...document.querySelectorAll('.openai-form-card input, .openai-form-card button, .openai-form-card label, .openai-form-card img, .openai-form-unsupported > div, .openai-form-unsupported button')].map(describeElement),
        mcpUrlCard: describe('.mcp-url-card'),
        mcpUrlBody: describe('.mcp-url-card__body'),
        mcpUrlFooter: describe('.mcp-url-card__footer'),
        mcpUrlButtons: [...document.querySelectorAll('.mcp-url-card button')].map(describeElement),
        sidePanel: describe('.side-panel'),
        sidePanelChooser: describe('.side-panel-chooser'),
        sidePanelChoices: [...document.querySelectorAll('.side-panel-chooser button')].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        }),
        sidePanelTab: describe('.side-panel__tab'),
        sidePanelTabs: [...document.querySelectorAll('.side-panel__tab')].map(describeElement),
        sidePanelTabTree: [...document.querySelectorAll('.side-panel__tab, .side-panel__tab *')].map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        sidePanelTabItems: [...document.querySelectorAll('.side-panel__tab-item')].map(describeElement),
        sidePanelNewTab: describe('.side-panel__new-tab > button'),
        sidePanelTabMenu: describe('.side-panel-tab-menu'),
        sideChatPanel: describe('.side-chat-panel'),
        sideChatConversation: describe('.side-chat-panel__conversation'),
        sideChatViewport: describe('.side-chat-panel__viewport'),
        sideChatEmpty: describe('.side-chat-panel__empty'),
        sideChatEmptyText: describe('.side-chat-panel__empty > div'),
        sideChatComposer: describe('.side-chat-panel .composer--thread-dock'),
        sideChatComposerButtons: [...document.querySelectorAll('.side-chat-panel .composer button')].map((element) => ({
          text: element.textContent?.trim(),
          aria: element.getAttribute('aria-label'),
          ...describeElement(element),
        })),
        sideChatComposerTree: [...document.querySelectorAll('.side-chat-panel .codex-composer-footer, .side-chat-panel .codex-composer-footer *')].map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim(),
          aria: element.getAttribute('aria-label'),
          ...describeElement(element),
        })),
        sideChatPermissions: describe('.side-chat-panel .codex-permissions-menu--detailed'),
        sideChatPermissionsItems: [...document.querySelectorAll('.side-chat-panel .codex-permissions-menu--detailed button')].map(describeElement),
        sideChatModelMenu: describe('.side-chat-panel .codex-model-menu--compact'),
        sideChatModelItems: [...document.querySelectorAll('.side-chat-panel .codex-model-menu--compact button')].map(describeElement),
        sideChatCloseDialog: describe('.side-chat-close-dialog'),
        sideChatCloseTree: [...document.querySelectorAll('.side-chat-close-dialog, .side-chat-close-dialog *')].map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim(),
          aria: element.getAttribute('aria-label'),
          ...describeElement(element),
        })),
        browserToolbar: describe('.browser-panel__toolbar'),
        browserButtons: [...document.querySelectorAll('.browser-panel button')].map((element) => ({
          text: element.textContent?.trim(),
          aria: element.getAttribute('aria-label'),
          ...describeElement(element),
        })),
        browserAddress: describe('.browser-panel__address'),
        browserEmpty: describe('.browser-panel__empty'),
        browserEmptyTree: [...document.querySelectorAll('.browser-panel__empty, .browser-panel__empty *')].map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        terminalPanel: describe('.terminal-panel'),
        terminalPanelTree: [...document.querySelectorAll('.terminal-panel, .terminal-panel *')].map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim(),
          ...describeElement(element),
        })),
        panelRenderError: describe('.panel-render-error'),
        bottomPanel: describe('.bottom-panel'),
        bottomPanelTab: describe('.bottom-panel__tab'),
      };
    })()`);
    console.log(`SMOKE_METRICS ${JSON.stringify(metrics)}`);
  }
  window.show();
  window.focus();
  window.webContents.invalidate();
  // capturePage() can otherwise return the previous compositor frame after a
  // smoke interaction (notably for ellipsized sidebar rows and panel tabs).
  await new Promise((resolve) =>
    setTimeout(resolve, view.includes("expanded") ? 1_000 : 500),
  );
  const image = await window.webContents.capturePage();
  await mkdir(join(output, ".."), { recursive: true });
  await writeFile(output, image.toPNG());
  console.log(`Captured ${basename(output)}`);
  app.quit();
}
