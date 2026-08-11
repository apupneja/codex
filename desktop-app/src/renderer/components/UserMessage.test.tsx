import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ThreadItem } from "../../shared/types";
import { UserMessage } from "./UserMessage";

const longPrompt = [
  "First visible line",
  "Second visible line",
  "Third visible line",
  "Fourth hidden line",
].join("\n");

function userMessage(text: string) {
  return {
    type: "userMessage",
    id: "user-message",
    clientId: null,
    content: [{ type: "text", text, text_elements: [] }],
  } as Extract<ThreadItem, { type: "userMessage" }>;
}

describe("UserMessage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("expands and collapses an overflowing three-line preview", () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(66);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(88);

    render(<UserMessage item={userMessage(longPrompt)} onOpenFile={vi.fn()} />);

    const preview = screen.getByRole("button", { name: "Show full prompt" });
    expect(preview).toHaveAttribute("aria-expanded", "false");
    expect(preview).toHaveClass("is-collapsed", "is-overflowing");

    fireEvent.click(preview);
    expect(
      screen.getByRole("button", { name: "Collapse prompt" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(preview, { key: "Enter" });
    expect(preview).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves text without rendered overflow as ordinary prose", () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(44);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(44);

    render(
      <UserMessage item={userMessage("A short prompt")} onOpenFile={vi.fn()} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("A short prompt")).toHaveClass("is-collapsed");
  });
});
