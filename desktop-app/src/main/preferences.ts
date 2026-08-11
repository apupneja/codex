import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { DesktopPreferences } from "../shared/types";

const DEFAULTS: DesktopPreferences = {
  approvalPolicy: "on-request",
  editorFontSize: 13,
  lastWorkspace: null,
  recentWorkspaces: [],
  rightPanelOpen: true,
  sandbox: "workspace-write",
  selectedEffort: "high",
  selectedModel: null,
  sidebarOpen: true,
  theme: "dark",
  uiFontSize: 13,
};

export class PreferencesStore {
  readonly #path: string;
  #value: DesktopPreferences = { ...DEFAULTS };
  #writeChain = Promise.resolve();

  constructor(userDataPath: string) {
    this.#path = join(userDataPath, "desktop-preferences.json");
  }

  async load(): Promise<DesktopPreferences> {
    let contents: string;
    try {
      contents = await readFile(this.#path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      return this.get();
    }
    try {
      const parsed = JSON.parse(contents) as Partial<DesktopPreferences>;
      this.#value = sanitizePreferences({ ...DEFAULTS, ...parsed });
    } catch {
      this.#value = { ...DEFAULTS };
    }
    return this.get();
  }

  get(): DesktopPreferences {
    return structuredClone(this.#value);
  }

  async update(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences> {
    this.#value = sanitizePreferences({ ...this.#value, ...patch });
    const snapshot = JSON.stringify(this.#value, null, 2);
    this.#writeChain = this.#writeChain.then(async () => {
      await mkdir(dirname(this.#path), { recursive: true });
      const temporary = `${this.#path}.tmp`;
      await writeFile(temporary, snapshot, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.#path);
    });
    await this.#writeChain;
    return this.get();
  }
}

export function sanitizePreferences(
  value: DesktopPreferences,
): DesktopPreferences {
  const recentWorkspaces = Array.isArray(value.recentWorkspaces)
    ? value.recentWorkspaces
    : DEFAULTS.recentWorkspaces;
  return {
    approvalPolicy: ["untrusted", "on-request", "never"].includes(
      value.approvalPolicy,
    )
      ? value.approvalPolicy
      : DEFAULTS.approvalPolicy,
    editorFontSize: Math.max(
      10,
      Math.min(24, Number(value.editorFontSize) || 13),
    ),
    lastWorkspace:
      typeof value.lastWorkspace === "string" &&
      value.lastWorkspace.length <= 32_768
        ? value.lastWorkspace
        : null,
    recentWorkspaces: Array.from(
      new Set(
        recentWorkspaces.filter(
          (entry) => typeof entry === "string" && entry.length <= 32_768,
        ),
      ),
    ).slice(0, 12),
    rightPanelOpen:
      typeof value.rightPanelOpen === "boolean"
        ? value.rightPanelOpen
        : DEFAULTS.rightPanelOpen,
    sandbox: ["read-only", "workspace-write", "danger-full-access"].includes(
      value.sandbox,
    )
      ? value.sandbox
      : DEFAULTS.sandbox,
    selectedEffort:
      typeof value.selectedEffort === "string" &&
      /^[a-z][a-z0-9_-]{0,63}$/i.test(value.selectedEffort)
        ? value.selectedEffort
        : DEFAULTS.selectedEffort,
    selectedModel:
      typeof value.selectedModel === "string" &&
      value.selectedModel.length <= 256
        ? value.selectedModel
        : null,
    sidebarOpen:
      typeof value.sidebarOpen === "boolean"
        ? value.sidebarOpen
        : DEFAULTS.sidebarOpen,
    theme: [
      "dark",
      "dark-high-contrast",
      "light",
      "light-colorblind",
      "system",
    ].includes(value.theme)
      ? value.theme
      : DEFAULTS.theme,
    uiFontSize: Math.max(10, Math.min(20, Number(value.uiFontSize) || 13)),
  };
}
