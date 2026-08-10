import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ServerRequest } from "../../shared/types";
import { ApprovalDialog } from "./ApprovalDialog";

function request(
  method: string,
  params: Record<string, unknown>,
): ServerRequest {
  return { id: 7, method, params } as unknown as ServerRequest;
}

describe("ApprovalDialog", () => {
  it("fails closed when the exact file patch is unavailable", () => {
    render(
      <ApprovalDialog
        onRespond={vi.fn()}
        request={request("item/fileChange/requestApproval", {
          itemId: "item-1",
          threadId: "thread-1",
          turnId: "turn-1",
        })}
      />,
    );

    expect(screen.getByText(/matching patch is not available/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("shows correlated file changes before accepting them", () => {
    const onRespond = vi.fn();
    const approval = request("item/fileChange/requestApproval", {
      itemId: "item-1",
      threadId: "thread-1",
      turnId: "turn-1",
    });
    render(
      <ApprovalDialog
        fileChanges={[
          { path: "/repo/src/app.ts", kind: "update", diff: "+safe change" },
        ]}
        onRespond={onRespond}
        request={approval}
      />,
    );

    expect(screen.getByText(/safe change/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onRespond).toHaveBeenCalledWith(approval, { decision: "accept" });
  });

  it("validates and serializes standard MCP form fields", async () => {
    const onRespond = vi.fn();
    const approval = request("mcpServer/elicitation/request", {
      _meta: { source: "test" },
      message: "Configure the tool",
      mode: "form",
      requestedSchema: {
        type: "object",
        properties: {
          email: {
            type: "string",
            title: "Email",
            format: "email",
          },
          retries: {
            type: "integer",
            title: "Retries",
            minimum: 1,
            default: 2,
          },
          scopes: {
            type: "array",
            title: "Scopes",
            minItems: 1,
            items: {
              anyOf: [
                { const: "read", title: "Read" },
                { const: "write", title: "Write" },
              ],
            },
          },
        },
        required: ["email", "retries", "scopes"],
      },
    });
    render(<ApprovalDialog onRespond={onRespond} request={approval} />);

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "not-an-email" },
    });
    expect(screen.getByText(/valid email/i)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "dev@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Read" }));

    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    expect(onRespond).toHaveBeenCalledWith(approval, {
      _meta: { source: "test" },
      action: "accept",
      content: {
        email: "dev@example.com",
        retries: 2,
        scopes: ["read"],
      },
    });
  });

  it("declines unadvertised extended forms instead of guessing their schema", () => {
    const onRespond = vi.fn();
    const approval = request("mcpServer/elicitation/request", {
      message: "Unsafe form",
      mode: "openai/form",
      requestedSchema: { type: "object", properties: {} },
    });
    render(<ApprovalDialog onRespond={onRespond} request={approval} />);

    expect(screen.getByText(/cannot safely validate/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    expect(onRespond).toHaveBeenCalledWith(approval, {
      _meta: null,
      action: "decline",
      content: null,
    });
  });

  it("fails closed on tool-supplied regular expression patterns", () => {
    const onRespond = vi.fn();
    const approval = request("mcpServer/elicitation/request", {
      _meta: null,
      message: "Potentially expensive validation",
      mode: "form",
      requestedSchema: {
        properties: {
          value: {
            pattern: "(a+)+$",
            title: "Value",
            type: "string",
          },
        },
        type: "object",
      },
    });
    render(<ApprovalDialog onRespond={onRespond} request={approval} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Value" }), {
      target: { value: `${"a".repeat(10_000)}!` },
    });
    expect(screen.getByText(/pattern-constrained fields/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(onRespond).not.toHaveBeenCalled();
  });
});
