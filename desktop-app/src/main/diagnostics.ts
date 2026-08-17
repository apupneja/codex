import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { app } from "electron";

let logPath: string | null = null;

export async function initializeDiagnostics(): Promise<void> {
  app.setAppLogsPath();
  const directory = app.getPath("logs");
  await mkdir(directory, { recursive: true });
  logPath = join(directory, "desktop.log");
}

export function recordDiagnostic(source: string, message: string): void {
  if (!logPath) return;
  const line = `${new Date().toISOString()} [${source}] ${message.trimEnd()}\n`;
  void appendFile(logPath, line, "utf8").catch(() => undefined);
}
