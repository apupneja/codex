import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Thread } from "../../shared/types";
import { Sidebar } from "./Sidebar";

function thread(overrides: Partial<Thread>): Thread {
  return {
    cliVersion: "test",
    createdAt: 1_700_000_000,
    cwd: "/projects/signal-arena",
    ephemeral: false,
    forkedFromId: null,
    gitInfo: null,
    id: "thread-1",
    modelProvider: "openai",
    name: "Google search for ChatGPT",
    parentThreadId: null,
    path: null,
    preview: "Search task",
    recencyAt: 1_700_000_000,
    section: null,
    sectionEnteredAt: null,
    sessionId: "session-1",
    source: "appServer",
    status: { type: "idle" },
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    turns: [],
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

function renderSidebar(
  threads: Thread[],
  recentWorkspaces = ["/projects/signal-arena", "/projects/intusent-site"],
  onNewTaskInWorkspace = vi.fn(),
) {
  return render(
    <Sidebar
      account={null}
      activeThread={threads[0] ?? null}
      grouping="repository"
      hasMoreThreads={false}
      onArchive={vi.fn()}
      onChooseWorkspace={vi.fn()}
      onLoadMore={vi.fn()}
      onNewTask={vi.fn()}
      onNewTaskInWorkspace={onNewTaskInWorkspace}
      onSearch={vi.fn()}
      onSelectThread={vi.fn()}
      onSetGrouping={vi.fn()}
      onSetView={vi.fn()}
      onToggle={vi.fn()}
      recentWorkspaces={recentWorkspaces}
      threads={threads}
      view="thread"
    />,
  );
}

describe("Sidebar repositories", () => {
  it("shows tasks grouped under repositories and keeps empty repositories visible", () => {
    renderSidebar([
      thread({ id: "thread-1" }),
      thread({ id: "thread-2", name: "Project overview" }),
    ]);

    const signalArena = screen
      .getByRole("button", { name: "signal-arena" })
      .closest("section");
    const intusentSite = screen
      .getByRole("button", { name: "intusent-site" })
      .closest("section");

    expect(signalArena).not.toBeNull();
    expect(
      within(signalArena!).getByText("Google search for ChatGPT"),
    ).toBeVisible();
    expect(within(signalArena!).getByText("Project overview")).toBeVisible();
    expect(within(intusentSite!).getByText("No agents yet")).toBeVisible();
  });

  it("filters repository groups and task titles from the sidebar control", () => {
    renderSidebar([
      thread({ id: "thread-1" }),
      thread({ id: "thread-2", name: "Project overview" }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Filter and group repositories" }),
    );
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Filter repositories and tasks",
      }),
      { target: { value: "intusent" } },
    );

    expect(
      screen.queryByText("Google search for ChatGPT"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "intusent-site" })).toBeVisible();
    expect(screen.getByText("No agents yet")).toBeVisible();
  });

  it("groups workspaces that share a Git origin into one repository", () => {
    renderSidebar(
      [
        thread({
          cwd: "/worktrees/signal-arena/feature-a",
          gitInfo: {
            branch: "feature-a",
            originUrl: "git@github.com:openai/signal-arena.git",
            sha: "abc",
          },
          id: "thread-1",
        }),
        thread({
          cwd: "/worktrees/signal-arena/feature-b",
          gitInfo: {
            branch: "feature-b",
            originUrl: "https://github.com/openai/signal-arena.git",
            sha: "def",
          },
          id: "thread-2",
          name: "Project overview",
        }),
      ],
      ["/projects/signal-arena"],
    );

    expect(
      screen.getAllByRole("button", { name: "signal-arena" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "New chat in signal-arena" }),
    ).toBeVisible();
  });

  it("starts a new chat in the selected repository", () => {
    const onNewTaskInWorkspace = vi.fn();
    renderSidebar([], ["/projects/signal-arena"], onNewTaskInWorkspace);

    fireEvent.click(
      screen.getByRole("button", { name: "New chat in signal-arena" }),
    );

    expect(onNewTaskInWorkspace).toHaveBeenCalledWith("/projects/signal-arena");
  });

  it("does not expose internal transport text as a task title", () => {
    renderSidebar([
      thread({
        name: "<system_instruction>You are an internal agent",
        preview: "Build the production dashboard",
      }),
    ]);

    expect(screen.getByText("Build the production dashboard")).toBeVisible();
    expect(screen.queryByText(/system_instruction/i)).not.toBeInTheDocument();
  });
});
