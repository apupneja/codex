import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceOpenMenu } from "./WorkspaceOpenMenu";

describe("WorkspaceOpenMenu", () => {
  it("opens each workspace tool", () => {
    const onOpen = vi.fn();
    render(<WorkspaceOpenMenu onClose={vi.fn()} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: /Terminal/ }));

    expect(onOpen).toHaveBeenCalledWith("terminal", undefined);
  });

  it("opens arbitrary input in the browser", () => {
    const onOpen = vi.fn();
    render(<WorkspaceOpenMenu onClose={vi.fn()} onOpen={onOpen} />);
    const input = screen.getByRole("textbox", {
      name: "Open any file, URL, or tool",
    });

    fireEvent.change(input, { target: { value: "openai.com" } });
    fireEvent.submit(input.closest("form")!);

    expect(onOpen).toHaveBeenCalledWith("browser", "openai.com");
  });

  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(<WorkspaceOpenMenu onClose={onClose} onOpen={vi.fn()} />);

    fireEvent.keyDown(
      screen.getByRole("dialog", { name: "Open workspace tool" }),
      { key: "Escape" },
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
