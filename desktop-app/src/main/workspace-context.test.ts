import { describe, expect, it } from "vitest";

import { withDesktopWorkspaceContext } from "./workspace-context";

describe("withDesktopWorkspaceContext", () => {
  it.each(["turn/start", "turn/steer"])(
    "adds trusted application context to %s without mutating renderer params",
    (method) => {
      const params = { input: [], threadId: "thread-1" };

      expect(withDesktopWorkspaceContext(method, params)).toEqual({
        ...params,
        additionalContext: {
          "codex-desktop.workspace": {
            kind: "application",
            value: expect.stringContaining(
              "selected working directory in <environment_context>",
            ),
          },
        },
      });
      expect(params).not.toHaveProperty("additionalContext");
    },
  );

  it("leaves unrelated requests unchanged", () => {
    const params = { threadId: "thread-1" };

    expect(withDesktopWorkspaceContext("thread/read", params)).toBe(params);
  });
});
