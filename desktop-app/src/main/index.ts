import { app, ipcMain, nativeTheme, type BrowserWindow } from "electron";

import { AppHost } from "./app-host";
import { initializeDiagnostics, recordDiagnostic } from "./diagnostics";
import { registerNativeActions } from "./native-actions";
import { captureSmoke, createPrimaryWindow } from "./window";

let primaryWindow: BrowserWindow | null = null;
const host = new AppHost(() => primaryWindow);
const isMac = process.platform === "darwin";
const primaryWindowTitlebar = isMac
  ? ({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    } as const)
  : ({ titleBarOverlay: true, titleBarStyle: "hidden" } as const);

function showPrimaryWindow(): void {
  if (!primaryWindow) {
    primaryWindow = createPrimaryWindow(primaryWindowTitlebar);
    primaryWindow.on("closed", () => (primaryWindow = null));
  }
  if (primaryWindow.isMinimized()) primaryWindow.restore();
  primaryWindow.show();
  primaryWindow.focus();
}

host.register();
registerNativeActions(
  () => primaryWindow,
  (theme) => (nativeTheme.themeSource = theme),
  showPrimaryWindow,
);

app.setName("ChatGPT");

if (process.env.CODEX_DESKTOP_SMOKE_PATH) {
  app.commandLine.appendSwitch(
    "disable-features",
    "CalculateNativeWinOcclusion",
  );
}

app.whenReady().then(async () => {
  await initializeDiagnostics();
  const smokeTheme = process.env.CODEX_DESKTOP_SMOKE_THEME;
  if (smokeTheme === "light" || smokeTheme === "dark") {
    nativeTheme.themeSource = smokeTheme;
  }
  showPrimaryWindow();
});

process.on("uncaughtException", (error) => {
  recordDiagnostic("uncaughtException", error.stack ?? error.message);
});
process.on("unhandledRejection", (reason) => {
  recordDiagnostic("unhandledRejection", String(reason));
});

app.on("activate", () => {
  showPrimaryWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => host.close());

ipcMain.handle("app:ready", async () => {
  if (primaryWindow) await captureSmoke(primaryWindow);
});
