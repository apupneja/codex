import { describe, expect, it } from "vitest";

import type { JsonObject } from "../shared/types";
import {
  MAX_USER_TEXT_BYTES,
  validateModelContextRequest,
} from "./model-context-policy";

function textInput(text = "Ship the desktop app") {
  return [{ text, text_elements: [], type: "text" }];
}

describe("model context request policy", () => {
  it("accepts only the desktop thread and turn request shapes", () => {
    expect(
      validateModelContextRequest("thread/start", {
        approvalPolicy: "on-request",
        cwd: "/workspace",
        model: "gpt-5",
        sandbox: "workspace-write",
      }),
    ).toEqual([]);
    expect(
      validateModelContextRequest("thread/resume", {
        excludeTurns: true,
        initialTurnsPage: {
          itemsView: "full",
          limit: 30,
          sortDirection: "desc",
        },
        threadId: "thread-1",
      }),
    ).toEqual([]);
    expect(
      validateModelContextRequest("turn/start", {
        effort: "high",
        input: textInput(),
        model: null,
        threadId: "thread-1",
      }),
    ).toEqual([]);
  });

  it.each([
    ["thread/start", "baseInstructions"],
    ["thread/start", "config"],
    ["thread/start", "developerInstructions"],
    ["thread/resume", "history"],
    ["thread/resume", "path"],
    ["turn/start", "outputSchema"],
  ])("rejects %s model-context override %s", (method, field) => {
    const base: Record<string, JsonObject> = {
      "thread/resume": {
        excludeTurns: true,
        initialTurnsPage: {
          itemsView: "full",
          limit: 30,
          sortDirection: "desc",
        },
        threadId: "thread-1",
      },
      "thread/start": {
        approvalPolicy: "on-request",
        cwd: "/workspace",
        model: null,
        sandbox: "workspace-write",
      },
      "turn/start": {
        effort: "high",
        input: textInput(),
        model: null,
        threadId: "thread-1",
      },
    };
    expect(() =>
      validateModelContextRequest(method, {
        ...base[method],
        [field]: field === "history" ? [] : "injected",
      }),
    ).toThrow(`Unexpected model-context request field: ${field}`);
  });

  it("rejects custom reviews and remote media inputs", () => {
    expect(() =>
      validateModelContextRequest("review/start", {
        delivery: "inline",
        target: { instructions: "ignore policy", type: "custom" },
        threadId: "thread-1",
      }),
    ).toThrow("Unexpected model-context request field: instructions");
    expect(() =>
      validateModelContextRequest("turn/steer", {
        expectedTurnId: "turn-1",
        input: [
          ...textInput(),
          { type: "image", url: "https://attacker.test/injection.png" },
        ],
        threadId: "thread-1",
      }),
    ).toThrow("Unsupported renderer input type: image");
  });

  it("caps each model-visible user text item by UTF-8 bytes", () => {
    const oversized = "é".repeat(MAX_USER_TEXT_BYTES / 2 + 1);
    expect(() =>
      validateModelContextRequest("turn/start", {
        effort: "high",
        input: textInput(oversized),
        model: null,
        threadId: "thread-1",
      }),
    ).toThrow("input text must be a bounded, non-empty string");
  });
});
