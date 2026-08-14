import { describe, expect, it, vi } from "vitest";

import type { JsonObject, Thread, ThreadItem, Turn } from "../../shared/types";
import {
  applyTurnStreamDelta,
  createOptimisticTurn,
  failOptimisticTurn,
  mergeItems,
  mergeTurns,
} from "./threadStream";

function threadWith(turn: Turn): Thread {
  return {
    agentNickname: null,
    agentRole: null,
    cliVersion: "test",
    createdAt: 1,
    cwd: "/workspace",
    ephemeral: false,
    forkedFromId: null,
    gitInfo: null,
    id: "thread-1",
    modelProvider: "openai",
    name: null,
    parentThreadId: null,
    path: null,
    preview: "Prompt",
    recencyAt: 1,
    section: null,
    sectionEnteredAt: null,
    sessionId: "session-1",
    source: "appServer",
    status: { activeFlags: [], type: "active" },
    threadSource: null,
    turns: [turn],
    updatedAt: 1,
  };
}

function turn(items: ThreadItem[]): Turn {
  return {
    completedAt: null,
    durationMs: null,
    error: null,
    id: "turn-1",
    items,
    itemsView: "full",
    startedAt: 1,
    status: "inProgress",
  };
}

describe("thread stream state", () => {
  it("reconciles an optimistic prompt without making the message disappear", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    const optimistic = createOptimisticTurn([
      { text: "Keep this visible", text_elements: [], type: "text" },
    ]);
    const started = turn([
      {
        clientId: null,
        content: [
          { text: "Keep this visible", text_elements: [], type: "text" },
        ],
        id: "message-1",
        type: "userMessage",
      },
    ] as ThreadItem[]);

    expect(mergeTurns([optimistic], started)).toEqual([started]);
  });

  it("marks a locally accepted prompt as failed without removing its text", () => {
    const optimistic = createOptimisticTurn([
      { text: "Retry me", text_elements: [], type: "text" },
    ]);
    const failed = failOptimisticTurn(
      threadWith(optimistic),
      optimistic.id,
      "Authentication required",
    );

    expect(failed.turns[0]).toMatchObject({
      error: { message: "Authentication required" },
      items: optimistic.items,
      status: "failed",
    });
  });

  it("does not regress a completed turn when an older start snapshot arrives", () => {
    const completed = {
      ...turn([]),
      completedAt: 3,
      durationMs: 2_000,
      status: "completed",
    } as Turn;

    expect(mergeTurns([completed], turn([]))).toEqual([completed]);
  });

  it("merges lifecycle items and replaces only an optimistic user item", () => {
    const optimistic = createOptimisticTurn([]).items[0]!;
    const answer = {
      id: "answer-1",
      memoryCitation: null,
      phase: null,
      text: "Done",
      type: "agentMessage",
    } as ThreadItem;
    const user = {
      clientId: null,
      content: [],
      id: "message-1",
      type: "userMessage",
    } as ThreadItem;

    expect(mergeItems([optimistic, answer], [user])).toEqual([user, answer]);
  });

  it("applies text, thinking, plan, command, terminal, and patch streams", () => {
    const base = threadWith(
      turn([
        {
          aggregatedOutput: null,
          command: "pnpm test",
          commandActions: [],
          cwd: "/workspace",
          durationMs: null,
          exitCode: null,
          id: "command-1",
          pluginId: null,
          processId: null,
          scriptPath: null,
          source: "agent",
          status: "inProgress",
          type: "commandExecution",
        },
        {
          changes: [],
          id: "change-1",
          status: "inProgress",
          type: "fileChange",
        },
      ] as ThreadItem[]),
    );
    const events: Array<
      [Parameters<typeof applyTurnStreamDelta>[2], JsonObject]
    > = [
      ["item/agentMessage/delta", { delta: "Hello", itemId: "answer-1" }],
      [
        "item/reasoning/summaryPartAdded",
        { itemId: "reasoning-1", summaryIndex: 0 },
      ],
      [
        "item/reasoning/summaryTextDelta",
        { delta: "Planning", itemId: "reasoning-1", summaryIndex: 0 },
      ],
      [
        "item/reasoning/textDelta",
        { contentIndex: 0, delta: "Inspecting", itemId: "reasoning-1" },
      ],
      ["item/plan/delta", { delta: "1. Test", itemId: "plan-1" }],
      [
        "item/commandExecution/outputDelta",
        { delta: "PASS", itemId: "command-1" },
      ],
      [
        "item/commandExecution/terminalInteraction",
        { itemId: "command-1", stdin: "y\n" },
      ],
      [
        "item/fileChange/patchUpdated",
        {
          changes: [
            {
              diff: "@@ -1 +1 @@\n-old\n+new",
              kind: { move_path: null, type: "update" },
              path: "src/App.tsx",
            },
          ],
          itemId: "change-1",
        },
      ],
    ];
    const updated = events.reduce(
      (current, [method, params]) =>
        applyTurnStreamDelta(current, "turn-1", method, params),
      base,
    );

    expect(updated.turns[0]?.items).toEqual([
      expect.objectContaining({
        aggregatedOutput: "PASS\n> y\n",
        id: "command-1",
      }),
      expect.objectContaining({
        changes: [expect.objectContaining({ path: "src/App.tsx" })],
        id: "change-1",
      }),
      {
        id: "answer-1",
        memoryCitation: null,
        phase: null,
        text: "Hello",
        type: "agentMessage",
      },
      {
        content: ["Inspecting"],
        id: "reasoning-1",
        summary: ["Planning"],
        type: "reasoning",
      },
      { id: "plan-1", text: "1. Test", type: "plan" },
    ]);
  });
});
