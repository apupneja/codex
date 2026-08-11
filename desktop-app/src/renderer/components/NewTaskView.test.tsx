import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DesktopPreferences } from "../../shared/types";
import type { CodexController } from "../state/useCodexController";
import { NewTaskView } from "./NewTaskView";

vi.mock("./Composer", () => ({
  Composer: () => <div data-testid="composer" />,
}));

const preferences: DesktopPreferences = {
  approvalPolicy: "on-request",
  editorFontSize: 13,
  lastWorkspace: "/projects/alpha",
  recentWorkspaces: ["/projects/alpha", "/projects/beta"],
  rightPanelOpen: true,
  sandbox: "workspace-write",
  selectedEffort: "high",
  selectedModel: "gpt-test",
  sidebarOpen: true,
  theme: "dark",
  uiFontSize: 13,
};

function controller(overrides: Partial<CodexController> = {}) {
  return {
    activeThread: null,
    addToast: vi.fn(),
    chooseWorkspace: vi.fn(),
    interrupt: vi.fn(),
    models: [],
    preferences,
    runtime: { phase: "ready" },
    selectWorkspace: vi.fn(),
    submitPrompt: vi.fn(),
    threads: [],
    updatePreferences: vi.fn(),
    ...overrides,
  } as unknown as CodexController;
}

describe("NewTaskView", () => {
  it("opens a recent directory in the app", () => {
    const selectWorkspace = vi.fn();

    render(
      <NewTaskView
        controller={controller({ selectWorkspace })}
        onToggleWorkspace={vi.fn()}
      />,
    );

    const workspaceButton = screen.getByRole("button", { name: "alpha" });
    fireEvent.click(workspaceButton);
    fireEvent.blur(workspaceButton.parentElement!, { relatedTarget: null });
    fireEvent.click(
      screen.getByRole("button", { name: "Open /projects/beta" }),
    );

    expect(selectWorkspace).toHaveBeenCalledWith("/projects/beta");
  });

  it("opens the native directory picker from the local repository source", () => {
    const chooseWorkspace = vi.fn();

    render(
      <NewTaskView
        controller={controller({ chooseWorkspace })}
        onToggleWorkspace={vi.fn()}
      />,
    );

    const workspaceButton = screen.getByRole("button", { name: "alpha" });
    fireEvent.click(workspaceButton);
    fireEvent.blur(workspaceButton.parentElement!, { relatedTarget: null });
    fireEvent.click(screen.getByRole("button", { name: "On This Mac" }));

    expect(chooseWorkspace).toHaveBeenCalledOnce();
  });

  it("filters recent repositories by path", () => {
    render(
      <NewTaskView controller={controller()} onToggleWorkspace={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "alpha" }));
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Search folders and repositories",
      }),
      { target: { value: "beta" } },
    );

    expect(
      screen.getByRole("button", { name: "Open /projects/beta" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Open /projects/alpha" }),
    ).not.toBeInTheDocument();
  });

  it("closes the repository picker with Escape", () => {
    render(
      <NewTaskView controller={controller()} onToggleWorkspace={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "alpha" }));
    fireEvent.keyDown(
      screen.getByRole("dialog", { name: "Choose repository" }),
      { key: "Escape" },
    );

    expect(
      screen.queryByRole("dialog", { name: "Choose repository" }),
    ).not.toBeInTheDocument();
  });
});
