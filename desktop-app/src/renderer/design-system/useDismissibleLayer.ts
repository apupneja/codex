import { useEffect } from "react";
import type { RefObject } from "react";

type DismissibleLayerOptions = {
  active: boolean;
  layerRef: RefObject<HTMLElement | null>;
  onDismiss(): void;
};

export function useDismissibleLayer({
  active,
  layerRef,
  onDismiss,
}: DismissibleLayerOptions): void {
  useEffect(() => {
    if (!active) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !layerRef.current?.contains(event.target)
      ) {
        onDismiss();
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onDismiss();
    };
    document.addEventListener("pointerdown", dismissOnPointerDown);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnPointerDown);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [active, layerRef, onDismiss]);
}
