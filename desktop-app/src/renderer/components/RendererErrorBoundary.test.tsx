import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RendererErrorBoundary } from "./RendererErrorBoundary";

function BrokenView(): never {
  throw new Error("Invalid turn payload");
}

describe("RendererErrorBoundary", () => {
  it("shows a recoverable error instead of an empty renderer", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <RendererErrorBoundary>
        <BrokenView />
      </RendererErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Codex hit a rendering error",
    );
    expect(screen.getByText("Invalid turn payload")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload window" })).toBeVisible();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
