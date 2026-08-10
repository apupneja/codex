import {
  Blocks,
  Bot,
  File,
  FolderOpen,
  PanelRightOpen,
  Search,
  Settings,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Thread } from "../../shared/types";

type PaletteTab = "actions" | "all" | "files" | "settings" | "tasks";
type PaletteResult = {
  description?: string;
  icon: typeof Search;
  id: string;
  kind: Exclude<PaletteTab, "all">;
  label: string;
  run(): void;
};

type CommandPaletteProps = {
  onClose(): void;
  onNewTask(): void;
  onOpenFile(path: string): void;
  onOpenRepository(): void;
  onSelectThread(thread: Thread): void;
  onSetView(view: "automations" | "customize" | "settings"): void;
  onToggleWorkspace(): void;
  threads: Thread[];
  workspace: string | null;
};

export function CommandPalette({
  onClose,
  onNewTask,
  onOpenFile,
  onOpenRepository,
  onSelectThread,
  onSetView,
  onToggleWorkspace,
  threads,
  workspace,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PaletteTab>("all");
  const [files, setFiles] = useState<Array<{ path: string; fileName: string }>>(
    [],
  );
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (!query.trim() || !workspace) {
      setFiles([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void window.codexDesktop
        .request<{ files: Array<{ path: string; fileName: string }> }>(
          "fuzzyFileSearch",
          {
            cancellationToken: null,
            query,
            roots: [workspace],
          },
        )
        .then((response) => setFiles(response.files.slice(0, 12)))
        .catch(() => setFiles([]));
    }, 140);
    return () => window.clearTimeout(timer);
  }, [query, workspace]);

  const results = useMemo(() => {
    const normalized = query.toLowerCase();
    const taskResults: PaletteResult[] = threads
      .filter((thread) =>
        `${thread.name ?? ""} ${thread.preview}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, query ? 10 : 5)
      .map((thread) => ({
        id: `thread-${thread.id}`,
        kind: "tasks",
        icon: Bot,
        label: thread.name || thread.preview || "Untitled task",
        description: thread.cwd.split(/[\\/]/).pop(),
        run: () => onSelectThread(thread),
      }));
    const fileResults: PaletteResult[] = files.map((file) => ({
      id: `file-${file.path}`,
      kind: "files",
      icon: File,
      label: file.fileName,
      description: file.path,
      run: () => onOpenFile(file.path),
    }));
    const actionCatalog: PaletteResult[] = [
      {
        id: "new",
        kind: "actions",
        icon: Bot,
        label: "New task",
        description: "⌘N",
        run: onNewTask,
      },
      {
        id: "repository",
        kind: "actions",
        icon: FolderOpen,
        label: "Open repository",
        description: "⌘O",
        run: onOpenRepository,
      },
      {
        id: "workspace",
        kind: "actions",
        icon: PanelRightOpen,
        label: "Toggle workspace",
        run: onToggleWorkspace,
      },
      {
        id: "automations",
        kind: "actions",
        icon: Workflow,
        label: "Open automations",
        run: () => onSetView("automations"),
      },
      {
        id: "customize",
        kind: "actions",
        icon: Blocks,
        label: "Open customize",
        run: () => onSetView("customize"),
      },
      {
        id: "settings",
        kind: "settings",
        icon: Settings,
        label: "Open settings",
        description: "⌘,",
        run: () => onSetView("settings"),
      },
    ];
    const actions = actionCatalog.filter((result) =>
      `${result.label} ${result.description ?? ""}`
        .toLowerCase()
        .includes(normalized),
    );
    return [...taskResults, ...fileResults, ...actions].filter(
      (result) => tab === "all" || result.kind === tab,
    );
  }, [
    files,
    onNewTask,
    onOpenFile,
    onOpenRepository,
    onSelectThread,
    onSetView,
    onToggleWorkspace,
    query,
    tab,
    threads,
  ]);

  useEffect(() => setSelected(0), [query, tab]);

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <section
        aria-label="Search tasks, files, and actions"
        aria-modal="true"
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <label className="palette-input">
          <Search size={16} />
          <input
            aria-label="Search tasks, files, and actions"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((value) => Math.min(results.length - 1, value + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((value) => Math.max(0, value - 1));
              }
              if (event.key === "Enter") {
                results[selected]?.run();
                onClose();
              }
            }}
            placeholder="Search tasks, files, actions…"
            ref={input}
            value={query}
          />
        </label>
        <nav className="palette-tabs">
          {(["all", "tasks", "files", "actions", "settings"] as const).map(
            (name) => (
              <button
                className={tab === name ? "active" : ""}
                key={name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ),
          )}
        </nav>
        <div className="palette-results" role="listbox">
          {results.map((result, index) => {
            const Icon = result.icon;
            return (
              <button
                aria-selected={selected === index}
                className={selected === index ? "selected" : ""}
                key={result.id}
                onClick={() => {
                  result.run();
                  onClose();
                }}
                onMouseEnter={() => setSelected(index)}
                role="option"
              >
                <Icon size={14} />
                <span>{result.label}</span>
                {result.description ? (
                  <small>{result.description}</small>
                ) : null}
              </button>
            );
          })}
          {results.length === 0 ? (
            <div className="palette-empty">
              No matching tasks, files, or actions.
            </div>
          ) : null}
        </div>
        <footer>
          <span>↑↓ select</span>
          <span>↵ open</span>
          <span>esc close</span>
        </footer>
      </section>
    </div>
  );
}
