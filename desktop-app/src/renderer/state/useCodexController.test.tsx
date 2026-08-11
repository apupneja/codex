import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DesktopApi,
  DesktopEvent,
  DesktopPreferences,
  JsonObject,
  Thread,
  ThreadItem,
  Turn,
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
): { emit(event: DesktopEvent): void } {
  let eventListener: ((event: DesktopEvent) => void) | null = null;
  window.codexDesktop = {
    getPreferences: vi.fn().mockResolvedValue(preferences),
    onEvent: vi.fn((listener) => {
      eventListener = listener;
      return () => {
        eventListener = null;
      };
    }),
    request,
  } as unknown as DesktopApi;
  return {
    emit(event) {
      eventListener?.(event);
    },
  };
}

function turn(id: string, status: Turn["status"], text: string): Turn {
  return {
    completedAt: status === "inProgress" ? null : 1_700_000_002,
    durationMs: status === "inProgress" ? null : 2_000,
    error: null,
    id,
    items: [
      {
        clientId: null,
        content: [{ type: "text", text, text_elements: [] }],
        id: `${id}-user`,
        type: "userMessage",
      } as ThreadItem,
    ],
    itemsView: "full",
    startedAt: 1_700_000_000,
    status,
  };
}

function requestWithStreamingTurns() {
  let turnStarts = 0;
  return vi.fn(async (method: string) => {
    if (method === "thread/list") return { data: [], nextCursor: null };
    if (method === "model/list") return { data: [], nextCursor: null };
    if (method === "account/read") {
      return { account: null, requiresOpenaiAuth: false };
    }
    if (method === "thread/start") return { thread: thread() };
    if (method === "turn/start") {
      turnStarts += 1;
      return {
        turn: turn(
          `turn-${turnStarts}`,
          "inProgress",
          turnStarts === 1 ? "Initial prompt" : "Queued prompt",
        ),
      };
    }
    if (method === "turn/steer") return { turnId: "turn-1" };
    throw new Error(`Unexpected request: ${method}`);
  });
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
      sent = await result.current.submitPrompt({
        attachments: [],
        contexts: [],
        text: "Audit the workflow",
      });
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

  it("queues active-turn submissions until the user explicitly steers them", async () => {
    const request = requestWithStreamingTurns();
    installDesktopApi(request);
    const { result } = renderHook(useCodexController);
    await waitFor(() =>
      expect(result.current.preferences.lastWorkspace).toBe(
        "/projects/workflow",
      ),
    );

    await act(async () => {
      await result.current.submitPrompt({
        attachments: [],
        contexts: [],
        text: "Initial prompt",
      });
    });
    await act(async () => {
      await result.current.submitPrompt({
        attachments: [],
        contexts: [],
        text: "Queued prompt",
      });
    });

    expect(result.current.queuedPrompts).toHaveLength(1);
    expect(result.current.queuedPrompts[0]?.submission.text).toBe(
      "Queued prompt",
    );
    expect(
      request.mock.calls.filter(([method]) => method === "turn/start"),
    ).toHaveLength(1);
    expect(request).not.toHaveBeenCalledWith("turn/steer", expect.anything());

    await act(async () => {
      await result.current.steerQueuedPrompt(
        result.current.queuedPrompts[0]!.id,
      );
    });

    expect(request).toHaveBeenCalledWith("turn/steer", {
      expectedTurnId: "turn-1",
      input: [{ type: "text", text: "Queued prompt", text_elements: [] }],
      threadId: "thread-1",
    });
    expect(result.current.queuedPrompts).toHaveLength(0);
  });

  it("starts the next queued prompt when the active turn completes", async () => {
    const request = requestWithStreamingTurns();
    const desktop = installDesktopApi(request);
    const { result } = renderHook(useCodexController);
    await waitFor(() =>
      expect(result.current.preferences.lastWorkspace).toBe(
        "/projects/workflow",
      ),
    );

    await act(async () => {
      await result.current.submitPrompt({
        attachments: [],
        contexts: [],
        text: "Initial prompt",
      });
      await result.current.submitPrompt({
        attachments: [],
        contexts: [],
        text: "Queued prompt",
      });
    });
    expect(result.current.queuedPrompts).toHaveLength(1);

    act(() => {
      desktop.emit({
        payload: {
          method: "turn/completed",
          params: {
            threadId: "thread-1",
            turn: turn("turn-1", "completed", "Initial prompt"),
          },
        } as never,
        type: "notification",
      });
    });

    await waitFor(() =>
      expect(
        request.mock.calls.filter(([method]) => method === "turn/start"),
      ).toHaveLength(2),
    );
    await waitFor(() => expect(result.current.queuedPrompts).toHaveLength(0));
  });
});
