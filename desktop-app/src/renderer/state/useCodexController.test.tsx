import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DesktopApi,
  DesktopPreferences,
  JsonObject,
  Thread,
} from "../../shared/types";
import { useCodexController } from "./useCodexController";

const preferences: DesktopPreferences = {
  approvalPolicy: "never",
  editorFontSize: 13,
  lastWorkspace: "/projects/workflow",
  recentWorkspaces: ["/projects/workflow"],
  rightPanelOpen: true,
  sandbox: "read-only",
  selectedEffort: "low",
  selectedModel: "test-model",
  sidebarOpen: true,
  theme: "dark",
  uiFontSize: 13,
};

function thread(): Thread {
  return {
    agentNickname: null,
    agentRole: null,
    cliVersion: "test",
    createdAt: 1_700_000_000,
    cwd: "/projects/workflow",
    ephemeral: false,
    forkedFromId: null,
    gitInfo: null,
    id: "thread-1",
    modelProvider: "openai",
    name: null,
    parentThreadId: null,
    path: null,
    preview: "Audit the workflow",
    recencyAt: 1_700_000_000,
    section: null,
    sectionEnteredAt: null,
    sessionId: "session-1",
    source: "appServer",
    status: { type: "idle" },
    threadSource: null,
    turns: [],
    updatedAt: 1_700_000_000,
  };
}

function installDesktopApi(
  request: (method: string, params?: JsonObject) => Promise<unknown>,
): void {
  window.codexDesktop = {
    getPreferences: vi.fn().mockResolvedValue(preferences),
    onEvent: vi.fn(() => () => undefined),
    request,
  } as unknown as DesktopApi;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCodexController prompt submission", () => {
  it("rejects a malformed turn response without crashing React state", async () => {
    installDesktopApi(
      vi.fn(async (method) => {
        if (method === "thread/start") return { thread: thread() };
        if (method === "turn/start") return {};
        throw new Error(`Unexpected request: ${method}`);
      }),
    );
    const { result } = renderHook(useCodexController);
    await waitFor(() =>
      expect(result.current.preferences.lastWorkspace).toBe(
        "/projects/workflow",
      ),
    );

    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.submitPrompt("Audit the workflow");
    });

    expect(sent).toBe(false);
    expect(result.current.activeThread).toMatchObject({
      id: "thread-1",
      turns: [],
    });
    expect(result.current.view).toBe("new");
    expect(result.current.toasts.at(-1)).toMatchObject({
      message: "Could not send prompt: turn/start returned an invalid turn",
      tone: "danger",
    });
  });
});
