import { Archive, Bell, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  MenuItem,
  MenuSeparator,
  MenuSurface,
  useDismissibleLayer,
} from "../design-system";

type RepositoryContextMenuProps = {
  hasUnread: boolean;
  label: string;
  onArchiveAll(): void;
  onClose(): void;
  onMarkAllRead(): void;
  onRemove(): void;
  position: { x: number; y: number };
};

function focusMenuItem(menu: HTMLDivElement, direction: -1 | 1): void {
  const items = [
    ...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  ];
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    current < 0 ? 0 : (current + direction + items.length) % items.length;
  items[next]?.focus();
}

export function RepositoryContextMenu({
  hasUnread,
  label,
  onArchiveAll,
  onClose,
  onMarkAllRead,
  onRemove,
  position,
}: RepositoryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [resolvedPosition, setResolvedPosition] = useState(position);
  useDismissibleLayer({ active: true, layerRef: menuRef, onDismiss: onClose });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const gutter = 8;
    setResolvedPosition({
      x: Math.max(
        gutter,
        Math.min(position.x, window.innerWidth - bounds.width - gutter),
      ),
      y: Math.max(
        gutter,
        Math.min(position.y, window.innerHeight - bounds.height - gutter),
      ),
    });
  }, [position]);

  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, []);

  return createPortal(
    <MenuSurface
      aria-label={`Actions for ${label}`}
      className="repository-context-menu"
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        focusMenuItem(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
      }}
      ref={menuRef}
      role="menu"
      style={{ left: resolvedPosition.x, top: resolvedPosition.y }}
    >
      <MenuItem disabled={!hasUnread} onClick={onMarkAllRead} role="menuitem">
        <Bell aria-hidden="true" size={16} />
        Mark All as Read
      </MenuItem>
      <MenuItem onClick={onArchiveAll} role="menuitem">
        <Archive aria-hidden="true" size={16} />
        Archive All
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={onRemove} role="menuitem">
        <Trash2 aria-hidden="true" size={16} />
        Remove from Sidebar
      </MenuItem>
    </MenuSurface>,
    document.body,
  );
}
