import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { QueuedPrompt } from "../state/usePromptQueue";
import { PromptQueue } from "./PromptQueue";

const prompt: QueuedPrompt = {
  id: "queue-1",
  submission: {
    attachments: ["/tmp/reference.png"],
    contexts: [{ text: "Long source", title: "Reference" }],
    text: "Refine the implementation",
  },
};

describe("PromptQueue", () => {
  it("steers, removes, and exposes editing from the row menu", async () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    const onSteer = vi.fn().mockResolvedValue(true);
    render(
      <PromptQueue
        canSteer
        onEdit={onEdit}
        onRemove={onRemove}
        onSteer={onSteer}
        prompts={[prompt]}
      />,
    );

    expect(screen.getByLabelText("1 queued prompt")).toBeVisible();
    expect(screen.getByText("Refine the implementation")).toBeVisible();
    expect(screen.getByLabelText("1 context block")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Steer now: Refine the implementation",
      }),
    );
    await waitFor(() => expect(onSteer).toHaveBeenCalledWith("queue-1"));

    fireEvent.click(
      screen.getByRole("button", {
        name: "More options for queued prompt: Refine the implementation",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit prompt" }));
    expect(onEdit).toHaveBeenCalledWith(prompt);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove queued prompt: Refine the implementation",
      }),
    );
    expect(onRemove).toHaveBeenCalledWith("queue-1");
  });
});
