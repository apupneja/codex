import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePopoverPlacement } from "./usePopoverPlacement";

function TestPopover() {
  const triggerRef = { current: null };
  const popoverRef = { current: null };
  const placement = usePopoverPlacement({
    open: true,
    popoverRef,
    triggerRef,
  });

  return (
    <>
      <button data-layout="trigger" ref={triggerRef} />
      <div data-layout="popover" data-placement={placement} ref={popoverRef} />
    </>
  );
}

function layoutRect(top: number, bottom: number, height: number): DOMRect {
  return {
    bottom,
    height,
    left: 0,
    right: 100,
    top,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("usePopoverPlacement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens below when the popup fits in the remaining viewport", async () => {
    vi.stubGlobal("innerHeight", 700);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.layout === "trigger"
          ? layoutRect(100, 130, 30)
          : layoutRect(0, 200, 200);
      },
    );
    render(<TestPopover />);

    await waitFor(() =>
      expect(document.querySelector("[data-layout='popover']")).toHaveAttribute(
        "data-placement",
        "below",
      ),
    );
  });

  it("flips above when the popup does not fit below", async () => {
    vi.stubGlobal("innerHeight", 700);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.layout === "trigger"
          ? layoutRect(600, 630, 30)
          : layoutRect(0, 200, 200);
      },
    );
    render(<TestPopover />);

    await waitFor(() =>
      expect(document.querySelector("[data-layout='popover']")).toHaveAttribute(
        "data-placement",
        "above",
      ),
    );
  });
});
