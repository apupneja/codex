import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Bot,
  CircleHelp,
  Code2,
  File,
  FolderOpen,
  GitCommit,
  Infinity,
  Keyboard,
  ListChecks,
  Mic,
  Moon,
  PanelRightOpen,
  Pin,
  Plug,
  Search,
  Settings,
  Sun,
  WandSparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  DesktopAppAction,
  DesktopTheme,
  Thread,
} from "../../shared/types";
import type { SidebarGrouping } from "./Sidebar";

type PaletteTab = "actions" | "all" | "files" | "settings" | "tasks";
type PaletteResult = {
  accessibilityLabel?: string;
  description?: string;
  icon: typeof Search;
  id: string;
  kind: Exclude<PaletteTab, "all">;
  label: string;
  section:
    | "Actions"
    | "Agent"
    | "Mode"
    | "Recent Agents"
    | "Recent Files"
    | "Settings";
  run(): void;
};

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1_000 - timestamp));
  if (seconds < 60) return "now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  if (seconds < 2_629_800) return `${Math.floor(seconds / 604_800)}w`;
  return `${Math.floor(seconds / 2_629_800)}mo`;
}

type CommandPaletteProps = {
  onClose(): void;
  onNewTask(): void;
  onOpenFile(path: string): void;
  onOpenRepository(): void;
  onPerformAppAction(action: DesktopAppAction): void;
  onResetAdViews(): void;
  onSelectThread(thread: Thread): void;
  onSetGrouping(grouping: SidebarGrouping): void;
  onSetModel(model: string): void;
  onSetTheme(theme: DesktopTheme): void;
  onSetView(view: "automations" | "customize" | "settings"): void;
  onToggleWorkspace(): void;
  onUnavailable(label: string): void;
  threads: Thread[];
  workspace: string | null;
  workspaceVisible: boolean;
};

