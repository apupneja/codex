import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopApi,
  DesktopEvent,
  DesktopPreferences,
  JsonObject,
  JsonValue,
  RpcId,
  TerminalOutputBatch,
} from "../shared/types";

const desktopEventListeners = new Set<(event: DesktopEvent) => void>();
const pendingDesktopEvents: DesktopEvent[] = [];
ipcRenderer.on("desktop:event", (_event, payload: DesktopEvent) => {
  if (desktopEventListeners.size === 0) {
    pendingDesktopEvents.push(payload);
    if (pendingDesktopEvents.length > 256) pendingDesktopEvents.shift();
    return;
  }
  for (const listener of desktopEventListeners) listener(payload);
});

const api: DesktopApi = {
  chooseFiles: () =>
    ipcRenderer.invoke("workspace:chooseFiles") as Promise<string[]>,
  chooseWorkspace: () =>
    ipcRenderer.invoke("workspace:choose") as Promise<string | null>,
  getPreferences: () =>
    ipcRenderer.invoke("preferences:get") as Promise<DesktopPreferences>,
  notify: (method: string, params?: JsonObject) =>
    ipcRenderer.invoke("rpc:notify", method, params) as Promise<void>,
  acknowledgeTerminalOutput: (processId: string, sequence: number) =>
    ipcRenderer.send("terminal:output:ack", processId, sequence),
  onEvent: (listener: (event: DesktopEvent) => void) => {
    desktopEventListeners.add(listener);
    for (const event of pendingDesktopEvents.splice(0)) listener(event);
    return () => desktopEventListeners.delete(listener);
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
  request: <T = JsonValue>(method: string, params?: JsonObject) =>
    ipcRenderer.invoke("rpc:request", method, params) as Promise<T>,
  restartRuntime: () => ipcRenderer.invoke("runtime:restart") as Promise<void>,
  respond: (id: RpcId, result: JsonValue) =>
    ipcRenderer.invoke("rpc:respond", id, result) as Promise<void>,
  revealPath: (path: string) =>
    ipcRenderer.invoke("shell:revealPath", path) as Promise<void>,
  setPreferences: (patch: Partial<DesktopPreferences>) =>
    ipcRenderer.invoke("preferences:set", patch) as Promise<DesktopPreferences>,
  setUnsavedChanges: (hasChanges: boolean) =>
    ipcRenderer.send("desktop:unsaved-changes", hasChanges),
  signalSmokeReady: () => ipcRenderer.send("desktop:smoke-ready"),
};

contextBridge.exposeInMainWorld("codexDesktop", Object.freeze(api));
