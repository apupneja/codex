import type { HostEvent, JsonValue, Thread } from "./protocol";

export type NativeTheme = "system" | "light" | "dark";
export type LocalAttachment = {
  kind: "audio" | "image";
  name: string;
  path: string;
};
export type BrowserDataType =
  | "cache"
  | "cookies"
  | "downloads"
  | "history"
  | "siteData";
export type NativeNotification = {
  body: string;
  id: string;
  title: string;
};

export type DesktopBridge = {
  request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T>;
  answer(id: string | number, result: JsonValue): void;
  clearBrowserData(dataTypes: BrowserDataType[]): Promise<void>;
  closeNotification(id: string): Promise<void>;
  installUpdate(): Promise<void>;
  selectFolder(): Promise<string | null>;
  selectFiles(): Promise<LocalAttachment[]>;
  getGitRoot(cwd: string): Promise<string | null>;
  openExternal(url: string): Promise<void>;
  revealPath(path: string): Promise<void>;
  listSkills(cwd?: string): Promise<string[]>;
  listLocalThreads(): Promise<Thread[]>;
  readAgentsFile(): Promise<{ contents: string; path: string }>;
  openConfigFile(): Promise<void>;
  setBrowserDownloadDirectory(path: string | null): Promise<void>;
  setBrowserDownloadPrompt(enabled: boolean): Promise<void>;
  setMenuBarVisible(visible: boolean): Promise<void>;
  setPetOverlay(open: boolean, pet: string): Promise<void>;
  setPreventSleep(enabled: boolean): Promise<void>;
  setTheme(theme: NativeTheme): Promise<void>;
  showNotification(notification: NativeNotification): Promise<void>;
  writeAgentsFile(contents: string): Promise<{ path: string }>;
  ready(): Promise<void>;
  subscribe(listener: (event: HostEvent) => void): () => void;
};
