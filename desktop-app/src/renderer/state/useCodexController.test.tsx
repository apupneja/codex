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
    openExternal: vi.fn().mockResolvedValue(undefined),
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
  it("keeps the submitted prompt visible when turn startup fails", async () => {
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

    expect(sent).toBe(true);
    await waitFor(() =>
      expect(result.current.activeThread?.turns[0]).toMatchObject({
        error: { message: "turn/start returned an invalid turn" },
        status: "failed",
      }),
    );
    expect(result.current.activeThread?.turns[0]?.items[0]).toMatchObject({
      content: [expect.objectContaining({ text: "Audit the workflow" })],
      type: "userMessage",
    });
    expect(result.current.view).toBe("thread");
    expect(result.current.toasts.at(-1)).toMatchObject({
      message: "Could not send prompt: turn/start returned an invalid turn",
      tone: "danger",
    });
  });

  it("renders the submitted message before turn/start responds", async () => {
    let resolveTurn: ((value: unknown) => void) | undefined;
    const request = vi.fn(async (method: string) => {
      if (method === "thread/start") return { thread: thread() };
      if (method === "turn/start") {
        return await new Promise((resolve) => {
          resolveTurn = resolve;
        });
      }
      throw new Error(`Unexpected request: ${method}`);
    });
    installDesktopApi(request);
    const { result } = renderHook(useCodexController);
    await waitFor(() =>
      expect(result.current.preferences.lastWorkspace).toBe(
        "/projects/workflow",
      ),
    );

    await act(async () => {
      expect(
        await result.current.submitPrompt({
          attachments: [],
          contexts: [],
          text: "Visible immediately",
        }),
      ).toBe(true);
    });

    expect(request).toHaveBeenCalledWith("thread/start", {
      approvalPolicy: "never",
      cwd: "/projects/workflow",
      model: "test-model",
      sandbox: "read-only",
    });
    expect(result.current.activeThread?.turns).toHaveLength(1);
    expect(result.current.activeThread?.turns[0]).toMatchObject({
      items: [
        expect.objectContaining({
          content: [expect.objectContaining({ text: "Visible immediately" })],
          type: "userMessage",
        }),
      ],
      status: "inProgress",
    });

    await act(async () => {
      resolveTurn?.({
        turn: turn("turn-1", "inProgress", "Visible immediately"),
      });
    });
    await waitFor(() =>
      expect(result.current.activeThread?.turns.map(({ id }) => id)).toEqual([
        "turn-1",
      ]),
    );
  });

  it("opens ChatGPT sign in instead of sending without credentials", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "thread/list") return { data: [], nextCursor: null };
      if (method === "model/list") return { data: [], nextCursor: null };
      if (method === "account/read") {
        return { account: null, requiresOpenaiAuth: true };
      }
      if (method === "account/login/start") {
        return {
          authUrl: "https://chatgpt.com/auth/codex",
          loginId: "login-1",
          type: "chatgpt",
        };
      }
      throw new Error(`Unexpected request: ${method}`);
    });
    const desktop = installDesktopApi(request);
    const { result } = renderHook(useCodexController);

    act(() => {
      desktop.emit({
        payload: { phase: "ready" },
        type: "runtime",
      });
    });
    await waitFor(() => expect(result.current.requiresAuth).toBe(true));

    await act(async () => {
      expect(
        await result.current.submitPrompt({
          attachments: [],
          contexts: [],
          text: "Do not send this unauthenticated",
        }),
      ).toBe(false);
    });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("account/login/start", {
        appBrand: "codex",
        type: "chatgpt",
        useHostedLoginSuccessPage: true,
      }),
    );
    expect(window.codexDesktop.openExternal).toHaveBeenCalledWith(
      "https://chatgpt.com/auth/codex",
    );
    expect(request).not.toHaveBeenCalledWith("thread/start", expect.anything());
  });

  it("turns a missing bearer response into a reauthentication state", () => {
    const desktop = installDesktopApi(vi.fn());
    const { result } = renderHook(useCodexController);

    act(() => {
      desktop.emit({
        payload: {
          method: "error",
          params: {
            message:
              "unexpected status 401 Unauthorized: Missing bearer or basic authentication in header",
          },
        } as never,
        type: "notification",
      });
    });

    expect(result.current.requiresAuth).toBe(true);
    expect(result.current.account).toBeNull();
    expect(result.current.toasts.at(-1)).toMatchObject({
      message: "Your Codex sign-in is missing or expired. Sign in again.",
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

  it("clears the previous turn plan as soon as a new turn starts", async () => {
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
    });
    act(() => {
      desktop.emit({
        payload: {
          method: "turn/plan/updated",
          params: {
            plan: [
              { status: "completed", step: "Inspect the workspace" },
              { status: "inProgress", step: "Implement the change" },
            ],
            threadId: "thread-1",
            turnId: "turn-1",
          },
        } as never,
        type: "notification",
      });
    });
    expect(result.current.plan).toEqual([
      { status: "completed", step: "Inspect the workspace" },
      { status: "inProgress", step: "Implement the change" },
    ]);

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
    await act(async () => {
      await result.current.submitPrompt({
        attachments: [],
        contexts: [],
        text: "Second prompt",
      });
    });

    expect(result.current.plan).toEqual([]);
  });
});
