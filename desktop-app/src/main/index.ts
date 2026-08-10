import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  ipcMain,
  nativeTheme,
  net,
  protocol,
  session,
  shell,
  webContents,
} from "electron";

import type {
  DesktopEvent,
  DesktopPreferences,
  JsonObject,
  JsonValue,
  RuntimeStatus,
  RpcNotification,
  RpcRequest,
  ServerRequest,
} from "../shared/types";
import { isAllowedPreviewUrl, validatePreviewUrl } from "../shared/preview-url";
import { PreferencesStore } from "./preferences";
import { RendererRequestPolicy } from "./request-policy";
import { AppServerRpcClient } from "./rpc-client";
import { resolveLaunchCommand } from "./runtime";
import {
  serverRequestKey,
  validatePendingServerResponse,
} from "./server-response-policy";
import { SingleFlight } from "./single-flight";
import {
  TerminalOutputBroker,
  type TerminalOutputFailure,
} from "./terminal-output";

const APP_NAME = "Codex Desktop";
const RPC_METHODS = new Set([
  "account/login/cancel",
  "account/login/start",
  "account/logout",
  "account/rateLimits/read",
  "account/read",
  "app/list",
  "command/exec",
  "command/exec/resize",
  "command/exec/terminate",
  "command/exec/write",
  "config/read",
  "fs/readDirectory",
  "fs/readFile",
  "fs/unwatch",
  "fs/watch",
  "fs/writeFile",
  "fuzzyFileSearch",
  "model/list",
  "permissionProfile/list",
  "plugin/install",
  "plugin/installed",
  "plugin/list",
  "plugin/uninstall",
  "review/start",
  "skills/config/write",
  "skills/list",
  "thread/archive",
  "thread/list",
  "thread/name/set",
  "thread/read",
  "thread/resume",
  "thread/start",
  "thread/turns/list",
  "turn/interrupt",
  "turn/start",
  "turn/steer",
]);
const NOTIFICATION_METHODS = new Set(["initialized"]);
const MAX_TERMINAL_PROCESSES_PER_RENDERER = 4;

let mainWindow: BrowserWindow | null = null;
let preferences: PreferencesStore;
let rpc = new AppServerRpcClient();
let runtimeGeneration = 1;
let restartTimer: NodeJS.Timeout | null = null;
let restartAttempt = 0;
let shuttingDown = false;
let hasUnsavedChanges = false;
let quitConfirmed = false;
let quitPromptOpen = false;
let windowCloseConfirmed = false;
let windowClosePromptOpen = false;
let pendingDeepLink: string | null = null;
let stderrBuffer = "";
let currentRuntimeStatus: RuntimeStatus = { phase: "starting" };
const pendingServerRequests = new Map<string, ServerRequest | RpcRequest>();
const requestPolicy = new RendererRequestPolicy();
const runtimeRestart = new SingleFlight<void>();
const rendererResources = new Map<
  number,
  { processIds: Set<string>; watchIds: Set<string> }
>();
const terminalOutput = new TerminalOutputBroker({
  deliver: (ownerId, batch) => {
    const target = webContents.fromId(ownerId);
    if (!target || target.isDestroyed()) return false;
    target.send("terminal:output", batch);
    return true;
  },
  onFailure: handleTerminalOutputFailure,
});

app.setName(APP_NAME);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "codex-app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
]);

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validatePayload(value: unknown): JsonObject | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new TypeError("IPC params must be a JSON object");
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 10 * 1024 * 1024) {
    throw new RangeError("IPC payload exceeds 10 MiB");
  }
  return value;
}

