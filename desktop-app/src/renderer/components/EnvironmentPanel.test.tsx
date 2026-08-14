import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadItem } from "../../shared/types";
import {
  collectEnvironmentSources,
  EnvironmentPanel,
} from "./EnvironmentPanel";

const callbacks = {
  onAddSource: vi.fn(),
  onClose: vi.fn(),
  onCopyBranch: vi.fn(),
  onCreatePullRequest: vi.fn(),
  onOpenFile: vi.fn(),
  onOpenTerminal: vi.fn(),
  onShowChanges: vi.fn(),
  onToggleWorkspace: vi.fn(),
};

const items = [
  {
    id: "user-1",
    type: "userMessage",
    content: [
      {
        type: "text",
        text: "Reference context\n\nExplain it",
        text_elements: [
          {
            byteRange: { end: 17, start: 0 },
            placeholder: "Architecture notes",
          },
        ],
      },
      { type: "localImage", path: "/workspace/mockup.png" },
      { type: "skill", name: "UI guidance", path: "/workspace/SKILL.md" },
    ],
  },
  {
    id: "user-2",
    type: "userMessage",
    content: [
      {
        type: "text",
        text: [
          "# Files mentioned by the user:",
          "",
          "## reference.png:",
          "/workspace/reference.png",
          "",
          "## My request:",
          "Match this layout.",
        ].join("\n"),
        text_elements: [],
      },
    ],
  },
  {
    changes: [
      {
        diff: "@@ -1 +1 @@\n-old\n+new",
        kind: { move_path: null, type: "update" },
        path: "src/App.tsx",
      },
    ],
    id: "change-1",
    status: "completed",
    type: "fileChange",
  },
] as ThreadItem[];

describe("EnvironmentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects unique prompt sources from context, attachments, and envelopes", () => {
    expect(collectEnvironmentSources(items)).toEqual([
      {
        kind: "context",
        label: "Architecture notes",
        path: null,
      },
      {
        kind: "image",
        label: "mockup.png",
        path: "/workspace/mockup.png",
      },
      {
        kind: "file",
        label: "UI guidance",
        path: "/workspace/SKILL.md",
      },
      {
        kind: "file",
        label: "reference.png",
        path: "/workspace/reference.png",
      },
    ]);
  });

  it("renders live task data and routes every side-panel action", () => {
    const { asFragment } = render(
      <EnvironmentPanel
        branch="feature/environment"
        cwd="/workspace"
        deviceLabel="This Mac"
        items={items}
        mode="docked"
        {...callbacks}
        workspaceVisible
      />,
    );

    expect(screen.getByText("+1")).toBeVisible();
    expect(screen.getByText("−1")).toBeVisible();
    expect(screen.getByText("Hide")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /Changes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open terminal" }));
    fireEvent.click(
      screen.getByRole("button", { name: "feature/environment" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create pull request" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Picture in Picture/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    fireEvent.click(screen.getByRole("button", { name: "View all (4)" }));
    fireEvent.click(screen.getByRole("button", { name: /reference.png/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Environment actions" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide Environment" }));

    expect(callbacks.onShowChanges).toHaveBeenCalledOnce();
    expect(callbacks.onOpenTerminal).toHaveBeenCalledOnce();
    expect(callbacks.onCopyBranch).toHaveBeenCalledOnce();
    expect(callbacks.onCreatePullRequest).toHaveBeenCalledOnce();
    expect(callbacks.onToggleWorkspace).toHaveBeenCalledOnce();
    expect(callbacks.onAddSource).toHaveBeenCalledOnce();
    expect(callbacks.onOpenFile).toHaveBeenCalledWith(
      "/workspace/reference.png",
    );
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });

  it("renders as a dismissible side drawer when the chat lane is compact", () => {
    render(
      <EnvironmentPanel
        branch="feature/environment"
        cwd="/workspace"
        deviceLabel="This Mac"
        items={items}
        mode="drawer"
        {...callbacks}
        workspaceVisible={false}
      />,
    );

    const drawer = screen.getByRole("dialog", { name: "Environment" });
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).toHaveClass("environment-panel-drawer");
    expect(drawer.querySelector(".environment-panel-header")).toMatchSnapshot();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(callbacks.onClose).toHaveBeenCalledOnce();
  });
});
