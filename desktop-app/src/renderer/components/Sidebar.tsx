import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Blocks,
  Bot,
  CircleHelp,
  ChevronDown,
  FolderOpen,
  FolderPlus,
  Keyboard,
  ListFilter,
  LogOut,
  PanelLeft,
  Plus,
  Search,
  Send,
  Settings,
  Slack,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Account, Thread } from "../../shared/types";
import referenceAvatarUrl from "../assets/reference-avatar.png";
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSurface,
} from "../design-system";
import type { AppView } from "../state/useCodexController";
import { CodexMark } from "./CodexMark";
import {
  buildSidebarGroups,
  filterSidebarGroups,
  sidebarThreadTitle,
  type SidebarGrouping,
} from "./sidebar-repositories";
import { SidebarRow } from "./SidebarRow";

export type { SidebarGrouping } from "./sidebar-repositories";

type SidebarProps = {
  account: Account | null;
  activeThread: Thread | null;
  onArchive(thread: Thread): void;
  hasMoreThreads: boolean;
  onChooseWorkspace(): void;
  onNewTask(): void;
  onNewTaskInWorkspace(workspace: string): void;
  onLoadMore(): void;
  onSearch(): void;
  onSelectThread(thread: Thread): void;
  onSetGrouping(grouping: SidebarGrouping): void;
  onSetView(view: AppView): void;
  onToggle(): void;
  recentWorkspaces: string[];
  threads: Thread[];
  view: AppView;
  grouping: SidebarGrouping;
};

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
  onNewTaskInWorkspace,
  onLoadMore,
  onSearch,
  onSelectThread,
  onSetGrouping,
  onSetView,
  onToggle,
  recentWorkspaces,
  threads,
  view,
  grouping,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [sidebarCustomizeOpen, setSidebarCustomizeOpen] = useState(false);
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const groups = useMemo(
    () => buildSidebarGroups(grouping, recentWorkspaces, threads),
    [grouping, recentWorkspaces, threads],
  );
  const filteredGroups = useMemo(
    () => filterSidebarGroups(groups, repositoryFilter),
    [groups, repositoryFilter],
  );
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
          aria-label="Hide Sidebar"
          className="icon-button subtle sidebar-toggle-button"
          onClick={onToggle}
        >
          <PanelLeft size={16} />
        </button>
        <div className="sidebar-history-controls">
          <button
            aria-label="Go Back"
            className="icon-button subtle"
            onClick={onNewTask}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            aria-label="Go Forward"
            className="icon-button subtle"
            disabled
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <nav aria-label="Primary" className="primary-nav">
        <SidebarRow
          className={view === "new" ? "active" : ""}
          icon={<Send size={14} />}
          label="New Chat"
          meta={<kbd>⌘N</kbd>}
          onClick={onNewTask}
          variant="navigation"
        />
        <SidebarRow
          icon={<Search size={14} />}
          label="Search"
          meta={<kbd>⌘K</kbd>}
          onClick={onSearch}
          variant="navigation"
        />
        <SidebarRow
          className={view === "automations" ? "active" : ""}
          icon={<Bot size={14} />}
          label="Automations"
          onClick={() => onSetView("automations")}
          variant="navigation"
        />
        <SidebarRow
          className={view === "customize" ? "active" : ""}
          icon={<Blocks size={14} />}
          label="Customize"
          onClick={() => onSetView("customize")}
          variant="navigation"
        />
      </nav>

      <div
        className="sidebar-section-header"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setSidebarCustomizeOpen(false);
          }
        }}
      >
        <span>Repositories</span>
        <div>
          <button
            aria-expanded={sidebarCustomizeOpen}
            aria-haspopup="menu"
            aria-label="Filter and group repositories"
            aria-pressed={Boolean(repositoryFilter.trim())}
            className={`icon-button subtle ${repositoryFilter.trim() ? "active" : ""}`}
            onClick={() => setSidebarCustomizeOpen((current) => !current)}
          >
            <ListFilter size={14} />
          </button>
          <button
            aria-haspopup="dialog"
            aria-label="Open Workspace"
            className="icon-button subtle"
            onClick={onChooseWorkspace}
          >
            <FolderPlus size={13} />
          </button>
          {sidebarCustomizeOpen ? (
            <MenuSurface
              aria-label="Sidebar filters"
              className="sidebar-customize-menu"
              role="menu"
            >
              <label className="sidebar-repository-filter">
                <Search aria-hidden="true" size={13} />
                <input
                  aria-label="Filter repositories and tasks"
                  autoFocus
                  onChange={(event) => setRepositoryFilter(event.target.value)}
                  placeholder="Filter repositories"
                  type="search"
                  value={repositoryFilter}
                />
              </label>
              <MenuLabel>Group by</MenuLabel>
              {(
                [
                  ["workspace", "Group by Workspace"],
                  ["repository", "Group by Repository"],
                  ["updated", "Group by Updated"],
                  ["status", "Group by Status"],
                  ["environment", "Group by Environment"],
                ] as const
              ).map(([value, label]) => (
                <MenuItem
                  aria-checked={grouping === value}
                  key={value}
                  role="menuitemradio"
                  onClick={() => {
                    onSetGrouping(value);
                    setSidebarCustomizeOpen(false);
                  }}
                >
                  {label}
                </MenuItem>
              ))}
              <MenuLabel>Actions</MenuLabel>
              <MenuItem
                role="menuitem"
                onClick={() => {
                  setCollapsed(new Set(filteredGroups.map(([key]) => key)));
                  setSidebarCustomizeOpen(false);
                }}
              >
                Collapse All
              </MenuItem>
              <MenuItem
                role="menuitem"
                onClick={() => {
                  setRepositoryFilter("");
                  setSidebarCustomizeOpen(false);
                }}
              >
                Clear Filter
              </MenuItem>
            </MenuSurface>
          ) : null}
        </div>
      </div>

      <div className="repository-list">
        {filteredGroups.map(([key, group]) => {
          const isCollapsed = collapsed.has(key);
          return (
            <section className="repository-group" key={key}>
              <div className="repository-heading-row">
                <SidebarRow
                  aria-expanded={!isCollapsed}
                  icon={<FolderOpen size={14} />}
                  label={group.label}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  trailing={
                    <ChevronDown
                      className={isCollapsed ? "collapsed" : ""}
                      size={13}
                    />
                  }
                  title={group.label}
                  variant="repository"
                />
                {group.workspace ? (
                  <button
                    aria-label={`New chat in ${group.label}`}
                    className="repository-new-task"
                    onClick={() => onNewTaskInWorkspace(group.workspace!)}
                    title={`New chat in ${group.label}`}
                  >
                    <Plus aria-hidden="true" size={15} />
                  </button>
                ) : null}
              </div>
              {!isCollapsed ? (
                <div className="thread-list">
                  {group.threads.length === 0 ? (
                    <div className="repository-empty">No agents yet</div>
                  ) : null}
                  {group.threads.map((thread) => (
                    <div
                      className={`thread-row ${activeThread?.id === thread.id && view === "thread" ? "active" : ""}`}
                      key={thread.id}
                    >
                      <SidebarRow
                        className="thread-main"
                        label={
                          <span className="thread-title">
                            {sidebarThreadTitle(thread)}
                          </span>
                        }
                        meta={
                          <time>
                            {timeAgo(thread.recencyAt ?? thread.updatedAt)}
                          </time>
                        }
                        onClick={() => onSelectThread(thread)}
                        variant="thread"
                      />
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
        {groups.length > 0 && filteredGroups.length === 0 ? (
          <div className="repository-filter-empty">
            No matching repositories or tasks
          </div>
        ) : null}
        {hasMoreThreads ? (
          <button className="load-more-threads" onClick={onLoadMore}>
            Load older tasks
          </button>
        ) : null}
      </div>

      <div className="sidebar-footer">
        {onboardingVisible ? (
          <div className="onboarding-card">
            <div>
              <span>Getting Started</span>
              <small>
                2/3 <i aria-hidden="true" />
              </small>
              <button
                aria-label="Skip step 2 of 3"
                className="onboarding-skip"
                onClick={() => setOnboardingVisible(false)}
                title="Skip step 2 of 3"
              >
                ×
              </button>
            </div>
            <button onClick={() => onSetView("customize")}>
              <Slack size={14} />
              Connect Slack
            </button>
          </div>
        ) : null}
        <div className="account-controls">
          <button
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
            className="account-row"
            onClick={() => setAccountMenuOpen((current) => !current)}
          >
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
          </button>
          <button
            aria-label="Settings"
            aria-pressed={false}
            className="account-settings-button"
            onClick={() => {
              setAccountMenuOpen(false);
              onSetView("settings");
            }}
            title="Settings"
          >
            <Settings size={14} />
          </button>
          {accountMenuOpen ? (
            <MenuSurface className="account-menu" role="menu">
              {(
                [
                  ["Create Profile", UserRound],
                  ["Get Cursor for iOS", Smartphone],
                  ["Docs", BookOpen],
                  ["Shortcuts", Keyboard],
                  ["Contact Us", CircleHelp],
                  ["Log Out", LogOut],
                ] as const
              ).map(([item, Icon], index) => (
                <div key={item}>
                  {index === 5 ? <MenuSeparator /> : null}
                  <MenuItem
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Icon aria-hidden="true" size={13} />
                    {item}
                  </MenuItem>
                </div>
              ))}
            </MenuSurface>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