function developmentRendererUrl(): URL | null {
  if (app.isPackaged || !process.env.CODEX_DESKTOP_DEV_URL) return null;
  try {
    const url = new URL(process.env.CODEX_DESKTOP_DEV_URL);
    if (
      url.protocol !== "http:" ||
      !new Set(["127.0.0.1", "[::1]", "localhost"]).has(url.hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isTrustedRendererUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const devUrl = developmentRendererUrl();
    if (devUrl) {
      return url.origin === devUrl.origin;
    }
    return url.protocol === "codex-app:" && url.hostname === "desktop";
  } catch {
    return false;
  }
}

function isAllowedPreviewNavigation(rawUrl: string): boolean {
  return isAllowedPreviewUrl(rawUrl, developmentRendererUrl()?.origin);
}

function assertTrustedSender(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
): void {
  if (!event.senderFrame || !isTrustedRendererUrl(event.senderFrame.url)) {
    throw new Error("Rejected IPC from an untrusted renderer");
  }
}

function registerRendererProtocol(): void {
  const rendererRoot = resolve(__dirname, "..", "renderer");
  protocol.handle("codex-app", (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const filePath = resolve(rendererRoot, relativePath.slice(1));
    if (
      url.hostname !== "desktop" ||
      (filePath !== rendererRoot &&
        !filePath.startsWith(`${rendererRoot}${sep}`))
    ) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function resourcesFor(ownerId: number): {
  processIds: Set<string>;
  watchIds: Set<string>;
} {
  const current = rendererResources.get(ownerId);
  if (current) return current;
  const created = {
    processIds: new Set<string>(),
    watchIds: new Set<string>(),
  };
  rendererResources.set(ownerId, created);
  return created;
}

function resourceId(params: JsonObject | undefined, key: string): string {
  const id = params?.[key];
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    throw new TypeError(`${key} must be a non-empty string`);
  }
  return id;
}

function cleanupRendererResources(ownerId: number): void {
  requestPolicy.clearOwner(ownerId);
  terminalOutput.closeOwner(ownerId);
  const resources = rendererResources.get(ownerId);
  if (!resources) return;
  rendererResources.delete(ownerId);
  for (const processId of resources.processIds) {
    void rpc
      .request("command/exec/terminate", { processId })
      .catch(() => undefined);
  }
  for (const watchId of resources.watchIds) {
    void rpc.request("fs/unwatch", { watchId }).catch(() => undefined);
  }
}

function handleTerminalOutputFailure({
  message,
  ownerId,
  processId,
  terminateProcess,
}: TerminalOutputFailure): void {
  const target = webContents.fromId(ownerId);
  if (target && !target.isDestroyed()) {
    target.send("terminal:output", {
      chunks: [],
      failure: message,
      processId,
      sequence: 0,
    });
  }
  if (
    terminateProcess &&
    rendererResources.get(ownerId)?.processIds.has(processId)
  ) {
    void rpc
      .request("command/exec/terminate", { processId })
      .catch(() => undefined);
  }
}

function processOwner(processId: string): number | null {
  for (const [ownerId, resources] of rendererResources) {
    if (resources.processIds.has(processId)) return ownerId;
  }
  return null;
}

function broadcast(event: DesktopEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("desktop:event", event);
    }
  }
}

function runtimeStatus(payload: RuntimeStatus): void {
  currentRuntimeStatus = payload;
  broadcast({ type: "runtime", payload });
}

function isCurrentRuntime(
  client: AppServerRpcClient,
  generation: number,
): boolean {
  return rpc === client && runtimeGeneration === generation;
}

function wireRpcEvents(client: AppServerRpcClient, generation: number): void {
  client.on("notification", (payload: RpcNotification) => {
    if (!isCurrentRuntime(client, generation)) return;
    if (
      payload.method === "serverRequest/resolved" &&
      (typeof payload.params?.requestId === "string" ||
        typeof payload.params?.requestId === "number")
    ) {
      pendingServerRequests.delete(serverRequestKey(payload.params.requestId));
    }
    if (
      payload.method === "command/exec/outputDelta" &&
      typeof payload.params?.processId === "string"
    ) {
      const processId = payload.params.processId;
      if (processOwner(processId) !== null) {
        if (typeof payload.params.deltaBase64 === "string") {
          terminalOutput.enqueue(processId, {
            capReached: payload.params.capReached === true,
            deltaBase64: payload.params.deltaBase64,
          });
        }
        return;
      }
    }
    broadcast({ type: "notification", payload });
  });
  client.on("server-request", (payload: ServerRequest | RpcRequest) => {
    if (!isCurrentRuntime(client, generation)) return;
    pendingServerRequests.set(serverRequestKey(payload.id), payload);
    broadcast({ type: "server-request", payload });
  });
  client.on("stderr", (chunk: string) => {
    if (!isCurrentRuntime(client, generation)) return;
    stderrBuffer = `${stderrBuffer}${chunk}`.slice(-32_000);
  });
  client.on("protocol-warning", (detail: string) => {
    if (!isCurrentRuntime(client, generation)) return;
    broadcast({
      type: "notification",
      payload: { method: "desktop/protocolWarning", params: { detail } },
    });
  });
  client.on("transport-error", (error: Error) => {
    if (!isCurrentRuntime(client, generation)) return;
    runtimeStatus({ phase: "failed", detail: error.message });
  });
  client.on("exit", ({ closing }: { closing: boolean }) => {
    if (!isCurrentRuntime(client, generation)) return;
    pendingServerRequests.clear();
    terminalOutput.clear();
    rendererResources.clear();
    if (!closing && !shuttingDown) {
      scheduleRuntimeRestart();
    }
  });
}

async function startRuntime(
  client: AppServerRpcClient,
  generation: number,
): Promise<void> {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  try {
    const launch = resolveLaunchCommand({
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    });
    runtimeStatus({
      phase: restartAttempt ? "restarting" : "starting",
      binary: launch.command,
      attempt: restartAttempt || undefined,
    });
    const initialized = await client.start(launch, {
      name: "codex_desktop",
      title: APP_NAME,
      version: app.getVersion(),
    });
    if (!isCurrentRuntime(client, generation)) {
      await client.stop().catch(() => undefined);
      return;
    }
    restartAttempt = 0;
    runtimeStatus({
      phase: "ready",
      binary: launch.command,
      initialized: initialized as RuntimeStatus["initialized"],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await client.stop().catch(() => undefined);
    if (!isCurrentRuntime(client, generation)) return;
    runtimeStatus({ phase: "failed", detail });
    if (!shuttingDown) {
      scheduleRuntimeRestart();
    }
  }
}

async function replaceRuntime(): Promise<void> {
  const previous = rpc;
  const client = new AppServerRpcClient();
  const generation = runtimeGeneration + 1;
  runtimeGeneration = generation;
  rpc = client;
  wireRpcEvents(client, generation);
  pendingServerRequests.clear();
  terminalOutput.clear();
  rendererResources.clear();
  await previous.stop().catch(() => undefined);
  if (shuttingDown) {
    await client.stop().catch(() => undefined);
    return;
  }
  await startRuntime(client, generation);
}

function transitionRuntime(): Promise<void> {
  return runtimeRestart.run(replaceRuntime);
}

async function restartRuntime(): Promise<void> {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  restartAttempt = 0;
  await transitionRuntime();
}

function scheduleRuntimeRestart(): void {
  if (restartTimer) {
    return;
  }
  restartAttempt += 1;
  if (restartAttempt > 5) {
    runtimeStatus({
      phase: "failed",
      attempt: restartAttempt,
      detail: `Codex runtime repeatedly stopped. ${stderrBuffer.slice(-1_000)}`,
    });
    return;
  }
  const delay = Math.min(1_000 * 2 ** (restartAttempt - 1), 15_000);
  runtimeStatus({
    phase: "restarting",
    attempt: restartAttempt,
    detail: `Retrying in ${Math.ceil(delay / 1_000)}s`,
  });
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void transitionRuntime();
  }, delay);
}

function configureIpc(): void {
  ipcMain.handle(
    "rpc:request",
    async (event, method: unknown, rawParams?: unknown) => {
      assertTrustedSender(event);
      if (typeof method !== "string" || !RPC_METHODS.has(method)) {
        throw new Error(`Renderer is not allowed to call ${String(method)}`);
      }
      const params = validatePayload(rawParams);
      const ownerId = event.sender.id;
      await requestPolicy.authorizeRequest(ownerId, method, params);
      const resources = resourcesFor(ownerId);
      const timeout =
        method === "command/exec" && params?.disableTimeout === true
          ? null
          : undefined;
      if (method === "command/exec") {
        const processId = resourceId(params, "processId");
        if (
          resources.processIds.has(processId) ||
          processOwner(processId) !== null
        ) {
          throw new Error("Terminal process id is already in use");
        }
        if (resources.processIds.size >= MAX_TERMINAL_PROCESSES_PER_RENDERER) {
          throw new Error("Too many terminal processes are already running");
        }
        terminalOutput.register(ownerId, processId);
        resources.processIds.add(processId);
        try {
          const result = await rpc.request(method, params, timeout);
          await terminalOutput.complete(processId);
          return result;
        } finally {
          terminalOutput.close(processId);
          resources.processIds.delete(processId);
        }
      }
      if (
        method === "command/exec/write" ||
        method === "command/exec/resize" ||
        method === "command/exec/terminate"
      ) {
        const processId = resourceId(params, "processId");
        if (!resources.processIds.has(processId)) {
          throw new Error("Renderer does not own this terminal process");
        }
        try {
          return await rpc.request(method, params, timeout);
        } finally {
          if (method === "command/exec/terminate") {
            terminalOutput.close(processId);
          }
        }
      }
      if (method === "fs/watch") {
        const watchId = resourceId(params, "watchId");
        if (resources.watchIds.has(watchId)) {
          throw new Error("Filesystem watch id is already in use");
        }
        resources.watchIds.add(watchId);
        try {
          const result = await rpc.request(method, params, timeout);
          if (event.sender.isDestroyed()) {
            cleanupRendererResources(ownerId);
          }
          return result;
        } catch (error) {
          resources.watchIds.delete(watchId);
          throw error;
        }
      }
      if (method === "fs/unwatch") {
        const watchId = resourceId(params, "watchId");
        if (!resources.watchIds.has(watchId)) {
          throw new Error("Renderer does not own this filesystem watch");
        }
        try {
          return await rpc.request(method, params, timeout);
        } finally {
          resources.watchIds.delete(watchId);
        }
      }
      const result = await rpc.request(method, params, timeout);
      await requestPolicy.grantResponseCapabilities(ownerId, method, result);
      return result;
    },
  );
  ipcMain.handle(
    "rpc:notify",
    async (event, method: unknown, rawParams?: unknown) => {
      assertTrustedSender(event);
      if (typeof method !== "string" || !NOTIFICATION_METHODS.has(method)) {
        throw new Error(`Renderer is not allowed to notify ${String(method)}`);
      }
      await rpc.notify(method, validatePayload(rawParams));
    },
  );
  ipcMain.on(
    "terminal:output:ack",
    (event, rawProcessId: unknown, rawSequence: unknown) => {
      assertTrustedSender(event);
      if (
        typeof rawProcessId !== "string" ||
        typeof rawSequence !== "number" ||
        !Number.isSafeInteger(rawSequence) ||
        rawSequence <= 0
      ) {
        return;
      }
      terminalOutput.acknowledge(event.sender.id, rawProcessId, rawSequence);
    },
  );
  ipcMain.handle("rpc:respond", async (event, id: unknown, result: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== "string" && typeof id !== "number") {
      throw new TypeError("Server request id must be a string or number");
    }
    const validated = validatePendingServerResponse(
      pendingServerRequests,
      id,
      result,
    );
    await rpc.respond(id, validated.result);
    pendingServerRequests.delete(validated.key);
  });
  ipcMain.handle("preferences:get", async (event) => {
    assertTrustedSender(event);
    const saved = preferences.get();
    await requestPolicy.grantPersistedWorkspaces(event.sender.id, [
      saved.lastWorkspace,
      ...saved.recentWorkspaces,
    ]);
    return saved;
  });
  ipcMain.handle("runtime:restart", async (event) => {
    assertTrustedSender(event);
    await restartRuntime();
  });
  ipcMain.handle(
    "preferences:set",
    async (event, patch: Partial<DesktopPreferences>) => {
      assertTrustedSender(event);
      if (!isPlainObject(patch)) {
        throw new TypeError("Preference update must be an object");
      }
      const sanitizedPatch: Partial<DesktopPreferences> = { ...patch };
      if ("lastWorkspace" in patch && patch.lastWorkspace !== null) {
        if (typeof patch.lastWorkspace !== "string") {
          throw new TypeError("lastWorkspace must be a path or null");
        }
        sanitizedPatch.lastWorkspace =
          await requestPolicy.assertWorkspaceDirectory(
            event.sender.id,
            patch.lastWorkspace,
          );
      }
      if ("recentWorkspaces" in patch) {
        if (!Array.isArray(patch.recentWorkspaces)) {
          throw new TypeError("recentWorkspaces must be a path array");
        }
        const canonicalWorkspaces: string[] = [];
        for (const workspace of patch.recentWorkspaces) {
          if (typeof workspace !== "string") {
            throw new TypeError("recentWorkspaces must contain only paths");
          }
          canonicalWorkspaces.push(
            await requestPolicy.assertWorkspaceDirectory(
              event.sender.id,
              workspace,
            ),
          );
        }
        sanitizedPatch.recentWorkspaces = canonicalWorkspaces;
      }
      const next = await preferences.update(sanitizedPatch);
      nativeTheme.themeSource = next.theme;
      return next;
    },
  );
  ipcMain.handle("workspace:choose", async (event) => {
    assertTrustedSender(event);
    const options: Electron.OpenDialogOptions = {
      title: "Open a repository",
      buttonLabel: "Open Repository",
      properties: ["openDirectory", "createDirectory"],
    };
    const response = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    let selected = response.canceled ? null : (response.filePaths[0] ?? null);
    if (selected) {
      selected = await requestPolicy.grantWorkspace(event.sender.id, selected);
      const current = preferences.get();
      await preferences.update({
        lastWorkspace: selected,
        recentWorkspaces: [
          selected,
          ...current.recentWorkspaces.filter((path) => path !== selected),
        ],
      });
    }
    return selected;
  });
  ipcMain.handle("workspace:chooseFiles", async (event) => {
    assertTrustedSender(event);
    const options: Electron.OpenDialogOptions = {
      title: "Attach files",
      buttonLabel: "Attach",
      properties: ["openFile", "multiSelections"],
    };
    const response = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    const selected = response.canceled ? [] : response.filePaths;
    await requestPolicy.grantAttachments(event.sender.id, selected);
    return selected;
  });
  ipcMain.handle("shell:openExternal", async (event, rawUrl: unknown) => {
    assertTrustedSender(event);
    if (typeof rawUrl !== "string") {
      throw new TypeError("URL must be a string");
    }
    const url = new URL(rawUrl);
    const allowedProtocol =
      new Set(["https:", "mailto:"]).has(url.protocol) ||
      (url.protocol === "http:" && isAllowedPreviewUrl(url.toString()));
    if (!allowedProtocol) {
      throw new Error(`Blocked external protocol ${url.protocol}`);
    }
    await shell.openExternal(url.toString());
  });
  ipcMain.handle("shell:revealPath", async (event, rawPath: unknown) => {
    assertTrustedSender(event);
    if (typeof rawPath !== "string" || !isAbsolute(rawPath)) {
      throw new TypeError("Reveal path must be absolute");
    }
    await requestPolicy.assertDisclosedPath(event.sender.id, rawPath);
    shell.showItemInFolder(normalize(rawPath));
  });
  ipcMain.on("desktop:smoke-ready", async (event) => {
    assertTrustedSender(event);
    const destination = process.env.CODEX_DESKTOP_SMOKE_OUTPUT;
    if (!destination || !mainWindow) {
      return;
    }
    const renderedReady = await mainWindow.webContents.executeJavaScript(
      process.env.CODEX_DESKTOP_SMOKE_PREVIEW_URL
        ? `Boolean(document.querySelector(".app-shell") && document.querySelector(".conversation-content .turn") && !document.querySelector(".conversation-loading") && document.querySelector(".preview-viewport iframe") && !document.querySelector(".preview-loading"))`
        : `Boolean(document.querySelector(".app-shell") && (document.querySelector(".new-task-view") || document.querySelector(".conversation-view")))`,
      true,
    );
    if (renderedReady !== true) {
      console.error("Desktop smoke readiness assertion failed");
      app.exit(1);
      return;
    }
    const image = await mainWindow.webContents.capturePage();
    await mkdir(dirname(destination), { recursive: true }).catch(
      () => undefined,
    );
    await writeFile(destination, image.toPNG());
    app.quit();
  });
  ipcMain.on("desktop:unsaved-changes", (event, value: unknown) => {
    assertTrustedSender(event);
    if (typeof value === "boolean") {
      hasUnsavedChanges = value;
    }
  });
}

async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  if (!mainWindow) return true;
  const result = await dialog.showMessageBox(mainWindow, {
    buttons: ["Keep Editing", "Discard Changes"],
    cancelId: 0,
    defaultId: 0,
    detail: "Unsaved editor buffers will be lost.",
    message: "Discard unsaved changes?",
    type: "warning",
  });
  return result.response === 1;
}

function createMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Task",
          accelerator: "CmdOrCtrl+N",
          click: () =>
            mainWindow?.webContents.send("desktop:shortcut", "new-task"),
        },
        {
          label: "Open Repository…",
          accelerator: "CmdOrCtrl+O",
          click: () =>
            mainWindow?.webContents.send("desktop:shortcut", "open-repository"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Search",
          accelerator: "CmdOrCtrl+K",
          click: () =>
            mainWindow?.webContents.send("desktop:shortcut", "search"),
        },
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () =>
            mainWindow?.webContents.send("desktop:shortcut", "toggle-sidebar"),
        },
        ...(app.isPackaged
          ? []
          : [
              { type: "separator" as const },
              { role: "reload" as const },
              { role: "toggleDevTools" as const },
              { type: "separator" as const },
            ]),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  const preload = join(__dirname, "..", "preload", "index.cjs");
  const isMac = process.platform === "darwin";
  const visualRegressionCapture = Boolean(
    process.env.CODEX_DESKTOP_SMOKE_OUTPUT,
  );
  windowCloseConfirmed = false;
  mainWindow = new BrowserWindow({
    width: visualRegressionCapture ? 1_361 : 1_440,
    height: visualRegressionCapture ? 881 : 900,
    minWidth: 1_040,
    minHeight: 680,
    show: false,
    backgroundColor: "#101112",
    title: APP_NAME,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isMac ? { trafficLightPosition: { x: 14, y: 15 } } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      sandbox: true,
      spellcheck: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === "https:") {
        void shell.openExternal(url);
      }
    } catch {
      // Malformed navigation targets are denied below.
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on("will-frame-navigate", (details) => {
    const allowed = details.isMainFrame
      ? isTrustedRendererUrl(details.url)
      : isAllowedPreviewNavigation(details.url);
    if (!allowed) {
      details.preventDefault();
    }
  });
  mainWindow.webContents.on("will-redirect", (details) => {
    const allowed = details.isMainFrame
      ? isTrustedRendererUrl(details.url)
      : isAllowedPreviewNavigation(details.url);
    if (!allowed) {
      details.preventDefault();
    }
  });
  const rendererOwnerId = mainWindow.webContents.id;
  mainWindow.webContents.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) {
      cleanupRendererResources(rendererOwnerId);
    }
  });
  mainWindow.webContents.on("render-process-gone", () => {
    cleanupRendererResources(rendererOwnerId);
  });
  mainWindow.webContents.on("destroyed", () => {
    cleanupRendererResources(rendererOwnerId);
  });
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("desktop:event", {
      type: "runtime",
      payload: currentRuntimeStatus,
    } satisfies DesktopEvent);
    for (const payload of pendingServerRequests.values()) {
      mainWindow?.webContents.send("desktop:event", {
        type: "server-request",
        payload,
      } satisfies DesktopEvent);
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => {
    if (
      !hasUnsavedChanges ||
      windowCloseConfirmed ||
      shuttingDown ||
      windowClosePromptOpen
    ) {
      if (windowClosePromptOpen) event.preventDefault();
      return;
    }
    event.preventDefault();
    windowClosePromptOpen = true;
    void confirmDiscardUnsavedChanges().then((discard) => {
      windowClosePromptOpen = false;
      if (discard) {
        hasUnsavedChanges = false;
        windowCloseConfirmed = true;
        mainWindow?.close();
      }
    });
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const rendererUrl =
    developmentRendererUrl() ?? new URL("codex-app://desktop/index.html");
  if (
    process.env.CODEX_DESKTOP_SMOKE_OUTPUT &&
    process.env.CODEX_DESKTOP_SMOKE_PREVIEW_URL
  ) {
    const preview = validatePreviewUrl(
      process.env.CODEX_DESKTOP_SMOKE_PREVIEW_URL,
      rendererUrl.origin,
    );
    if (preview.ok) {
      rendererUrl.searchParams.set("preview", preview.url);
      rendererUrl.searchParams.set("reference", "cursor");
    }
  }
  await mainWindow.loadURL(rendererUrl.toString());
  if (pendingDeepLink) {
    void sendDeepLink(pendingDeepLink);
    pendingDeepLink = null;
  }
}

async function sendDeepLink(rawUrl: string): Promise<void> {
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingDeepLink = rawUrl;
    return;
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (url.protocol !== "codex:" || url.hostname !== "threads") {
    return;
  }
  if (url.pathname === "/new") {
    const requestedPath = url.searchParams.get("path");
    if (requestedPath) {
      if (
        !isAbsolute(requestedPath) ||
        requestedPath.includes("\0") ||
        /^(?:[\\/]{2})/.test(requestedPath)
      ) {
        return;
      }
      let workspacePath = normalize(requestedPath);
      const metadata = await stat(workspacePath).catch(() => null);
      if (!metadata?.isDirectory()) {
        return;
      }
      const saved = preferences.get();
      let shouldRememberWorkspace = false;
      if (!saved.recentWorkspaces.includes(workspacePath)) {
        const result = await dialog.showMessageBox(mainWindow, {
          buttons: ["Cancel", "Open Repository"],
          cancelId: 0,
          defaultId: 1,
          detail: workspacePath,
          message: "Allow this link to open a local repository?",
          type: "question",
        });
        if (result.response !== 1) return;
        shouldRememberWorkspace = true;
      }
      workspacePath = await requestPolicy.grantWorkspace(
        mainWindow.webContents.id,
        workspacePath,
      );
      if (shouldRememberWorkspace) {
        await preferences.update({
          lastWorkspace: workspacePath,
          recentWorkspaces: [workspacePath, ...saved.recentWorkspaces],
        });
      }
      url.searchParams.set("path", workspacePath);
    }
  } else if (!/^\/[A-Za-z0-9-]{1,128}$/.test(url.pathname)) {
    return;
  }
  broadcast({
    type: "notification",
    payload: { method: "desktop/deepLink", params: { url: url.toString() } },
  });
  mainWindow.show();
  mainWindow.focus();
}

function deepLinkFromArgs(args: string[]): string | null {
  return args.find((argument) => argument.startsWith("codex://")) ?? null;
}

pendingDeepLink = deepLinkFromArgs(process.argv);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = deepLinkFromArgs(argv);
    if (link) {
      void sendDeepLink(link);
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void sendDeepLink(url);
  });
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient("codex");
  }
  registerRendererProtocol();
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) =>
      webContents === mainWindow?.webContents &&
      permission === "media" &&
      details.isMainFrame &&
      isTrustedRendererUrl(details.requestingUrl ?? requestingOrigin) &&
      details.mediaType === "audio",
  );
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const mediaTypes =
        "mediaTypes" in details ? (details.mediaTypes ?? []) : [];
      callback(
        webContents === mainWindow?.webContents &&
          permission === "media" &&
          details.isMainFrame &&
          isTrustedRendererUrl(details.requestingUrl) &&
          mediaTypes.length > 0 &&
          mediaTypes.every((mediaType) => mediaType === "audio"),
      );
    },
  );
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const blockedPreviewFrame =
      details.webContentsId === mainWindow?.webContents.id &&
      details.resourceType === "subFrame" &&
      !isAllowedPreviewNavigation(details.url);
    callback({ cancel: blockedPreviewFrame });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (
      details.resourceType !== "mainFrame" ||
      !isTrustedRendererUrl(details.url)
    ) {
      callback({});
      return;
    }
    const devConnect = developmentRendererUrl() ? " ws://127.0.0.1:*" : "";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'${devConnect}; frame-src http://localhost:* https://localhost:* http://127.0.0.1:* https://127.0.0.1:* http://[::1]:* https://[::1]:*`,
        ],
      },
    });
  });

  preferences = new PreferencesStore(app.getPath("userData"));
  const savedPreferences = await preferences.load();
  nativeTheme.themeSource = savedPreferences.theme;
  configureIpc();
  createMenu();
  wireRpcEvents(rpc, runtimeGeneration);
  await createWindow();
  void startRuntime(rpc, runtimeGeneration);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (hasUnsavedChanges && !quitConfirmed) {
    event.preventDefault();
    if (!quitPromptOpen) {
      quitPromptOpen = true;
      void confirmDiscardUnsavedChanges().then((discard) => {
        quitPromptOpen = false;
        if (discard) {
          hasUnsavedChanges = false;
          quitConfirmed = true;
          app.quit();
        }
      });
    }
    return;
  }
  if (shuttingDown) {
    return;
  }
  event.preventDefault();
  shuttingDown = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  void rpc.stop().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
