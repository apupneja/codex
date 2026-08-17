import { ipcMain, type BrowserWindow } from "electron";

import type { JsonValue } from "../shared/protocol";
import { AppServerConnection } from "./app-server/client";

export class AppHost {
  readonly connection = new AppServerConnection();

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  register(): void {
    this.connection.on("event", (event) => {
      this.getWindow()?.webContents.send("host:event", event);
    });
    ipcMain.handle(
      "host:request",
      (_event, method: string, params?: Record<string, unknown>) =>
        this.connection.request(method, params),
    );
    ipcMain.on(
      "host:answer",
      (_event, id: string | number, result: JsonValue) =>
        this.connection.answer(id, result),
    );
  }

  close(): void {
    this.connection.close();
  }
}
