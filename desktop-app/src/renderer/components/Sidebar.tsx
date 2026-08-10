import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Blocks,
  Bot,
  ChevronDown,
  FolderOpen,
  FolderPlus,
  ListFilter,
  PanelLeft,
  Search,
  Send,
  Settings,
  Slack,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Account, Thread } from "../../shared/types";
import referenceAvatarUrl from "../assets/reference-avatar.png";
import type { AppView } from "../state/useCodexController";
import { CodexMark } from "./CodexMark";

type SidebarProps = {
  account: Account | null;
  activeThread: Thread | null;
  onArchive(thread: Thread): void;
  hasMoreThreads: boolean;
  onChooseWorkspace(): void;
  onNewTask(): void;
  onLoadMore(): void;
  onSearch(): void;
  onSelectThread(thread: Thread): void;
  onSetView(view: AppView): void;
  onToggle(): void;
  recentWorkspaces: string[];
  threads: Thread[];
  view: AppView;
};

function repositoryName(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1_000 - timestamp));
  if (seconds < 60) return "now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  if (seconds < 2_629_800) return `${Math.floor(seconds / 604_800)}w`;
  if (seconds < 31_557_600) return `${Math.floor(seconds / 2_629_800)}mo`;
  return `${Math.floor(seconds / 31_557_600)}y`;
}

function accountLabel(account: Account | null): {
  primary: string;
  secondary: string;
} {
  if (!account)
    return { primary: "Sign in", secondary: "Connect your account" };
  if (account.type === "chatgpt") {
    return {
      primary: account.email?.split("@")[0] ?? "ChatGPT account",
      secondary: account.planType
        ? `${account.planType.charAt(0).toUpperCase()}${account.planType.slice(1)} Plan`
        : "ChatGPT",
    };
  }
  if (account.type === "apiKey")
    return { primary: "API key", secondary: "OpenAI Platform" };
  return { primary: "Amazon Bedrock", secondary: "Connected" };
}

export function Sidebar({
  account,
  activeThread,
  hasMoreThreads,
  onArchive,
  onChooseWorkspace,
  onNewTask,
  onLoadMore,
  onSearch,
  onSelectThread,
  onSetView,
  onToggle,
  recentWorkspaces,
  threads,
  view,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const entries = new Map<string, Thread[]>();
    for (const thread of threads) {
      const current = entries.get(thread.cwd) ?? [];
      current.push(thread);
      entries.set(thread.cwd, current);
    }
    for (const cwd of recentWorkspaces) {
      if (!entries.has(cwd)) entries.set(cwd, []);
    }
    return [...entries.entries()];
  }, [recentWorkspaces, threads]);
  const identity = accountLabel(account);
  const referenceCapture =
    new URLSearchParams(window.location.search).get("reference") === "cursor";

  return (
    <aside className="sidebar">
      <div className="sidebar-drag-region">
        <div className="brand-lockup">
          <CodexMark size={19} />
          <span>Codex</span>
        </div>
        <button
          aria-label="Hide sidebar"
          className="icon-button subtle"
          onClick={onToggle}
        >
          <PanelLeft size={16} />
        </button>
        <div className="sidebar-history-controls">
          <button
            aria-label="Back to new chat"
            className="icon-button subtle"
            onClick={onNewTask}
          >
            <ArrowLeft size={16} />
          </button>
          <button aria-label="Forward" className="icon-button subtle" disabled>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <nav aria-label="Primary" className="primary-nav">
        <button className={view === "new" ? "active" : ""} onClick={onNewTask}>
          <Send size={14} />
          <span>New Chat</span>
          <kbd>⌘N</kbd>
        </button>
        <button onClick={onSearch}>
          <Search size={14} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <button
          className={view === "automations" ? "active" : ""}
          onClick={() => onSetView("automations")}
        >
          <Bot size={14} />
          <span>Automations</span>
        </button>
        <button
          className={view === "customize" ? "active" : ""}
          onClick={() => onSetView("customize")}
        >
          <Blocks size={15} />
          <span>Customize</span>
        </button>
      </nav>

      <div className="sidebar-section-header">
        <span>Repositories</span>
        <div>
          <button
            aria-label="Filter repositories and tasks"
            className="icon-button subtle"
            onClick={onSearch}
          >
            <ListFilter size={14} />
          </button>
          <button
            aria-label="Open repository"
            className="icon-button subtle"
            onClick={onChooseWorkspace}
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      <div className="repository-list">
        {groups.map(([cwd, repositoryThreads]) => {
          const isCollapsed = collapsed.has(cwd);
          return (
            <section className="repository-group" key={cwd}>
              <button
                className="repository-heading"
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(cwd)) next.delete(cwd);
                    else next.add(cwd);
                    return next;
                  })
                }
                title={cwd}
              >
                <FolderOpen size={14} />
                <span>{repositoryName(cwd)}</span>
                <ChevronDown
                  className={isCollapsed ? "collapsed" : ""}
                  size={13}
                />
              </button>
              {!isCollapsed ? (
                <div className="thread-list">
                  {repositoryThreads.length === 0 ? (
                    <div className="repository-empty">No agents yet</div>
                  ) : null}
                  {repositoryThreads.map((thread) => (
                    <div
                      className={`thread-row ${activeThread?.id === thread.id && view === "thread" ? "active" : ""}`}
                      key={thread.id}
                    >
                      <button
                        className="thread-main"
                        onClick={() => onSelectThread(thread)}
                      >
                        <span className="thread-title">
                          {thread.name || thread.preview || "Untitled task"}
                        </span>
                        <time>
                          {timeAgo(thread.recencyAt ?? thread.updatedAt)}
                        </time>
                      </button>
                      <button
                        aria-label="Archive task"
                        className="thread-archive"
                        onClick={() => onArchive(thread)}
                        title="Archive task"
                      >
                        <Archive size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
        {groups.length === 0 ? (
          <button className="empty-repositories" onClick={onChooseWorkspace}>
            <FolderPlus size={18} />
            <span>Open a repository to begin</span>
          </button>
        ) : null}
        {hasMoreThreads ? (
          <button className="load-more-threads" onClick={onLoadMore}>
            Load older tasks
          </button>
        ) : null}
      </div>

      <div className="sidebar-footer">
        <div className="onboarding-card">
          <div>
            <span>Getting Started</span>
            <small>
              2/3 <i aria-hidden="true" />
            </small>
          </div>
          <button onClick={() => onSetView("customize")}>
            <Slack size={14} />
            Connect Slack
          </button>
        </div>
        <button className="account-row" onClick={() => onSetView("settings")}>
          <span className="avatar">
            {referenceCapture ? (
              <img alt="" src={referenceAvatarUrl} />
            ) : (
              identity.primary.charAt(0).toUpperCase()
            )}
          </span>
          <span>
            <strong>{identity.primary}</strong>
            <small>{identity.secondary}</small>
          </span>
          <Settings size={14} />
        </button>
      </div>
    </aside>
  );
}
