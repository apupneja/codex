import type { BrowserWindow } from "electron";
import { describe, expect, it, vi } from "vitest";

import {
  confirmDiscardChanges,
  type MessageBoxPresenter,
} from "./native-dialogs";

describe("confirmDiscardChanges", () => {
  it("uses the Codex icon and keeps the destructive action opt-in", async () => {
    const window = {} as BrowserWindow;
    const presenter: MessageBoxPresenter = {
      showMessageBox: vi.fn().mockResolvedValue({
        checkboxChecked: false,
        response: 1,
      }),
    };

    await expect(
      confirmDiscardChanges(presenter, window, {
        cancelLabel: "Cancel",
        detail: "/workspace/app.json",
        iconPath: "/resources/codex.png",
      }),
    ).resolves.toBe(true);
    expect(presenter.showMessageBox).toHaveBeenCalledWith(window, {
      buttons: ["Cancel", "Discard Changes"],
      cancelId: 0,
      defaultId: 0,
      detail: "/workspace/app.json",
      icon: "/resources/codex.png",
      message: "Discard unsaved changes?",
      noLink: true,
      type: "none",
    });
  });

  it("preserves the document when the dialog is cancelled", async () => {
    const presenter: MessageBoxPresenter = {
      showMessageBox: vi.fn().mockResolvedValue({
        checkboxChecked: false,
        response: 0,
      }),
    };

    await expect(
      confirmDiscardChanges(presenter, {} as BrowserWindow, {
        cancelLabel: "Keep Editing",
        detail: "Unsaved editor buffers will be lost.",
        iconPath: "/resources/codex.png",
      }),
    ).resolves.toBe(false);
  });
});
