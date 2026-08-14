import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ThreadItem } from "../../shared/types";
import type { PlanStep } from "../state/useCodexController";
import { ActiveTurnProgress } from "./ActiveTurnProgress";

const steps: PlanStep[] = [
  { status: "completed", step: "Inspect the existing conversation UI" },
  { status: "inProgress", step: "Implement the active progress surface" },
  { status: "pending", step: "Verify light and dark layouts" },
];

const items = [
  {
    changes: [
      {
        diff: "+first\n+second\n-old",
        kind: { type: "update" },
        path: "src/Conversation.tsx",
      },
      {
        diff: "+styles",
        kind: { type: "add" },
        path: "src/conversation.css",
      },
    ],
    id: "change-1",
    status: "completed",
    type: "fileChange",
  } as ThreadItem,
];

describe("ActiveTurnProgress", () => {
  it("shows current plan and file progress in a dismissible disclosure", () => {
    const { container } = render(
      <ActiveTurnProgress active items={items} steps={steps} />,
    );

    const trigger = screen.getByRole("button", {
      name: "Step 2 of 3, 2 files changed, 3 additions, 1 deletions",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "Task progress details" }),
    ).toBeVisible();
    expect(
      screen.getByText("Implement the active progress surface"),
    ).toBeVisible();
    expect(container.firstChild).toMatchSnapshot();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("only renders while an active turn has structured plan steps", () => {
    const { container, rerender } = render(
      <ActiveTurnProgress active={false} items={items} steps={steps} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<ActiveTurnProgress active items={items} steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
