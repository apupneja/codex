import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadItem } from "../../shared/types";
import { ChangeReviewPanel } from "./ChangeReviewPanel";

const items = [
  {
    type: "fileChange",
    id: "change-1",
    status: "completed",
    changes: [
      {
        path: "src/App.tsx",
        kind: { type: "update", move_path: null },
        diff: "@@ -1 +1 @@\n-old\n+new",
      },
      {
        path: "src/New.tsx",
        kind: { type: "add", move_path: null },
        diff: "+first\n+second",
      },
    ],
  },
] as ThreadItem[];

describe("ChangeReviewPanel", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders file cards and focuses the change selected from the transcript", () => {
    const { container } = render(
      <ChangeReviewPanel
        branch="feature/layout"
        diff=""
        items={items}
        selectedPath="src/App.tsx"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "2 Files Changed" }),
    ).toBeVisible();
    expect(
      container.querySelector(".change-review-card.selected"),
    ).toHaveTextContent("src/App.tsx");
    expect(screen.getByText("-old")).toBeVisible();
    expect(screen.getByText("+new")).toBeVisible();
  });

  it("collapses and expands individual diff cards", () => {
    render(
      <ChangeReviewPanel
        branch="feature/layout"
        diff=""
        items={items}
        selectedPath={null}
      />,
    );

    const disclosure = screen.getByRole("button", {
      name: "Collapse App.tsx",
    });
    fireEvent.click(disclosure);

    expect(
      screen.getByRole("button", { name: "Expand App.tsx" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("-old")).not.toBeInTheDocument();
  });
});
