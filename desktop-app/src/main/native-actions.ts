import { homedir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
} from "node:path";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";

import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerSaveBlocker,
  screen,
  session,
  shell,
  Tray,
  type ClearStorageDataOptions,
} from "electron";

import type {
  BrowserDataType,
  NativeNotification,
  NativeTheme,
} from "../shared/bridge";
import { listLocalThreads } from "./local-thread-history";

const audioExtensions = new Set([".aac", ".flac", ".m4a", ".mp3", ".wav"]);
let browserDownloadDirectory: string | null = null;
let browserDownloadPrompt = false;
let petOverlayWindow: BrowserWindow | null = null;
let powerSaveBlockerId: number | null = null;
let menuBarTray: Tray | null = null;
const nativeNotifications = new Map<string, Notification>();

async function setPetOverlay(open: boolean, pet: string): Promise<void> {
  if (!open) {
    petOverlayWindow?.close();
    petOverlayWindow = null;
    return;
  }

  const safePet = /^[a-z0-9-]+$/.test(pet) ? pet : "codex";
  if (!petOverlayWindow) {
    const { workArea } = screen.getPrimaryDisplay();
    petOverlayWindow = new BrowserWindow({
      alwaysOnTop: true,
      backgroundColor: "#00000000",
      frame: false,
      hasShadow: false,
      height: 224,
      maximizable: false,
      minimizable: false,
      resizable: false,
      roundedCorners: false,
      show: false,
      skipTaskbar: true,
      transparent: true,
      width: 224,
      x: workArea.x + workArea.width - 248,
      y: workArea.y + workArea.height - 248,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    petOverlayWindow.setAlwaysOnTop(true, "floating");
    petOverlayWindow.on("closed", () => (petOverlayWindow = null));
    petOverlayWindow.once("ready-to-show", () => petOverlayWindow?.show());
  }

  const developmentUrl = process.env.CODEX_DESKTOP_DEV_URL;
  if (developmentUrl) {
    const url = new URL(developmentUrl);
    url.searchParams.set("surface", "pet");
    url.searchParams.set("pet", safePet);
    await petOverlayWindow.loadURL(url.toString());
  } else {
    await petOverlayWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      query: { pet: safePet, surface: "pet" },
    });
  }
}

