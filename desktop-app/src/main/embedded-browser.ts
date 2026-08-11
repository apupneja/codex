import { BrowserWindow, WebContentsView, session } from "electron";

import {
  isAllowedBrowserNavigation,
  resolveBrowserInput,
} from "../shared/browser-url";
import type {
  EmbeddedBrowserAction,
  EmbeddedBrowserBounds,
  EmbeddedBrowserState,
} from "../shared/types";

const BROWSER_PARTITION = "persist:codex-embedded-browser";
const DEFAULT_BROWSER_URL = "https://www.google.com/";

function validBounds(rawBounds: EmbeddedBrowserBounds): EmbeddedBrowserBounds {
  const values = [rawBounds.x, rawBounds.y, rawBounds.width, rawBounds.height];
  if (!values.every((value) => Number.isFinite(value))) {
    throw new TypeError("Embedded browser bounds must be finite numbers");
  }
  return {
    height: Math.max(0, Math.round(rawBounds.height)),
    width: Math.max(0, Math.round(rawBounds.width)),
    x: Math.max(0, Math.round(rawBounds.x)),
    y: Math.max(0, Math.round(rawBounds.y)),
  };
}

export class EmbeddedBrowserHost {
  readonly #window: BrowserWindow;
  #error: string | null = null;
  #view: WebContentsView | null = null;

  constructor(window: BrowserWindow) {
    this.#window = window;
  }

  async ensure(
    initialUrl = DEFAULT_BROWSER_URL,
  ): Promise<EmbeddedBrowserState> {
    const view = this.#ensureView();
    if (!view.webContents.getURL()) {
      await this.#load(initialUrl);
    }
    return this.state();
  }

  async navigate(input: string): Promise<EmbeddedBrowserState> {
    this.#ensureView();
    await this.#load(input);
    return this.state();
  }

  perform(action: EmbeddedBrowserAction): EmbeddedBrowserState {
    const contents = this.#ensureView().webContents;
    switch (action) {
      case "back":
        if (contents.navigationHistory.canGoBack()) {
          contents.navigationHistory.goBack();
        }
        break;
      case "forward":
        if (contents.navigationHistory.canGoForward()) {
          contents.navigationHistory.goForward();
        }
        break;
      case "reload":
        contents.reload();
        break;
      case "stop":
        contents.stop();
        break;
    }
    return this.state();
  }

  setBounds(rawBounds: EmbeddedBrowserBounds | null): void {
    if (rawBounds === null) {
      this.#view?.setVisible(false);
      return;
    }

    const view = this.#ensureView();
    const requested = validBounds(rawBounds);
    const contentSize = this.#window.getContentSize();
    const contentWidth = contentSize[0] ?? 0;
    const contentHeight = contentSize[1] ?? 0;
    const x = Math.min(requested.x, contentWidth);
    const y = Math.min(requested.y, contentHeight);
    const width = Math.min(requested.width, contentWidth - x);
    const height = Math.min(requested.height, contentHeight - y);
    view.setBounds({ height, width, x, y });
    view.setVisible(width > 0 && height > 0);
    this.#window.contentView.addChildView(view);
  }

  state(): EmbeddedBrowserState {
    const contents = this.#view?.webContents;
    if (!contents || contents.isDestroyed()) {
      return {
        canGoBack: false,
        canGoForward: false,
        error: this.#error,
        loading: false,
        title: "Browser",
        url: "",
      };
    }
    return {
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      error: this.#error,
      loading: contents.isLoading(),
      title: contents.getTitle() || "Browser",
      url: contents.getURL(),
    };
  }

  close(): void {
    const view = this.#view;
    this.#view = null;
    if (!view) return;
    if (!this.#window.isDestroyed()) {
      this.#window.contentView.removeChildView(view);
    }
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  #ensureView(): WebContentsView {
    if (this.#view && !this.#view.webContents.isDestroyed()) return this.#view;

    const browserSession = session.fromPartition(BROWSER_PARTITION);
    browserSession.setPermissionCheckHandler(() => false);
    browserSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    browserSession.removeAllListeners("will-download");
    browserSession.on("will-download", (event) => event.preventDefault());

    const view = new WebContentsView({
      webPreferences: {
        allowRunningInsecureContent: false,
        contextIsolation: true,
        navigateOnDragDrop: false,
        nodeIntegration: false,
        partition: BROWSER_PARTITION,
        safeDialogs: true,
        sandbox: true,
        spellcheck: true,
        webSecurity: true,
      },
    });
    view.setBackgroundColor("#ffffff");
    view.setVisible(false);
    this.#window.contentView.addChildView(view);
    this.#view = view;

    const contents = view.webContents;
    const publishState = () => this.#publishState();
    contents.on("did-start-loading", () => {
      this.#error = null;
      publishState();
    });
    contents.on("did-stop-loading", publishState);
    contents.on("did-navigate", publishState);
    contents.on("did-navigate-in-page", publishState);
    contents.on("page-title-updated", publishState);
    contents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, _url, isMainFrame) => {
        if (isMainFrame && errorCode !== -3) {
          this.#error = errorDescription;
          publishState();
        }
      },
    );
    contents.on("render-process-gone", (_event, details) => {
      this.#error = `Browser process ${details.reason}`;
      publishState();
    });
    contents.on("will-navigate", (details) => {
      if (!isAllowedBrowserNavigation(details.url)) details.preventDefault();
    });
    contents.on("will-redirect", (details) => {
      if (!isAllowedBrowserNavigation(details.url)) details.preventDefault();
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedBrowserNavigation(url)) {
        void contents.loadURL(url).catch(() => undefined);
      }
      return { action: "deny" };
    });

    return view;
  }

  async #load(input: string): Promise<void> {
    const resolved = resolveBrowserInput(input);
    if (!resolved.ok) {
      this.#error = resolved.reason;
      this.#publishState();
      return;
    }
    this.#error = null;
    try {
      await this.#ensureView().webContents.loadURL(resolved.url);
    } catch (error) {
      this.#error = error instanceof Error ? error.message : String(error);
      this.#publishState();
    }
  }

  #publishState(): void {
    if (this.#window.isDestroyed() || this.#window.webContents.isDestroyed()) {
      return;
    }
    this.#window.webContents.send(
      "desktop:embedded-browser-state",
      this.state(),
    );
  }
}
