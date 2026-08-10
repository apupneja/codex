import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { DesktopPreferences } from "../shared/types";
import { PreferencesStore, sanitizePreferences } from "./preferences";

describe("preferences", () => {
  it("bounds user-controlled values and removes duplicate recent workspaces", () => {
    const value = sanitizePreferences({
      approvalPolicy: "invalid",
      editorFontSize: 500,
      lastWorkspace: null,
      recentWorkspaces: ["/repo", "/repo", "/other"],
      rightPanelOpen: true,
      sandbox: "invalid",
      selectedEffort: "<invalid>",
      selectedModel: null,
      sidebarOpen: true,
      theme: "invalid",
    } as unknown as DesktopPreferences);

    expect(value).toMatchObject({
      approvalPolicy: "on-request",
      editorFontSize: 24,
      recentWorkspaces: ["/repo", "/other"],
      sandbox: "workspace-write",
      selectedEffort: "high",
      theme: "dark",
    });
  });

  it("persists updates atomically and returns defensive copies", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "codex-desktop-preferences-"),
    );
    const store = new PreferencesStore(directory);
    await store.load();
    const updated = await store.update({
      theme: "light",
      recentWorkspaces: ["/repo"],
    });
    updated.recentWorkspaces.push("/mutated");

    expect(store.get().recentWorkspaces).toEqual(["/repo"]);
    await expect(
      readFile(join(directory, "desktop-preferences.json"), "utf8").then(
        JSON.parse,
      ),
    ).resolves.toMatchObject({ theme: "light", recentWorkspaces: ["/repo"] });
  });

  it("recovers from a truncated preferences file", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "codex-desktop-preferences-"),
    );
    await writeFile(
      join(directory, "desktop-preferences.json"),
      '{"theme":',
      "utf8",
    );
    const store = new PreferencesStore(directory);

    await expect(store.load()).resolves.toMatchObject({
      approvalPolicy: "on-request",
      theme: "dark",
    });
  });
});
