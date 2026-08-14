import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Thread, ThreadItem, Turn } from "../../shared/types";
import type { CodexController } from "../state/useCodexController";
import { ConversationTurn } from "./ConversationTurn";

const onOpenChange = vi.fn();
const onOpenFile = vi.fn();

const userMessage = {
  clientId: null,
  content: [{ text: "Explain the change", text_elements: [], type: "text" }],
  id: "user-1",
  type: "userMessage",
} as ThreadItem;

function answer(text: string): ThreadItem {
  return {
    id: "answer-1",
    memoryCitation: null,
    phase: "final_answer",
    text,
    type: "agentMessage",
  } as ThreadItem;
}

function turn(
  status: Turn["status"],
  items: ThreadItem[],
  durationMs: number | null = null,
): Turn {
  return {
    completedAt: status === "inProgress" ? null : 2,
    durationMs,
    error: null,
    id: "turn-1",
    items,
    itemsView: "full",
    startedAt: null,
    status,
  };
}

function controller() {
  return {
    activeThread: { cwd: "/workspace" } as Thread,
    addToast: vi.fn(),
    itemProgress: {},
  } satisfies Pick<
    CodexController,
    "activeThread" | "addToast" | "itemProgress"
  >;
}

function renderTurn(value: Turn) {
  return render(
    <ConversationTurn
      controller={controller()}
      onOpenChange={onOpenChange}
      onOpenFile={onOpenFile}
      turn={value}
    />,
  );
}

function activityForSnapshot(container: HTMLElement): HTMLElement | null {
  const activity = container
    .querySelector<HTMLElement>(".turn-activity")
    ?.cloneNode(true) as HTMLElement | undefined;
  const detail = activity?.querySelector<HTMLElement>(".turn-activity-detail");
  const disclosure = activity?.querySelector<HTMLElement>("[aria-controls]");
  if (detail && disclosure) {
    detail.id = "turn-activity-detail";
    disclosure.setAttribute("aria-controls", detail.id);
  }
  return activity ?? null;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("ConversationTurn", () => {
  it("shows a live command state without premature completion controls", () => {
    const { container } = renderTurn(
      turn("inProgress", [
        userMessage,
        {
          aggregatedOutput: null,
          command: "rg ConversationTurn src/renderer",
          commandActions: [
            {
              command: "rg ConversationTurn src/renderer",
              path: "src/renderer",
              query: "ConversationTurn",
              type: "search",
            },
          ],
          cwd: "/workspace",
          durationMs: null,
          exitCode: null,
          id: "command-1",
          pluginId: null,
          processId: "process-1",
          scriptPath: null,
          source: "agent",
          status: "inProgress",
          type: "commandExecution",
        } as ThreadItem,
      ]),
    );

    expect(
      screen.getByRole("button", {
        name: /Searching “ConversationTurn” in src\/renderer/,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Helpful response")).not.toBeInTheDocument();
    expect(screen.queryByText(/Worked/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Searching “ConversationTurn” in src\/renderer/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Running rg ConversationTurn src\/renderer/,
      }),
    );
    expect(screen.getByText("Processing")).toBeVisible();
    expect(screen.getByText("Waiting for command output…")).toBeVisible();
    expect(activityForSnapshot(container)).toMatchSnapshot();
  });

  it("waits for smoothed writing before showing reactions and worked time", () => {
    vi.useFakeTimers();
    const { rerender } = renderTurn(
      turn("inProgress", [userMessage, answer("Writing a")]),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Writing response");
    expect(screen.queryByLabelText("Helpful response")).not.toBeInTheDocument();

    const completed = turn(
      "completed",
      [userMessage, answer("Writing a smoother response is now complete.")],
      2_400,
    );
    rerender(
      <ConversationTurn
        controller={controller()}
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
        turn={completed}
      />,
    );

    expect(
      screen.queryByText("Writing a smoother response is now complete."),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Helpful response")).not.toBeInTheDocument();
    expect(screen.queryByText("Worked for 2s")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));

    expect(
      screen.getByText("Writing a smoother response is now complete."),
    ).toBeVisible();
    const worked = screen.getByText("Worked for 2s");
    const footer = worked.closest(".turn-activity-header");
    expect(footer).not.toBeNull();
    expect(worked).toBeVisible();
    expect(
      within(footer as HTMLElement).getByLabelText("Helpful response"),
    ).toBeVisible();
  });

  it("automatically compresses live activity when the turn finishes", () => {
    const runningCommand = {
      aggregatedOutput: "Checking packages\n",
      command: "pnpm test",
      commandActions: [],
      cwd: "/workspace",
      durationMs: null,
      exitCode: null,
      id: "command-1",
      pluginId: null,
      processId: "process-1",
      scriptPath: null,
      source: "agent",
      status: "inProgress",
      type: "commandExecution",
    } as ThreadItem;
    const { rerender } = renderTurn(
      turn("inProgress", [userMessage, runningCommand]),
    );

    expect(
      screen.getByRole("button", { name: /Running pnpm test/ }),
    ).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /Running pnpm test/ }));
    expect(screen.getByText("Running")).toBeVisible();

    rerender(
      <ConversationTurn
        controller={controller()}
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
        turn={turn(
          "completed",
          [
            userMessage,
            {
              ...runningCommand,
              durationMs: 1_200,
              exitCode: 0,
              status: "completed",
            } as ThreadItem,
          ],
          1_800,
        )}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Worked for 2s/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Ran")).not.toBeInTheDocument();
  });

  it("compresses the completed trace into the worked disclosure", () => {
    const { container } = renderTurn(
      turn(
        "completed",
        [
          userMessage,
          {
            content: ["Checked the renderer lifecycle."],
            id: "reasoning-1",
            summary: ["Planning the rendering change."],
            type: "reasoning",
          } as ThreadItem,
          {
            aggregatedOutput: "4 tests passed\n",
            command: "pnpm test",
            commandActions: [],
            cwd: "/workspace",
            durationMs: 810,
            exitCode: 0,
            id: "command-1",
            pluginId: null,
            processId: "process-1",
            scriptPath: null,
            source: "agent",
            status: "completed",
            type: "commandExecution",
          } as ThreadItem,
          answer("The rendering lifecycle is fixed."),
        ],
        3_200,
      ),
    );

    const disclosure = screen.getByRole("button", {
      name: /Worked for 3s/,
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Thought briefly")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Helpful response")).toBeVisible();

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Thought briefly")).toBeVisible();
    expect(screen.getByText("Ran")).toBeVisible();
    expect(activityForSnapshot(container)).toMatchSnapshot();
  });
});
