import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceOpenTarget } from "./WorkspaceOpenMenu";
import { WorkspaceTabs, type WorkspaceTab } from "./WorkspaceTabs";

function TabsHarness() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("files");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(["files"]);
  const open = (target: WorkspaceOpenTarget) => {
    setOpenTabs((current) =>
      current.includes(target) ? current : [...current, target],
    );
    setActiveTab(target);
  };
  return (
    <WorkspaceTabs
      activePath={null}
      activeTab={activeTab}
      documents={[]}
      focused={false}
      menuOpen={menuOpen}
      onActivateDocument={vi.fn()}
      onActivateTab={setActiveTab}
      onClose={vi.fn()}
      onCloseDocument={vi.fn()}
      onCloseTab={vi.fn()}
      onMenuOpenChange={setMenuOpen}
      onOpenTarget={open}
      onToggleFocused={vi.fn()}
      openTabs={openTabs}
    />
  );
}

describe("WorkspaceTabs", () => {
  it("keeps existing tabs when the launcher opens another tool", () => {
    render(<TabsHarness />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open workspace tool" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Terminal/ }));

    expect(screen.getByRole("button", { name: "Files" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Terminal" })).toBeVisible();
  });

  it("supports closing a tool tab from the keyboard", () => {
    const onCloseTab = vi.fn();
    render(
      <WorkspaceTabs
        activePath={null}
        activeTab="terminal"
        documents={[]}
        focused={false}
        menuOpen={false}
        onActivateDocument={vi.fn()}
        onActivateTab={vi.fn()}
        onClose={vi.fn()}
        onCloseDocument={vi.fn()}
        onCloseTab={onCloseTab}
        onMenuOpenChange={vi.fn()}
        onOpenTarget={vi.fn()}
        onToggleFocused={vi.fn()}
        openTabs={["files", "terminal"]}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Close Terminal tab" }),
      { key: "Enter" },
    );

    expect(onCloseTab).toHaveBeenCalledWith("terminal");
  });
});
