import type { InitializeResponse } from "../../../codex-rs/app-server-protocol/schema/typescript/InitializeResponse";
import type { ServerNotification } from "../../../codex-rs/app-server-protocol/schema/typescript/ServerNotification";
import type { ServerRequest } from "../../../codex-rs/app-server-protocol/schema/typescript/ServerRequest";
import type { Account } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/Account";
import type { AppsListResponse } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/AppsListResponse";
import type { Model } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/Model";
import type { PluginInstallResponse } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/PluginInstallResponse";
import type { PluginListResponse } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/PluginListResponse";
import type { SkillMetadata } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/SkillMetadata";
import type { SkillsConfigWriteResponse } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/SkillsConfigWriteResponse";
import type { SkillsListResponse } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/SkillsListResponse";
import type { Thread } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/Thread";
import type { ThreadItem } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem";
import type { Turn } from "../../../codex-rs/app-server-protocol/schema/typescript/v2/Turn";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type RpcId = number | string;

export type RpcRequest = {
  id: RpcId;
  method: string;
  params?: JsonObject;
};

export type RpcResponse = {
  id: RpcId;
  result?: JsonValue;
  error?: {
    code: number;
    message: string;
    data?: JsonValue;
  };
};

export type RpcNotification = {
  method: string;
  params?: JsonObject;
  emittedAtMs?: number;
};

export type RuntimePhase =
  | "starting"
  | "ready"
  | "restarting"
  | "stopped"
  | "failed";

export type RuntimeStatus = {
  phase: RuntimePhase;
  binary?: string;
  detail?: string;
  attempt?: number;
  initialized?: InitializeResponse;
};

export type DesktopTheme =
  | "dark"
  | "dark-high-contrast"
  | "light"
  | "light-colorblind"
  | "system";

export type DesktopPreferences = {
  approvalPolicy: "untrusted" | "on-request" | "never";
  editorFontSize: number;
  lastWorkspace: string | null;
  recentWorkspaces: string[];
  rightPanelOpen: boolean;
  sandbox: "read-only" | "workspace-write" | "danger-full-access";
  selectedEffort: string;
  selectedModel: string | null;
  sidebarOpen: boolean;
  theme: DesktopTheme;
  uiFontSize: number;
};

export type DirectoryEntry = {
  fileName: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type ManagedWorktree = {
  modifiedAtMs: number;
  path: string;
};

export type ComposerContextBlock = {
  text: string;
  title: string;
};

export type PromptSubmission = {
  attachments: string[];
  contexts: ComposerContextBlock[];
  text: string;
};

export type EmbeddedBrowserAction = "back" | "forward" | "reload" | "stop";

export type EmbeddedBrowserBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type EmbeddedBrowserState = {
  canGoBack: boolean;
  canGoForward: boolean;
  error: string | null;
  loading: boolean;
  title: string;
  url: string;
};

export type OpenDocument = {
  dirty: boolean;
  externalChanged: boolean;
  language: string;
  originalText: string;
  path: string;
  text: string;
};

export type TerminalSession = {
  commandId: string;
  processId: string | null;
  threadId: string | null;
};

export type TerminalOutputChunk = {
  capReached: boolean;
  deltaBase64: string;
};

export type TerminalOutputBatch = {
  chunks: TerminalOutputChunk[];
  failure?: string;
  processId: string;
  sequence: number;
};

export type DesktopEvent =
  | { type: "notification"; payload: ServerNotification | RpcNotification }
  | { type: "server-request"; payload: ServerRequest | RpcRequest }
  | { type: "runtime"; payload: RuntimeStatus };

export type DesktopAppAction =
  | "open-logs-folder"
  | "open-skill-logs"
  | "open-ssh-config"
  | "reload-window"
  | "toggle-developer-tools";

export type DesktopApi = {
  chooseFiles(): Promise<string[]>;
  chooseWorkspace(): Promise<string | null>;
  confirmDiscardChanges(path: string): Promise<boolean>;
  ensureEmbeddedBrowser(initialUrl?: string): Promise<EmbeddedBrowserState>;
  getPreferences(): Promise<DesktopPreferences>;
  listManagedWorktrees(): Promise<ManagedWorktree[]>;
  navigateEmbeddedBrowser(input: string): Promise<EmbeddedBrowserState>;
  notify(method: string, params?: JsonObject): Promise<void>;
  onEmbeddedBrowserState(
    listener: (state: EmbeddedBrowserState) => void,
  ): () => void;
  onEvent(listener: (event: DesktopEvent) => void): () => void;
  onShortcut(listener: (shortcut: string) => void): () => void;
  onTerminalOutput(listener: (batch: TerminalOutputBatch) => void): () => void;
  openExternal(url: string): Promise<void>;
  performAppAction(action: DesktopAppAction): Promise<void>;
  performEmbeddedBrowserAction(
    action: EmbeddedBrowserAction,
  ): Promise<EmbeddedBrowserState>;
  request<T = JsonValue>(method: string, params?: JsonObject): Promise<T>;
  restartRuntime(): Promise<void>;
  respond(id: RpcId, result: JsonValue): Promise<void>;
  revealPath(path: string): Promise<void>;
  setWorkspacePanelVisibility(options: {
    sidebarMode: "hidden" | "inline" | "overlay";
    visibility: "closed" | "open";
  }): Promise<void>;
  setPreferences(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences>;
  setEmbeddedBrowserBounds(bounds: EmbeddedBrowserBounds | null): Promise<void>;
  acknowledgeTerminalOutput(processId: string, sequence: number): void;
  setUnsavedChanges(hasChanges: boolean): void;
  signalSmokeReady(): void;
};

export type {
  Account,
  AppsListResponse,
  Model,
  PluginInstallResponse,
  PluginListResponse,
  ServerNotification,
  ServerRequest,
  SkillMetadata,
  SkillsConfigWriteResponse,
  SkillsListResponse,
  Thread,
  ThreadItem,
  Turn,
};