export function CommandPalette({
  onClose,
  onNewTask,
  onOpenFile,
  onOpenRepository,
  onPerformAppAction,
  onResetAdViews,
  onSelectThread,
  onSetGrouping,
  onSetModel,
  onSetTheme,
  onSetView,
  onToggleWorkspace,
  onUnavailable,
  threads,
  workspace,
  workspaceVisible,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PaletteTab>("all");
  const [files, setFiles] = useState<Array<{ path: string; fileName: string }>>(
    [],
  );
  const [recentFiles, setRecentFiles] = useState<
    Array<{ path: string; fileName: string }>
  >([]);
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (!workspace) {
      setRecentFiles([]);
      return;
    }
    void window.codexDesktop
      .request<{
        entries: Array<{ fileName: string; isDirectory: boolean }>;
      }>("fs/readDirectory", { path: workspace })
      .then((response) =>
        setRecentFiles(
          response.entries
            .filter((entry) => !entry.isDirectory)
            .slice(0, 6)
            .map((entry) => ({
              fileName: entry.fileName,
              path: `${workspace}/${entry.fileName}`,
            })),
        ),
      )
      .catch(() => setRecentFiles([]));
  }, [workspace]);

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
      .map((thread) => {
        const title = thread.name || thread.preview || "Untitled task";
        const repository = thread.cwd.split(/[\\/]/).pop() ?? thread.cwd;
        const number = (thread as Thread & { pullRequestNumber?: unknown })
          .pullRequestNumber;
        const pullRequest = typeof number === "number" ? ` #${number}` : "";
        const age = relativeTime(thread.recencyAt ?? thread.updatedAt);
        return {
          accessibilityLabel: `Completed ${title}${pullRequest} ${repository} ${age}`,
          id: `thread-${thread.id}`,
          kind: "tasks",
          icon: Bot,
          label: `${title}${pullRequest}`,
          description: `${repository}  ${age}`,
          section: "Recent Agents",
          run: () => onSelectThread(thread),
        };
      });
    const fileResults: PaletteResult[] = (query ? files : recentFiles).map(
      (file) => ({
        id: `file-${file.path}`,
        kind: "files",
        icon: File,
        label: file.fileName,
        description: file.path,
        section: "Recent Files",
        run: () => onOpenFile(file.path),
      }),
    );
    const actionCatalog: PaletteResult[] = [
      {
        id: "back",
        kind: "actions",
        icon: ArrowLeft,
        label: "Go Back",
        description: "⌘[",
        section: "Agent",
        run: onClose,
      },
      {
        id: "forward",
        kind: "actions",
        icon: ArrowRight,
        label: "Go Forward",
        description: "⌘]",
        section: "Agent",
        run: onClose,
      },
      {
        id: "new",
        kind: "actions",
        icon: Bot,
        label: "New Agent",
        description: "",
        section: "Agent",
        run: onNewTask,
      },
      {
        id: "dictate",
        kind: "actions",
        icon: Mic,
        label: "Dictate",
        description: "⇧⌘␣",
        section: "Agent",
        run: onClose,
      },
      {
        id: "pin-agent",
        kind: "actions",
        icon: Pin,
        label: "Pin / Unpin Agent",
        section: "Agent",
        run: onClose,
      },
      {
        id: "plan-mode",
        kind: "actions",
        icon: ListChecks,
        label: "Plan Mode",
        section: "Mode",
        run: onClose,
      },
      {
        id: "agent-mode",
        kind: "actions",
        icon: Infinity,
        label: "Agent Mode",
        section: "Mode",
        run: onClose,
      },
      {
        id: "ask-mode",
        kind: "actions",
        icon: CircleHelp,
        label: "Ask Mode",
        section: "Mode",
        run: onClose,
      },
      {
        id: "debug-mode",
        kind: "actions",
        icon: Code2,
        label: "Debug Mode",
        section: "Mode",
        run: onClose,
      },
      {
        id: "multitask-mode",
        kind: "actions",
        icon: Workflow,
        label: "Multitask Mode",
        section: "Mode",
        run: onClose,
      },
      {
        id: "git-blame",
        kind: "actions",
        icon: GitCommit,
        label: "Toggle Git Blame",
        section: "Actions",
        run: onClose,
      },
      {
        id: "repository",
        kind: "actions",
        icon: FolderOpen,
        label: "Open Folder",
        description: "⌘O",
        section: "Actions",
        run: onOpenRepository,
      },
      {
        id: "workspace",
        kind: "actions",
        icon: PanelRightOpen,
        label: workspaceVisible ? "Hide Apps" : "Open IDE",
        description: "⇧⌘N",
        section: "Actions",
        run: onToggleWorkspace,
      },
      {
        id: "automations",
        kind: "actions",
        icon: Workflow,
        label: "Open Automations",
        section: "Actions",
        run: () => onSetView("automations"),
      },
      {
        id: "customize",
        kind: "actions",
        icon: Blocks,
        label: "Open Customize",
        section: "Actions",
        run: () => onSetView("customize"),
      },
      {
        id: "plugins",
        kind: "actions",
        icon: Settings,
        label: "Open Plugins",
        section: "Actions",
        run: () => onSetView("customize"),
      },
      {
        id: "mcps",
        kind: "actions",
        icon: Plug,
        label: "Open MCPs",
        section: "Actions",
        run: () => onSetView("customize"),
      },
      {
        id: "skills",
        kind: "actions",
        icon: WandSparkles,
        label: "Open Skills",
        section: "Actions",
        run: () => onSetView("customize"),
      },
      {
        id: "reset-ad-views",
        kind: "actions",
        icon: CircleHelp,
        label: "Reset In-App Ad Views",
        section: "Actions",
        run: onResetAdViews,
      },
      {
        id: "reload-window",
        kind: "actions",
        icon: Workflow,
        label: "Reload Window",
        description: "⇧⌘R",
        section: "Actions",
        run: () => onPerformAppAction("reload-window"),
      },
      {
        id: "developer-tools",
        kind: "actions",
        icon: Code2,
        label: "Toggle Developer Tools",
        description: "⌥⌘I",
        section: "Actions",
        run: () => onPerformAppAction("toggle-developer-tools"),
      },
      {
        id: "logs-folder",
        kind: "actions",
        icon: File,
        label: "Developer: Open Logs Folder",
        section: "Actions",
        run: () => onPerformAppAction("open-logs-folder"),
      },
      {
        id: "skill-logs",
        kind: "actions",
        icon: File,
        label: "Debug: Open Skill Publishing Logs",
        section: "Actions",
        run: () => onPerformAppAction("open-skill-logs"),
      },
      {
        id: "connect-ssh",
        kind: "actions",
        icon: Code2,
        label: "Connect via SSH",
        section: "Actions",
        run: () => onUnavailable("Connect via SSH"),
      },
      {
        id: "connect-wsl",
        kind: "actions",
        icon: Code2,
        label: "Connect via WSL",
        section: "Actions",
        run: () => onUnavailable("Connect via WSL"),
      },
      {
        id: "ssh-config",
        kind: "actions",
        icon: File,
        label: "Open SSH Configuration File",
        section: "Actions",
        run: () => onPerformAppAction("open-ssh-config"),
      },
      ...(
        [
          ["cursor-grok-4.5", "Cursor Grok 4.5"],
          ["composer-2.5", "Composer 2.5"],
          ["opus-5", "Opus 5"],
          ["gpt-5.6-sol", "GPT-5.6 Sol"],
          ["fable-5", "Fable 5"],
        ] as const
      ).map(
        ([id, label]): PaletteResult => ({
          id: `model-${id}`,
          kind: "actions",
          icon: Bot,
          label,
          description: "Model",
          section: "Actions",
          run: () => onSetModel(id),
        }),
      ),
      ...(
        [
          ["workspace", "Group by Workspace"],
          ["repository", "Group by Repository"],
          ["updated", "Group by Updated"],
          ["status", "Group by Status"],
          ["environment", "Group by Environment"],
        ] as const
      ).map(
        ([grouping, label]): PaletteResult => ({
          id: `group-${grouping}`,
          kind: "actions",
          icon: ListChecks,
          label,
          section: "Actions",
          run: () => onSetGrouping(grouping),
        }),
      ),
      ...["review-agent", "automate", "autopilot", "canvas", "create-hook"].map(
        (skill): PaletteResult => ({
          id: `skill-${skill}`,
          kind: "actions",
          icon: WandSparkles,
          label: skill,
          description: "Skill",
          section: "Actions",
          run: () => onSetView("customize"),
        }),
      ),
      {
        id: "about",
        kind: "actions",
        icon: CircleHelp,
        label: "About Cursor",
        section: "Actions",
        run: onClose,
      },
      {
        id: "settings",
        kind: "actions",
        icon: Settings,
        label: "Settings",
        description: "⌘,",
        section: "Actions",
        run: () => onSetView("settings"),
      },
      {
        id: "shortcuts",
        kind: "actions",
        icon: Keyboard,
        label: "Keyboard Shortcuts",
        description: "⌃⇧/",
        section: "Actions",
        run: onClose,
      },
      {
        id: "install-command",
        kind: "actions",
        icon: Code2,
        label: "Install 'cursor' command",
        section: "Actions",
        run: onClose,
      },
      {
        id: "update",
        kind: "actions",
        icon: Workflow,
        label: "Update Cursor",
        section: "Actions",
        run: onClose,
      },
      {
        id: "light-theme",
        kind: "actions",
        icon: Sun,
        label: "Light Theme",
        section: "Actions",
        run: () => onSetTheme("light"),
      },
      {
        id: "dark-theme",
        kind: "actions",
        icon: Moon,
        label: "Dark Theme",
        section: "Actions",
        run: () => onSetTheme("dark"),
      },
      {
        id: "system-theme",
        kind: "actions",
        icon: Settings,
        label: "System Theme",
        section: "Actions",
        run: () => onSetTheme("system"),
      },
      {
        id: "high-contrast-theme",
        kind: "actions",
        icon: Sun,
        label: "High Contrast Theme",
        section: "Actions",
        run: () => onSetTheme("dark-high-contrast"),
      },
      {
        id: "auto-web-search",
        kind: "settings",
        icon: Settings,
        label: "Auto-Accept Web Search",
        description: "Agents",
        section: "Settings",
        run: () => onSetView("settings"),
      },
      {
        id: "tool-density",
        kind: "settings",
        icon: Settings,
        label: "Tool Call Density",
        description: "Appearance",
        section: "Settings",
        run: () => onSetView("settings"),
      },
      {
        id: "usage-summary",
        kind: "settings",
        icon: Settings,
        label: "Usage Summary",
        description: "Agents",
        section: "Settings",
        run: () => onSetView("settings"),
      },
      {
        id: "submit-shortcut",
        kind: "settings",
        icon: Settings,
        label: "Submit with ⌘ + Enter",
        description: "Agents",
        section: "Settings",
        run: () => onSetView("settings"),
      },
      {
        id: "mode-transitions",
        kind: "settings",
        icon: Settings,
        label: "Auto-Approve Mode Transitions",
        description: "Agents",
        section: "Settings",
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
    onPerformAppAction,
    onResetAdViews,
    onSelectThread,
    onSetGrouping,
    onSetModel,
    onSetTheme,
    onSetView,
    onToggleWorkspace,
    onUnavailable,
    query,
    recentFiles,
    tab,
    threads,
    workspaceVisible,
  ]);

  useEffect(() => setSelected(0), [query, tab]);

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <section
        aria-label="Command palette"
        aria-modal="true"
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <label className="palette-input">
          <input
            aria-label="Search agents, files, actions..."
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
            placeholder="Search agents, files, actions..."
            ref={input}
            value={query}
          />
        </label>
        <nav
          aria-label="Filter results"
          className="palette-tabs"
          role="tablist"
        >
          {(
            [
              ["all", "All"],
              ["tasks", "Agents"],
              ["files", "Files"],
              ["actions", "Actions"],
              ["settings", "Settings"],
            ] as const
          ).map(([name, label]) => (
            <button
              className={tab === name ? "active" : ""}
              key={name}
              onClick={() => setTab(name)}
              aria-selected={tab === name}
              role="tab"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="palette-results" role="listbox">
          {results.map((result, index) => {
            const Icon = result.icon;
            const showSection =
              index === 0 || results[index - 1]?.section !== result.section;
            return (
              <div className="palette-result-group" key={result.id}>
                {showSection ? (
                  <div className="palette-section-heading">
                    {result.section}
                  </div>
                ) : null}
                <button
                  aria-label={result.accessibilityLabel}
                  aria-selected={selected === index}
                  className={selected === index ? "selected" : ""}
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
              </div>
            );
          })}
          {results.length === 0 ? (
            <div className="palette-empty">
              No matching tasks, files, or actions.
            </div>
          ) : null}
        </div>
        <footer>
          <span>↑↓ Select</span>
          <span>Open</span>
          <span>⌘[ or ⌘] Change Filter</span>
        </footer>
      </section>
    </div>
  );
}
