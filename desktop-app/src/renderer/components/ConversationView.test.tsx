import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadItem } from "../../shared/types";
import { ConversationTurnStatus } from "./ConversationTurnStatus";
import { ToolItem } from "./ToolItem";
import { UserMessage } from "./UserMessage";

const onOpenChange = vi.fn();
const onOpenFile = vi.fn();

describe("ToolItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows reasoning as an expanded inline transcript disclosure", () => {
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
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Planning the change.")).toBeVisible();
    expect(
      screen.getByText("Checking the affected layout before editing."),
    ).toBeVisible();

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Planning the change.")).not.toBeInTheDocument();
  });

  it("does not render an empty reasoning lifecycle item", () => {
    render(
      <ToolItem
        cwd="/workspace"
        item={
          {
            type: "reasoning",
            id: "reasoning-empty",
            summary: ["  "],
            content: [],
          } as ThreadItem
        }
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Thought briefly" }),
    ).not.toBeInTheDocument();
  });

  it("collapses only the selected reasoning trace", () => {
    render(
      <>
        <ToolItem
          cwd="/workspace"
          item={
            {
              type: "reasoning",
              id: "reasoning-1",
              summary: ["First trace"],
              content: [],
            } as ThreadItem
          }
          onOpenChange={onOpenChange}
          onOpenFile={onOpenFile}
        />
        <ToolItem
          cwd="/workspace"
          item={
            {
              type: "reasoning",
              id: "reasoning-2",
              summary: ["Second trace"],
              content: [],
            } as ThreadItem
          }
          onOpenChange={onOpenChange}
          onOpenFile={onOpenFile}
        />
      </>,
    );

    const disclosures = screen.getAllByRole("button", {
      name: "Thought briefly",
    });
    fireEvent.click(disclosures[0]!);

    expect(disclosures[0]).toHaveAttribute("aria-expanded", "false");
    expect(disclosures[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("First trace")).not.toBeInTheDocument();
    expect(screen.getByText("Second trace")).toBeVisible();
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

  it("shows streamed MCP progress while a tool call is active", () => {
    render(
      <ToolItem
        cwd="/workspace"
        item={
          {
            appContext: null,
            arguments: { query: "Codex" },
            durationMs: null,
            error: null,
            id: "mcp-1",
            pluginId: null,
            readOnlyHint: true,
            result: null,
            server: "search",
            status: "inProgress",
            tool: "query",
            type: "mcpToolCall",
          } as ThreadItem
        }
        onOpenChange={onOpenChange}
        onOpenFile={onOpenFile}
        progressMessages={["Searching", "Ranking results"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Calling/ }));
    expect(screen.getByText(/Ranking results/)).toBeVisible();
  });
});

describe("ConversationTurnStatus", () => {
  it("shows one quiet planning status until visible streamed content arrives", () => {
    const userMessage = {
      type: "userMessage",
      id: "message-1",
      clientId: null,
      content: [],
    } as ThreadItem;
    const { rerender } = render(
      <ConversationTurnStatus
        turn={{ durationMs: null, items: [userMessage], status: "inProgress" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Planning next moves");

    rerender(
      <ConversationTurnStatus
        turn={{
          durationMs: null,
          items: [
            userMessage,
            {
              aggregatedOutput: null,
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
            } as ThreadItem,
          ],
          status: "inProgress",
        }}
      >
        <div>Live command trace</div>
      </ConversationTurnStatus>,
    );

    expect(
      screen.getByRole("button", { name: /Running pnpm test/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Live command trace")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Running pnpm test/ }));
    expect(screen.getByText("Live command trace")).toBeVisible();

    rerender(
      <ConversationTurnStatus
        turn={{
          durationMs: null,
          items: [
            userMessage,
            {
              type: "reasoning",
              id: "reasoning-empty",
              summary: [],
              content: [],
            } as ThreadItem,
          ],
          status: "inProgress",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Planning next moves");

    rerender(
      <ConversationTurnStatus
        turn={{
          durationMs: null,
          items: [
            userMessage,
            {
              type: "agentMessage",
              id: "answer-1",
              phase: "final_answer",
              text: "Streaming answer",
            } as ThreadItem,
          ],
          status: "inProgress",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Writing response");

    rerender(
      <ConversationTurnStatus
        turn={{ durationMs: 2_400, items: [userMessage], status: "completed" }}
      />,
    );

    expect(screen.getByText("Worked for 2s")).toBeVisible();

    rerender(
      <ConversationTurnStatus
        turn={{ durationMs: 2_400, items: [userMessage], status: "failed" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Failed after 2s");
  });
});

describe("UserMessage", () => {
  it("renders structured and legacy context without leaking transport text", () => {
    const context = "A long source document";
    const request = "Find the ideal customer profile";
    const text = `${context}\n\n${request}`;
    const item = {
      type: "userMessage",
      id: "message-1",
      clientId: null,
      content: [
        {
          type: "text",
          text,
          text_elements: [
            {
              byteRange: { start: 0, end: context.length },
              placeholder: "A long source document",
            },
          ],
        },
      ],
    } as ThreadItem;

    render(
      <UserMessage
        item={item as Extract<ThreadItem, { type: "userMessage" }>}
        onOpenFile={onOpenFile}
      />,
    );

    expect(screen.getByText(request)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /A long source document/ }),
    ).toBeVisible();
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it("turns the legacy mentioned-files envelope into an attachment", () => {
    const item = {
      type: "userMessage",
      id: "message-2",
      clientId: null,
      content: [
        {
          type: "text",
          text: "# Files mentioned by the user:\n\n## screenshot.png:\n/tmp/screenshot.png\n\n## My request for Codex:\nFix the layout",
          text_elements: [],
        },
      ],
    } as ThreadItem;

    render(
      <UserMessage
        item={item as Extract<ThreadItem, { type: "userMessage" }>}
        onOpenFile={onOpenFile}
      />,
    );

    expect(screen.getByText("Fix the layout")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /screenshot.png/ }),
    ).toBeVisible();
    expect(
      screen.queryByText(/Files mentioned by the user/),
    ).not.toBeInTheDocument();
  });
});