export function registerNativeActions(
  getWindow: () => BrowserWindow | null,
  setTheme: (theme: NativeTheme) => void,
  showWindow: () => void,
): void {
  ipcMain.handle("native:list-local-threads", () => listLocalThreads());
  void app.whenReady().then(() => {
    session
      .fromPartition("persist:chatgpt-browser")
      .on("will-download", (_event, item) => {
        if (browserDownloadPrompt) {
          item.setSaveDialogOptions({
            defaultPath: join(
              browserDownloadDirectory ?? app.getPath("downloads"),
              item.getFilename(),
            ),
          });
          return;
        }
        item.setSavePath(
          join(
            browserDownloadDirectory ?? app.getPath("downloads"),
            item.getFilename(),
          ),
        );
      });
  });
  ipcMain.handle(
    "native:clear-browser-data",
    async (_event, dataTypes: BrowserDataType[]) => {
      const browserSession = session.fromPartition("persist:chatgpt-browser");
      const selected = new Set(dataTypes);
      const storages: NonNullable<ClearStorageDataOptions["storages"]> = [];
      if (selected.has("cookies")) storages.push("cookies");
      if (selected.has("siteData")) {
        storages.push(
          "filesystem",
          "indexdb",
          "localstorage",
          "websql",
          "serviceworkers",
          "cachestorage",
        );
      }
      if (storages.length > 0)
        await browserSession.clearStorageData({ storages });
      if (selected.has("cache")) await browserSession.clearCache();
      if (selected.has("history") || selected.has("downloads")) {
        await browserSession.clearStorageData();
      }
    },
  );
  ipcMain.handle("native:install-update", async () => {
    if (!app.isPackaged) {
      await shell.openExternal("https://chatgpt.com/download/");
      return;
    }
    try {
      autoUpdater.quitAndInstall();
    } catch {
      await shell.openExternal("https://chatgpt.com/download/");
    }
  });
  ipcMain.handle("native:close-notification", (_event, id: string) => {
    nativeNotifications.get(id)?.close();
    nativeNotifications.delete(id);
  });
  ipcMain.handle(
    "native:show-notification",
    (_event, notification: NativeNotification) => {
      if (!Notification.isSupported()) return;
      nativeNotifications.get(notification.id)?.close();
      const nativeNotification = new Notification({
        body: notification.body,
        title: notification.title,
      });
      nativeNotifications.set(notification.id, nativeNotification);
      nativeNotification.on("click", showWindow);
      nativeNotification.on("close", () => {
        if (nativeNotifications.get(notification.id) === nativeNotification) {
          nativeNotifications.delete(notification.id);
        }
      });
      nativeNotification.show();
    },
  );
  ipcMain.handle(
    "native:set-pet-overlay",
    (_event, open: boolean, pet: string) => setPetOverlay(open, pet),
  );
  ipcMain.handle("native:set-prevent-sleep", (_event, enabled: boolean) => {
    if (enabled && powerSaveBlockerId === null) {
      powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    } else if (!enabled && powerSaveBlockerId !== null) {
      if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
      }
      powerSaveBlockerId = null;
    }
  });
  ipcMain.handle("native:set-menu-bar-visible", (_event, visible: boolean) => {
    if (!visible) {
      menuBarTray?.destroy();
      menuBarTray = null;
      return;
    }
    if (menuBarTray) return;
    const icon = nativeImage
      .createFromPath(join(app.getAppPath(), "resources", "icon.png"))
      .resize({ height: 18, width: 18 });
    if (process.platform === "darwin") icon.setTemplateImage(true);
    menuBarTray = new Tray(icon);
    menuBarTray.setToolTip("ChatGPT");
    menuBarTray.on("click", showWindow);
    menuBarTray.setContextMenu(
      Menu.buildFromTemplate([
        { click: showWindow, label: "Show ChatGPT" },
        { type: "separator" },
        { click: () => app.quit(), label: "Quit ChatGPT" },
      ]),
    );
  });
  ipcMain.handle(
    "native:set-browser-download-directory",
    (_event, path: string | null) => {
      browserDownloadDirectory = path;
    },
  );
  ipcMain.handle(
    "native:set-browser-download-prompt",
    (_event, enabled: boolean) => {
      browserDownloadPrompt = enabled;
    },
  );
  ipcMain.handle("native:select-folder", async () => {
    const owner = getWindow();
    const result = owner
      ? await dialog.showOpenDialog(owner, {
          properties: ["openDirectory", "createDirectory"],
        })
      : await dialog.showOpenDialog({
          properties: ["openDirectory", "createDirectory"],
        });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("native:select-files", async () => {
    const options = {
      filters: [
        {
          extensions: [
            "aac",
            "flac",
            "gif",
            "jpeg",
            "jpg",
            "m4a",
            "mp3",
            "png",
            "webp",
            "wav",
          ],
          name: "Images and audio",
        },
      ],
      properties: ["openFile", "multiSelections"] as (
        | "openFile"
        | "multiSelections"
      )[],
    };
    const owner = getWindow();
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    return result.filePaths.map((path) => ({
      kind: audioExtensions.has(extname(path).toLowerCase())
        ? ("audio" as const)
        : ("image" as const),
      name: basename(path),
      path,
    }));
  });
  ipcMain.handle("native:get-git-root", async (_event, cwd: string) => {
    if (!cwd || !isAbsolute(cwd)) return null;
    let candidate = resolve(cwd);
    while (true) {
      try {
        await stat(join(candidate, ".git"));
        return candidate;
      } catch {
        const parent = dirname(candidate);
        if (parent === candidate) return null;
        candidate = parent;
      }
    }
  });
  ipcMain.handle("native:open-external", async (_event, value: string) => {
    const url = new URL(value);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      throw new Error("Unsupported external link protocol");
    }
    await shell.openExternal(url.toString());
  });
  ipcMain.handle("native:open-config-file", async () => {
    const configPath = join(homedir(), ".codex", "config.toml");
    const error = await shell.openPath(configPath);
    if (error) throw new Error(error);
  });
  ipcMain.handle("native:read-agents-file", async () => {
    const path = join(homedir(), ".codex", "AGENTS.md");
    try {
      return { contents: await readFile(path, "utf8"), path };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { contents: "", path };
      }
      throw error;
    }
  });
  ipcMain.handle(
    "native:write-agents-file",
    async (_event, contents: string) => {
      const directory = join(homedir(), ".codex");
      const path = join(directory, "AGENTS.md");
      await mkdir(directory, { recursive: true });
      await writeFile(path, contents, "utf8");
      return { path };
    },
  );
  ipcMain.handle("native:reveal", (_event, path: string) =>
    shell.showItemInFolder(path),
  );
  ipcMain.handle("native:set-theme", (_event, theme: NativeTheme) => {
    setTheme(theme);
  });
  ipcMain.handle("native:list-skills", async (_event, cwd?: string) => {
    const roots = [
      join(homedir(), ".codex", "skills"),
      ...(cwd ? [join(cwd, ".codex", "skills")] : []),
    ];
    const names = new Set<string>();
    for (const root of roots) {
      try {
        for (const entry of await readdir(root, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith("."))
            names.add(entry.name);
        }
      } catch {
        // A missing optional skill root is an empty root.
      }
    }
    return [...names].sort();
  });
}
