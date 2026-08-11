import { Brush, File, Globe2, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";

import { MenuSurface } from "../design-system";

export type WorkspaceOpenTarget = "browser" | "canvas" | "files" | "terminal";

type WorkspaceOpenMenuProps = {
  onClose(): void;
  onOpen(target: WorkspaceOpenTarget, input?: string): void;
};

type OpenOption = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  shortcut?: string;
  target: WorkspaceOpenTarget;
};

const OPEN_OPTIONS: OpenOption[] = [
  { icon: File, label: "File", shortcut: "⌘G", target: "files" },
  {
    icon: TerminalSquare,
    label: "Terminal",
    shortcut: "⌘J",
    target: "terminal",
  },
  {
    icon: Globe2,
    label: "Browser",
    shortcut: "⇧⌘B",
    target: "browser",
  },
  { icon: Brush, label: "Canvas", target: "canvas" },
];

export function WorkspaceOpenMenu({ onClose, onOpen }: WorkspaceOpenMenuProps) {
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return OPEN_OPTIONS;
    const matches = OPEN_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(normalized),
    );
    return matches.length > 0
      ? matches
      : OPEN_OPTIONS.filter((option) => option.target === "browser");
  }, [query]);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [onClose]);

  function choose(target: WorkspaceOpenTarget): void {
    const input = query.trim();
    onOpen(target, input || undefined);
    onClose();
  }

  return (
    <MenuSurface
      aria-label="Open workspace tool"
      className="workspace-open-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      ref={menuRef}
      role="dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          choose(filtered[0]?.target ?? "files");
        }}
      >
        <input
          aria-label="Open any file, URL, or tool"
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Open any file, URL, …"
          ref={inputRef}
          spellCheck={false}
          value={query}
        />
      </form>
      <div className="workspace-open-options">
        {filtered.map(({ icon: Icon, label, shortcut, target }, index) => (
          <button
            className={index === 0 ? "selected" : undefined}
            key={target}
            onClick={() => choose(target)}
            type="button"
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
            {target === "browser" && query.trim() && filtered.length === 1 ? (
              <small>Open or search</small>
            ) : null}
            {shortcut ? <kbd>{shortcut}</kbd> : null}
          </button>
        ))}
      </div>
    </MenuSurface>
  );
}
