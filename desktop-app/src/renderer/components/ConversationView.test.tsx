import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadItem } from "../../shared/types";
import { ToolItem } from "./ConversationView";

const onOpenChange = vi.fn();
const onOpenFile = vi.fn();

describe("ToolItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reveals reasoning as an inline transcript disclosure", () => {
    const item = {
      type: "reasoning",
      id: "reasoning-1",
      summary: ["Planning the change."],
      content: ["Checking the affected layout before editing."],
    } as ThreadItem;

    render(
      <ToolItem
        cwd="/workspace"
        item={item}
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
      />,
    );

    const disclosure = screen.getByRole("button", {
      name: "Thought briefly",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Planning the change.")).toBeVisible();
    expect(
      screen.getByText("Checking the affected layout before editing."),
    ).toBeVisible();
  });

  it("renders reasoning markdown once and opens file references", () => {
    const item = {
      type: "reasoning",
      id: "reasoning-markdown",
      summary: [
        "**Planning the change.**",
        "[Conversation view](src/renderer/components/ConversationView.tsx)",
        "`src/renderer/styles.css:42`",
        "Working from `origin/main`.",
        "**Planning the change.**",
      ],
      content: ["**Planning the change.**"],
    } as ThreadItem;

    const { container } = render(
      <ToolItem
        cwd="/workspace"
        item={item}
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Thought briefly" }));

    expect(screen.getAllByText("Planning the change.")).toHaveLength(1);
    expect(screen.getByText("Planning the change.").tagName).toBe("STRONG");
    expect(container).not.toHaveTextContent("**Planning the change.**");

    fireEvent.click(screen.getByRole("link", { name: /Conversation view/i }));
    expect(onOpenFile).toHaveBeenLastCalledWith(
      "src/renderer/components/ConversationView.tsx",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "src/renderer/styles.css:42" }),
    );
    expect(onOpenFile).toHaveBeenLastCalledWith("src/renderer/styles.css");
    expect(
      screen.queryByRole("button", { name: "origin/main" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("origin/main").tagName).toBe("CODE");
  });

  it("routes edited files to the change review instead of the text editor", () => {
    const item = {
      type: "fileChange",
      id: "change-1",
      status: "completed",
      changes: [
        {
          path: "src/App.tsx",
          kind: { type: "update", move_path: null },
          diff: "@@ -1 +1 @@\n-old\n+new",
        },
      ],
    } as ThreadItem;

    render(
      <ToolItem
        cwd="/workspace"
        item={item}
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Edited 1 file/ }));
    fireEvent.click(screen.getByRole("button", { name: /src\/App\.tsx/ }));

    expect(onOpenChange).toHaveBeenCalledWith("src/App.tsx");
    expect(onOpenFile).not.toHaveBeenCalled();
  });
});
