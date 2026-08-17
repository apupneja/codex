import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { TurnView } from "./TurnView";

test("matches the shipped main-chat message hierarchy", () => {
  const { container } = render(
    <TurnView
      onContinue={vi.fn()}
      onEditMessage={vi.fn()}
      turn={{
        id: "turn-main-chat",
        items: [
          {
            id: "user-main-chat",
            text: "[LinkedIn](https://www.linkedin.com/in/example/)",
            type: "userMessage",
          },
          {
            id: "commentary-one",
            phase: "commentary",
            text: "I’ll review the profile and corroborate it with public sources.",
            type: "agentMessage",
          },
          {
            appContext: { appName: "node_repl" },
            id: "tool-one",
            type: "mcpToolCall",
          },
          {
            appContext: { appName: "node_repl" },
            id: "tool-two",
            type: "mcpToolCall",
          },
          { id: "search-one", type: "webSearch" },
          {
            id: "commentary-two",
            phase: "commentary",
            text: "The profile points to two consistent tracks.",
            type: "agentMessage",
          },
          {
            id: "final-answer",
            phase: "finalAnswer",
            text: [
              "The work spans **AI and scientific innovation**.",
              "",
              "- **Scientific R&D:** Reworked research workflows.",
              "- **Enterprise AI:** Expanded practical adoption.",
            ].join("\n"),
            type: "agentMessage",
          },
        ],
        status: "completed",
      }}
    />,
  );

  expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/example/",
  );
  expect(
    screen.getByText("Used node_repl integration and searched the web"),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(1);
  expect(container.firstChild).toMatchSnapshot();
});

test("matches the shipped activity, work-status, and Markdown table anatomy", () => {
  const writeText = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const tableSource = [
    "| Rank | Project | Best fit |",
    "| --- | --- | --- |",
    "| 1 | [AnythingLLM](https://anythingllm.com/) | Best overall for chatting with private documents |",
    "| 2 | [Onyx](https://onyx.app/) | Best for an organization-wide knowledge base |",
    "| 3 | [RAGFlow](https://ragflow.io/) | Best for complex PDFs, scans, tables, slides, and citations |",
    "| 4 | [Dify](https://dify.ai/) | Best for custom apps and workflows around a knowledge base |",
    "| 5 | [Open WebUI](https://openwebui.com/) | Good general chat UI, but documents are less central |",
  ].join("\n");
  const tableMarkdown = [
    "Then I’d change the recommendation:",
    "",
    tableSource,
    "",
    "My default choice would be **AnythingLLM**. citeturn4view3turn5search7turn8view1",
  ].join("\n");
  const { container } = render(
    <TurnView
      onContinue={vi.fn()}
      turn={{
        completedAt: 1_057,
        id: "turn-table",
        items: [
          {
            id: "user-table",
            text: "Documents and knowledge bases need to be first-class citizens.",
            type: "userMessage",
          },
          {
            id: "commentary-table",
            phase: "commentary",
            text: "That changes the ranking. I’m checking which projects treat ingestion, retrieval, citations, connectors, and permissions as core features.",
            type: "agentMessage",
          },
          { id: "search-table", type: "webSearch" },
          {
            id: "final-table",
            phase: "finalAnswer",
            text: tableMarkdown,
            type: "agentMessage",
          },
        ],
        startedAt: 1_000,
        status: "completed",
      }}
    />,
  );

  expect(screen.getByText("Searched the web")).toBeInTheDocument();
  expect(screen.getByText("Worked for 57s")).toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
  expect(within(table).getAllByRole("row")).toHaveLength(6);
  expect(
    table.querySelector(".markdown-table-cell.is-numeric"),
  ).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Copy table" }));
  expect(writeText).toHaveBeenCalledWith(tableSource);
  fireEvent.click(screen.getByRole("button", { name: "Expand table" }));
  expect(screen.getByRole("dialog", { name: "Table preview" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Close table preview" }),
  ).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(
    screen.queryByRole("dialog", { name: "Table preview" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Expand table" })).toHaveFocus();
  expect(container).not.toHaveTextContent("turn4view3");
  expect(container.firstChild).toMatchSnapshot();
});

test("suppresses unresolved citation markers without touching code", () => {
  const { container } = render(
    <TurnView
      onContinue={vi.fn()}
      turn={{
        id: "turn-citations",
        items: [
          {
            id: "citation-answer",
            phase: "finalAnswer",
            text: [
              "AnythingLLM supports documents, vector search, local/cloud models, and multi-user deployments. It is MIT licensed. citeturn4view3turn5search7turn8view1",
              "",
              "Onyx is the stronger enterprise choice. citeturn6view0",
              "",
              "A literal marker remains intact in code: `citeexample`",
              "",
              "This streaming suffix stays hidden. citeturn7",
            ].join("\n"),
            type: "agentMessage",
          },
        ],
        status: "inProgress",
      }}
    />,
  );

  expect(container).toHaveTextContent(
    "AnythingLLM supports documents, vector search, local/cloud models, and multi-user deployments. It is MIT licensed.",
  );
  expect(container).toHaveTextContent(
    "Onyx is the stronger enterprise choice.",
  );
  expect(container).not.toHaveTextContent("turn4view3");
  expect(container).not.toHaveTextContent("turn6view0");
  expect(container).not.toHaveTextContent("turn7");
  expect(
    screen.getByText("citeexample", { selector: "code" }),
  ).toBeVisible();
  expect(container.firstChild).toMatchSnapshot();
});
