import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

const MINIMUM_CHAT_LANE_WIDTH = 560;
const MINIMUM_PANEL_WIDTH = 320;
const PANEL_GAP_AND_EDGE_GUTTER = 24;
const MINIMUM_DOCKED_LAYOUT_WIDTH =
  MINIMUM_CHAT_LANE_WIDTH + MINIMUM_PANEL_WIDTH + PANEL_GAP_AND_EDGE_GUTTER;

export type EnvironmentPanelMode = "docked" | "drawer";

type EnvironmentPanelLayout = {
  mode: EnvironmentPanelMode;
};

export function environmentPanelModeForWidth(
  availableWidth: number,
): EnvironmentPanelMode {
  return availableWidth >= MINIMUM_DOCKED_LAYOUT_WIDTH ? "docked" : "drawer";
}

/** Chooses a docked rail or overlay drawer from the conversation area's width. */
export function useEnvironmentPanelLayout(
  containerRef: RefObject<HTMLElement | null>,
): EnvironmentPanelLayout {
  const [mode, setMode] = useState<EnvironmentPanelMode>(() =>
    environmentPanelModeForWidth(window.innerWidth),
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      setMode(
        environmentPanelModeForWidth(container.getBoundingClientRect().width),
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef]);

  return { mode };
}
