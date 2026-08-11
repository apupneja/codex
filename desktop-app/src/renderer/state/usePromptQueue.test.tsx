import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePromptQueue } from "./usePromptQueue";

describe("usePromptQueue", () => {
  it("keeps FIFO queues isolated by task and returns editable copies", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const { result } = renderHook(usePromptQueue);
    const first = {
      attachments: ["/tmp/reference.png"],
      contexts: [{ text: "Source", title: "Reference" }],
      text: "First prompt",
    };

    act(() => {
      result.current.enqueue("thread-1", first);
      result.current.enqueue("thread-2", {
        attachments: [],
        contexts: [],
        text: "Other task",
      });
    });
    first.attachments.length = 0;
    first.contexts[0]!.title = "Changed outside the queue";

    expect(result.current.queues).toEqual({
      "thread-1": [
        {
          id: "00000000-0000-4000-8000-000000000001",
          submission: {
            attachments: ["/tmp/reference.png"],
            contexts: [{ text: "Source", title: "Reference" }],
            text: "First prompt",
          },
        },
      ],
      "thread-2": [
        {
          id: "00000000-0000-4000-8000-000000000002",
          submission: {
            attachments: [],
            contexts: [],
            text: "Other task",
          },
        },
      ],
    });
    expect(
      result.current.find("thread-1", "00000000-0000-4000-8000-000000000001")
        ?.submission.text,
    ).toBe("First prompt");

    act(() =>
      result.current.remove("thread-1", "00000000-0000-4000-8000-000000000001"),
    );
    expect(result.current.queues).not.toHaveProperty("thread-1");
    expect(result.current.queues["thread-2"]).toHaveLength(1);
  });
});
