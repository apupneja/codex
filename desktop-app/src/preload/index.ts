import { contextBridge, ipcRenderer } from "electron";

import type { DesktopBridge } from "../shared/bridge";
import type { HostEvent, JsonValue } from "../shared/protocol";

const bridge: DesktopBridge = {
  request: (method, params) =>
    ipcRenderer.invoke("host:request", method, params),
  answer: (id, result: JsonValue) =>
    ipcRenderer.send("host:answer", id, result),
  clearBrowserData: (dataTypes) =>
    ipcRenderer.invoke("native:clear-browser-data", dataTypes),
  closeNotification: (id) =>
    ipcRenderer.invoke("native:close-notification", id),
  installUpdate: () => ipcRenderer.invoke("native:install-update"),
  selectFolder: () => ipcRenderer.invoke("native:select-folder"),
  selectFiles: () => ipcRenderer.invoke("native:select-files"),
  getGitRoot: (cwd) => ipcRenderer.invoke("native:get-git-root", cwd),
  openExternal: (url) => ipcRenderer.invoke("native:open-external", url),
  revealPath: (path) => ipcRenderer.invoke("native:reveal", path),
  listSkills: (cwd) => ipcRenderer.invoke("native:list-skills", cwd),
  listLocalThreads: () => ipcRenderer.invoke("native:list-local-threads"),
  readAgentsFile: () => ipcRenderer.invoke("native:read-agents-file"),
  openConfigFile: () => ipcRenderer.invoke("native:open-config-file"),
  setBrowserDownloadDirectory: (path) =>
    ipcRenderer.invoke("native:set-browser-download-directory", path),
  setBrowserDownloadPrompt: (enabled) =>
    ipcRenderer.invoke("native:set-browser-download-prompt", enabled),
  setMenuBarVisible: (visible) =>
    ipcRenderer.invoke("native:set-menu-bar-visible", visible),
  setPetOverlay: (open, pet) =>
    ipcRenderer.invoke("native:set-pet-overlay", open, pet),
  setPreventSleep: (enabled) =>
    ipcRenderer.invoke("native:set-prevent-sleep", enabled),
  setTheme: (theme) => ipcRenderer.invoke("native:set-theme", theme),
  showNotification: (notification) =>
    ipcRenderer.invoke("native:show-notification", notification),
  writeAgentsFile: (contents) =>
    ipcRenderer.invoke("native:write-agents-file", contents),
  ready: () => ipcRenderer.invoke("app:ready"),
  subscribe: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, event: HostEvent) =>
      listener(event);
    ipcRenderer.on("host:event", wrapped);
    return () => ipcRenderer.removeListener("host:event", wrapped);
  },
};

contextBridge.exposeInMainWorld("chatgptDesktop", bridge);
