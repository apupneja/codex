import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopApi,
  DesktopAppAction,
  DesktopEvent,
  EmbeddedBrowserAction,
  EmbeddedBrowserBounds,
  EmbeddedBrowserState,
  DesktopPreferences,
  JsonObject,
  JsonValue,
  ManagedWorktree,
  RpcId,
  TerminalOutputBatch,
} from "../shared/types";

const desktopEventListeners = new Set<(event: DesktopEvent) => void>();
const pendingDesktopEvents: DesktopEvent[] = [];
const embeddedBrowserListeners = new Set<
  (state: EmbeddedBrowserState) => void
>();
ipcRenderer.on("desktop:event", (_event, payload: DesktopEvent) => {
  if (desktopEventListeners.size === 0) {
    pendingDesktopEvents.push(payload);
    if (pendingDesktopEvents.length > 256) pendingDesktopEvents.shift();
    return;
  }
  for (const listener of desktopEventListeners) listener(payload);
});
ipcRenderer.on(
  "desktop:embedded-browser-state",
  (_event, state: EmbeddedBrowserState) => {
    for (const listener of embeddedBrowserListeners) listener(state);
  },
);

const api: DesktopApi = {
  chooseFiles: () =>
    ipcRenderer.invoke("workspace:chooseFiles") as Promise<string[]>,
  chooseWorkspace: () =>
    ipcRenderer.invoke("workspace:choose") as Promise<string | null>,
  confirmDiscardChanges: (path: string) =>
    ipcRenderer.invoke(
      "workspace:confirmDiscardChanges",
      path,
    ) as Promise<boolean>,
  ensureEmbeddedBrowser: (initialUrl?: string) =>
    ipcRenderer.invoke(
      "embeddedBrowser:ensure",
      initialUrl,
    ) as Promise<EmbeddedBrowserState>,
  getPreferences: () =>
    ipcRenderer.invoke("preferences:get") as Promise<DesktopPreferences>,
  listManagedWorktrees: () =>
    ipcRenderer.invoke("worktrees:list") as Promise<ManagedWorktree[]>,
  navigateEmbeddedBrowser: (input: string) =>
    ipcRenderer.invoke(
      "embeddedBrowser:navigate",
      input,
    ) as Promise<EmbeddedBrowserState>,
  notify: (method: string, params?: JsonObject) =>
    ipcRenderer.invoke("rpc:notify", method, params) as Promise<void>,
  acknowledgeTerminalOutput: (processId: string, sequence: number) =>
    ipcRenderer.send("terminal:output:ack", processId, sequence),
  onEvent: (listener: (event: DesktopEvent) => void) => {
    desktopEventListeners.add(listener);
    for (const event of pendingDesktopEvents.splice(0)) listener(event);
    return () => desktopEventListeners.delete(listener);
  },
  onEmbeddedBrowserState: (listener: (state: EmbeddedBrowserState) => void) => {
    embeddedBrowserListeners.add(listener);
    return () => embeddedBrowserListeners.delete(listener);
  },
  onShortcut: (listener: (shortcut: string) => void) => {
    const shortcutListener = (
      _event: Electron.IpcRendererEvent,
      shortcut: string,
    ) => listener(shortcut);
    ipcRenderer.on("desktop:shortcut", shortcutListener);
    return () =>
      ipcRenderer.removeListener("desktop:shortcut", shortcutListener);
  },
  onTerminalOutput: (listener: (batch: TerminalOutputBatch) => void) => {
    const outputListener = (
      _event: Electron.IpcRendererEvent,
      batch: TerminalOutputBatch,
    ) => listener(batch);
    ipcRenderer.on("terminal:output", outputListener);
    return () => ipcRenderer.removeListener("terminal:output", outputListener);
  },
  openExternal: (url: string) =>
    ipcRenderer.invoke("shell:openExternal", url) as Promise<void>,
  performAppAction: (action: DesktopAppAction) =>
    ipcRenderer.invoke("app:performAction", action) as Promise<void>,
  performEmbeddedBrowserAction: (action: EmbeddedBrowserAction) =>
    ipcRenderer.invoke(
      "embeddedBrowser:performAction",
      action,
    ) as Promise<EmbeddedBrowserState>,
  request: <T = JsonValue>(method: string, params?: JsonObject) =>
    ipcRenderer.invoke("rpc:request", method, params) as Promise<T>,
  restartRuntime: () => ipcRenderer.invoke("runtime:restart") as Promise<void>,
  respond: (id: RpcId, result: JsonValue) =>
    ipcRenderer.invoke("rpc:respond", id, result) as Promise<void>,
  revealPath: (path: string) =>
    ipcRenderer.invoke("shell:revealPath", path) as Promise<void>,
  setWorkspacePanelVisibility: (options) =>
    ipcRenderer.invoke(
      "workspace:setPanelVisibility",
      options,
    ) as Promise<void>,
  setPreferences: (patch: Partial<DesktopPreferences>) =>
    ipcRenderer.invoke("preferences:set", patch) as Promise<DesktopPreferences>,
  setEmbeddedBrowserBounds: (bounds: EmbeddedBrowserBounds | null) =>
    ipcRenderer.invoke("embeddedBrowser:setBounds", bounds) as Promise<void>,
  setUnsavedChanges: (hasChanges: boolean) =>
    ipcRenderer.send("desktop:unsaved-changes", hasChanges),
  signalSmokeReady: () => ipcRenderer.send("desktop:smoke-ready"),
};

contextBridge.exposeInMainWorld("codexDesktop", Object.freeze(api));
