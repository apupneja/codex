import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ThreadItem } from "../../shared/types";
import { summarizeThreadChanges, ThreadChanges } from "./ThreadChanges";

const items = [
  {
    type: "fileChange",
    id: "patch-1",
    status: "completed",
    changes: [
      {
        path: "src/App.tsx",
        kind: { type: "update", move_path: null },
        diff: "@@ -1 +1 @@\n-old\n+new",
      },
      {
        path: "src/New.tsx",
        kind: { type: "add" },
        diff: "first\nsecond\n",
      },
    ],
  },
  {
    type: "fileChange",
    id: "patch-2",
    status: "completed",
    changes: [
      {
        path: "src/App.tsx",
        kind: { type: "update", move_path: null },
        diff: "@@ -1 +1 @@\n-before\n+after",
      },
    ],
  },
] as ThreadItem[];

describe("ThreadChanges", () => {
  it("keeps the latest change for each path and counts changed lines", () => {
    expect(summarizeThreadChanges(items)).toEqual([
      {
        path: "src/App.tsx",
        kind: { type: "update", move_path: null },
        diff: "@@ -1 +1 @@\n-before\n+after",
        additions: 1,
        deletions: 1,
      },
      {
        path: "src/New.tsx",
        kind: { type: "add" },
        diff: "first\nsecond\n",
        additions: 2,
        deletions: 0,
      },
    ]);
  });

  it("opens files and starts review from the changed-files tray", () => {
    const onOpenChange = vi.fn();
    const onReview = vi.fn();
    render(
      <ThreadChanges
        items={items}
        onOpenChange={onOpenChange}
        onReview={onReview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /App\.tsx/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(onOpenChange).toHaveBeenCalledWith("src/App.tsx");
    expect(onReview).toHaveBeenCalledOnce();
  });
});
