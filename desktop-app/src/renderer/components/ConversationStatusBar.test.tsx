import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationStatusBar } from "./ConversationStatusBar";

describe("ConversationStatusBar", () => {
  it("exposes the complete branch, environment, and context labels", () => {
    const { container, rerender } = render(
      <ConversationStatusBar
        active={false}
        branchLabel="apupneja/ui-live-arenas-title"
        deviceLabel="This Mac"
        tokenPercent={16}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Branch apupneja/ui-live-arenas-title",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "This Mac environment" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Context 16%")).toHaveStyle(
      "background: conic-gradient(var(--addition) 16%, var(--border-strong) 0)",
    );

    rerender(
      <ConversationStatusBar
        active
        branchLabel="apupneja/ui-live-arenas-title"
        deviceLabel="This Mac"
        tokenPercent={16}
      />,
    );

    expect(screen.getByLabelText("Agent working. Context 16%")).toBeVisible();
    expect(container.querySelector(".context-ring-spinner")).toBeVisible();
  });
});
