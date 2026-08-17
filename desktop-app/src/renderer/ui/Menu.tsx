import { useRef, type ReactNode } from "react";

import { useDismissibleLayer } from "./useDismissibleLayer";

export function Menu({
  children,
  label,
  onDismiss,
}: {
  children: ReactNode;
  label: string;
  onDismiss(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissibleLayer(ref, onDismiss);
  return (
    <div aria-label={label} className="menu" ref={ref} role="menu">
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
}: {
  children: ReactNode;
  onSelect(): void;
}) {
  return (
    <button
      className="menu__item"
      onClick={onSelect}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  );
}
