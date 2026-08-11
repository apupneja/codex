import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommandPalette } from "./CommandPalette";

function renderPalette(overrides: Record<string, unknown> = {}) {
  const props = {
    onClose: vi.fn(),
    onNewTask: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenRepository: vi.fn(),
    onPerformAppAction: vi.fn(),
    onResetAdViews: vi.fn(),
    onSelectThread: vi.fn(),
    onSetGrouping: vi.fn(),
    onSetModel: vi.fn(),
    onSetTheme: vi.fn(),
    onSetView: vi.fn(),
    onToggleWorkspace: vi.fn(),
    onUnavailable: vi.fn(),
    threads: [],
    workspace: null,
    workspaceVisible: false,
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

function searchFor(query: string): void {
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "Search agents, files, actions...",
    }),
    { target: { value: query } },
  );
}

describe("CommandPalette", () => {
  it("uses Cursor's Open IDE command for the collapsed workspace", () => {
    const props = renderPalette();
    searchFor("Open IDE");
    fireEvent.click(screen.getByRole("option", { name: /Open IDE/ }));
    expect(props.onToggleWorkspace).toHaveBeenCalledOnce();
  });

  it("runs the developer actions exposed by Cursor", () => {
    const props = renderPalette();
    searchFor("Toggle Developer Tools");
    fireEvent.click(
      screen.getByRole("option", { name: /Toggle Developer Tools/ }),
    );
    expect(props.onPerformAppAction).toHaveBeenCalledWith(
      "toggle-developer-tools",
    );
  });

  it("applies themes immediately", () => {
    const props = renderPalette();
    searchFor("Light Theme");
    fireEvent.click(screen.getByRole("option", { name: "Light Theme" }));
    expect(props.onSetTheme).toHaveBeenCalledWith("light");
  });

  it("changes the sidebar grouping", () => {
    const props = renderPalette();
    searchFor("Group by Status");
    fireEvent.click(screen.getByRole("option", { name: "Group by Status" }));
    expect(props.onSetGrouping).toHaveBeenCalledWith("status");
  });
});
