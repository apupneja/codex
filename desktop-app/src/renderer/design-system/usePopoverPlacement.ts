import { useEffect, useState } from "react";
import type { RefObject } from "react";

export type PopoverPlacement = "above" | "below";

type UsePopoverPlacementOptions = {
  open: boolean;
  popoverRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
};

function spacingBetweenControls(): number {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--space-2"),
  );
  return Number.isFinite(value) ? value : 4;
}

export function usePopoverPlacement({
  open,
  popoverRef,
  triggerRef,
}: UsePopoverPlacementOptions): PopoverPlacement {
  const [placement, setPlacement] = useState<PopoverPlacement>("below");

  useEffect(() => {
    if (!open) {
      setPlacement("below");
      return;
    }

    let frame = 0;
    const updatePlacement = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const trigger = triggerRef.current;
        const popover = popoverRef.current;
        if (!trigger || !popover) return;

        const triggerRect = trigger.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const gap = spacingBetweenControls();
        const bottomSpace = window.innerHeight - triggerRect.bottom;
        const fitsBelow = bottomSpace >= popoverRect.height + gap;

        setPlacement(fitsBelow ? "below" : "above");
      });
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updatePlacement);
    if (popoverRef.current && observer) observer.observe(popoverRef.current);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
      observer?.disconnect();
    };
  }, [open, popoverRef, triggerRef]);

  return placement;
}
