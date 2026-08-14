import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Github,
  Laptop,
  Monitor,
  MoreHorizontal,
  PanelRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CodexController } from "../state/useCodexController";
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSurface,
  useDismissibleLayer,
} from "../design-system";
import { CodexMark } from "./CodexMark";
import { AuthenticationNotice } from "./AuthenticationNotice";
import { Composer } from "./Composer";

type NewTaskViewProps = {
  controller: CodexController;
  onToggleWorkspace(): void;
};

function basename(path: string | null): string {
  return path?.split(/[\\/]/).filter(Boolean).pop() ?? "Choose repository";
}

const NEW_TASK_TIPS = [
  "Use /cloud to run agents remotely for better parallelization and durable execution",
  "Configure MCPs in your Cursor Settings to give agents access to tools and data",
  "Voice mode lets you dictate better prompts for your agents",
  "Use /debug to solve bugs that are hard to reproduce or understand",
  "Use /create-skill to customize Cursor for your workflows",
  "Use /create-hook to control and extend the agent loop with custom scripts",
  "Use /simplify to have Cursor review all changed files for code quality and efficiency",
  "Use /add-plugin to install a plugin from the Cursor Marketplace",
  "Use /create-rule to control agent behavior through system-level instructions",
];

export function NewTaskView({
  controller,
  onToggleWorkspace,
}: NewTaskViewProps) {
  const workspace =
    controller.activeThread?.cwd ??
    controller.preferences.lastWorkspace ??
    controller.threads[0]?.cwd ??
    null;
  const branchLabel =
    (
      controller.activeThread as
        | (typeof controller.activeThread & {
            branch?: string;
            gitInfo?: { branch?: string };
          })
        | null
    )?.gitInfo?.branch ??
    (
      controller.threads[0] as
        | ((typeof controller.threads)[0] & {
            branch?: string;
            gitInfo?: { branch?: string };
          })
        | undefined
    )?.gitInfo?.branch ??
    "Current branch";
  const [tipVisible, setTipVisible] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [contextOpen, setContextOpen] = useState<
    "workspace" | "branch" | "device" | null
  >(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const recentWorkspaces = useMemo(() => {
    const candidates =
      controller.preferences.recentWorkspaces.length > 0
        ? controller.preferences.recentWorkspaces
        : workspace
          ? [workspace]
          : [];
    const query = workspaceQuery.trim().toLocaleLowerCase();
    if (!query) return candidates;
    return candidates.filter((path) =>
      path.toLocaleLowerCase().includes(query),
    );
  }, [controller.preferences.recentWorkspaces, workspace, workspaceQuery]);
  useEffect(() => {
    if (!tipVisible) return;
    const timer = window.setInterval(
      () => setTipIndex((current) => (current + 1) % NEW_TASK_TIPS.length),
      7_000,
    );
    return () => window.clearInterval(timer);
  }, [tipVisible]);
  useEffect(() => {
    if (!contextOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!contextRef.current?.contains(event.target as Node)) {
        setContextOpen(null);
      }
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [contextOpen]);
  useDismissibleLayer({
    active: menuOpen,
    layerRef: actionsRef,
    onDismiss: () => setMenuOpen(false),
  });
  const deviceLabel =
    controller.runtime.initialized?.platformOs === "macos"
      ? "This Mac"
      : controller.runtime.initialized?.platformOs === "windows"
        ? "This PC"
        : "This computer";
  return (
    <main className="new-task-view">
      <header className="workbench-header new-task-header">
        <div className="window-drag-fill" />
        <div className="header-actions" ref={actionsRef}>
          <button className="header-button" onClick={onToggleWorkspace}>
            IDE <ExternalLink size={12} />
          </button>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Chat actions"
            className="icon-button subtle"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MoreHorizontal size={16} />
          </button>
          <button
            aria-label="Show Apps"
            className="icon-button subtle"
            onClick={onToggleWorkspace}
          >
            <PanelRight size={15} />
          </button>
          {menuOpen ? (
            <MenuSurface className="task-actions-menu" role="menu">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  controller.addToast(
                    "Split down is available in the IDE workspace.",
                  );
                }}
              >
                <span>Split Down</span>
                <kbd>⇧⌘D</kbd>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  controller.addToast(
                    "Split right is available in the IDE workspace.",
                  );
                }}
              >
                <span>Split Right</span>
                <kbd>⌘D</kbd>
              </button>
            </MenuSurface>
          ) : null}
        </div>
      </header>
      <div className="new-task-center">
        <div className="hero-mark">
          <CodexMark size={48} />
        </div>
        <div className="new-task-context" ref={contextRef}>
          <div className="new-task-context-item">
            <button
              aria-expanded={contextOpen === "workspace"}
              aria-haspopup="menu"
              onClick={() => {
                setWorkspaceQuery("");
                setContextOpen((current) =>
                  current === "workspace" ? null : "workspace",
                );
              }}
              title={workspace ?? undefined}
            >
              <FolderOpen size={14} />
              {basename(workspace)}
              <ChevronDown size={12} />
            </button>
            {contextOpen === "workspace" ? (
              <MenuSurface
                aria-label="Choose repository"
                className="new-task-context-menu workspace-context-menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setContextOpen(null);
                  }
                }}
                role="dialog"
              >
                <label className="workspace-context-search">
                  <Search aria-hidden="true" size={13} />
                  <input
                    aria-label="Search folders and repositories"
                    autoFocus
                    onChange={(event) => setWorkspaceQuery(event.target.value)}
                    placeholder="Search folders, repos..."
                    type="search"
                    value={workspaceQuery}
                  />
                </label>
                <strong>Recents</strong>
                {recentWorkspaces.map((recent) => (
                  <button
                    aria-current={recent === workspace ? "true" : undefined}
                    aria-label={`Open ${recent}`}
                    className="workspace-context-option"
                    key={recent}
                    onClick={() => {
                      setContextOpen(null);
                      void controller.selectWorkspace(recent);
                    }}
                    title={recent}
                  >
                    <FolderOpen aria-hidden="true" size={14} />
                    <span>
                      <b>{basename(recent)}</b>
                      <small>{recent}</small>
                    </span>
                    {recent === workspace ? (
                      <Check
                        aria-hidden="true"
                        className="context-menu-trailing"
                        size={13}
                      />
                    ) : null}
                  </button>
                ))}
                {recentWorkspaces.length === 0 ? (
                  <span className="workspace-context-empty">
                    No matching folders
                  </span>
                ) : null}
                <strong>Repos</strong>
                <button
                  className="workspace-context-source"
                  onClick={() => {
                    setContextOpen(null);
                    controller.addToast("No repository selected.");
                  }}
                >
                  <X aria-hidden="true" size={14} /> No Repo
                </button>
                <button
                  className="workspace-context-source"
                  onClick={() => {
                    setContextOpen(null);
                    void controller.chooseWorkspace();
                  }}
                >
                  <Laptop aria-hidden="true" size={14} /> On This Mac
                </button>
                <button
                  className="workspace-context-source"
                  onClick={() => {
                    setContextOpen(null);
                    controller.addToast(
                      "Cloud repositories are not connected.",
                    );
                  }}
                >
                  <Cloud aria-hidden="true" size={14} /> Cloud
                </button>
                <div className="new-task-context-menu-footer">
                  <button onClick={() => void controller.chooseWorkspace()}>
                    Use Existing...
                  </button>
                  <button onClick={() => void controller.chooseWorkspace()}>
                    New Folder
                  </button>
                </div>
              </MenuSurface>
            ) : null}
          </div>
          <div className="new-task-context-item">
            <button
              aria-expanded={contextOpen === "branch"}
              aria-haspopup="menu"
              onClick={() =>
                setContextOpen((current) =>
                  current === "branch" ? null : "branch",
                )
              }
              title="Tasks run on the repository's current Git branch"
            >
              <GitBranch size={14} />
              {branchLabel}
            </button>
            {contextOpen === "branch" ? (
              <MenuSurface className="new-task-context-menu branch-context-menu">
                <input
                  aria-label="Search branches"
                  placeholder="Search branches..."
                />
                <button onClick={() => setContextOpen(null)}>
                  {branchLabel}
                </button>
                <strong>Recent</strong>
                {branchLabel !== "main" ? (
                  <button onClick={() => setContextOpen(null)}>main</button>
                ) : null}
              </MenuSurface>
            ) : null}
          </div>
          <div className="new-task-context-item">
            <button
              aria-expanded={contextOpen === "device"}
              aria-haspopup="menu"
              onClick={() =>
                setContextOpen((current) =>
                  current === "device" ? null : "device",
                )
              }
              title="Tasks run through the local Codex app-server"
            >
              <Laptop size={14} />
              {deviceLabel}
            </button>
            {contextOpen === "device" ? (
              <MenuSurface className="new-task-context-menu device-context-menu">
                <MenuLabel>Run on</MenuLabel>
                <MenuItem onClick={() => setContextOpen(null)}>
                  <Cloud size={12} />
                  <span>Cloud</span>
                </MenuItem>
                <MenuItem onClick={() => setContextOpen(null)}>
                  <Laptop size={12} />
                  <span>This Mac</span>
                  <Check className="context-menu-trailing" size={12} />
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    controller.addToast("Remote machines are not connected.")
                  }
                >
                  <Monitor size={12} />
                  <span>Remote Machines</span>
                  <ChevronRight className="context-menu-trailing" size={12} />
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  className="context-menu-new-worktree"
                  onClick={() =>
                    controller.addToast(
                      "New worktree creation is available from the IDE.",
                    )
                  }
                >
                  <Plus size={12} />
                  <span>New Worktree</span>
                </MenuItem>
              </MenuSurface>
            ) : null}
          </div>
        </div>
        {controller.requiresAuth && !controller.account ? (
          <AuthenticationNotice
            onSignIn={() => void controller.startLogin()}
            pending={controller.authLoginPending}
          />
        ) : null}
        <Composer
          active={false}
          disabled={
            controller.runtime.phase !== "ready" ||
            !controller.bootstrapped ||
            (controller.requiresAuth && !controller.account)
          }
          models={controller.models}
          onInterrupt={controller.interrupt}
          onSubmit={controller.submitPrompt}
          onToast={(message) => controller.addToast(message)}
          placeholder="Plan, Build, / for skills, @ for context"
          preferences={controller.preferences}
          updatePreferences={controller.updatePreferences}
        />
        <button
          className="new-task-connect"
          onClick={() => void controller.chooseWorkspace()}
        >
          <Github size={13} /> Connect Your Repos
        </button>
      </div>
      {tipVisible ? (
        <div className="new-task-tip">
          <span>{NEW_TASK_TIPS[tipIndex]}</span>
          <button aria-label="Hide tips" onClick={() => setTipVisible(false)}>
            <X size={12} />
          </button>
        </div>
      ) : null}
    </main>
  );
}
