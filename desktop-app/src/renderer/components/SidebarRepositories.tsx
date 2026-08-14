import {
  Archive,
  ChevronDown,
  FolderOpen,
  FolderPlus,
  ListFilter,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Thread } from "../../shared/types";
import { MenuItem, MenuLabel, MenuSurface } from "../design-system";
import type { AppView } from "../state/useCodexController";
import { RepositoryContextMenu } from "./RepositoryContextMenu";
import {
  buildSidebarGroups,
  filterSidebarGroups,
  sidebarThreadTitle,
  type SidebarGrouping,
} from "./sidebar-repositories";
import { SidebarRow } from "./SidebarRow";
import { useRepositorySidebarState } from "./useRepositorySidebarState";

type SidebarRepositoriesProps = {
  activeThread: Thread | null;
  grouping: SidebarGrouping;
  hasMoreThreads: boolean;
  onArchive(thread: Thread): void;
  onChooseWorkspace(): void;
  onLoadMore(): void;
  onNewTaskInWorkspace(workspace: string): void;
  onRemoveWorkspaces(workspaces: string[]): void;
  onSelectThread(thread: Thread): void;
  onSetGrouping(grouping: SidebarGrouping): void;
  recentWorkspaces: string[];
  threads: Thread[];
  view: AppView;
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

export function SidebarRepositories({
  activeThread,
  grouping,
  hasMoreThreads,
  onArchive,
  onChooseWorkspace,
  onLoadMore,
  onNewTaskInWorkspace,
  onRemoveWorkspaces,
  onSelectThread,
  onSetGrouping,
  recentWorkspaces,
  threads,
  view,
}: SidebarRepositoriesProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const {
    closeRepositoryMenu,
    hasUnread,
    markAllRead,
    openRepositoryMenu,
    removeRepository,
    repositoryMenu,
    visibleRecentWorkspaces,
    visibleThreads,
  } = useRepositorySidebarState({
    onRemoveWorkspaces,
    recentWorkspaces,
    threads,
  });
  const groups = useMemo(
    () => buildSidebarGroups(grouping, visibleRecentWorkspaces, visibleThreads),
    [grouping, visibleRecentWorkspaces, visibleThreads],
  );
  const filteredGroups = useMemo(
    () => filterSidebarGroups(groups, repositoryFilter),
    [groups, repositoryFilter],
  );

  return (
    <>
      <div
        className="sidebar-section-header"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setCustomizeOpen(false);
          }
        }}
      >
        <span>Repositories</span>
        <div>
          <button
            aria-expanded={customizeOpen}
            aria-haspopup="menu"
            aria-label="Filter and group repositories"
            aria-pressed={Boolean(repositoryFilter.trim())}
            className={`icon-button subtle ${repositoryFilter.trim() ? "active" : ""}`}
            onClick={() => setCustomizeOpen((current) => !current)}
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
          {customizeOpen ? (
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
                    setCustomizeOpen(false);
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
                  setCustomizeOpen(false);
                }}
              >
                Collapse All
              </MenuItem>
              <MenuItem
                role="menuitem"
                onClick={() => {
                  setRepositoryFilter("");
                  setCustomizeOpen(false);
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
          const workspaces = Array.from(
            new Set(
              [
                group.workspace,
                ...group.threads.map((thread) => thread.cwd),
              ].filter((workspace): workspace is string => Boolean(workspace)),
            ),
          );
          const repositoryActionsAvailable =
            grouping === "repository" || grouping === "workspace";
          return (
            <section className="repository-group" key={key}>
              <div className="repository-heading-row">
                <SidebarRow
                  aria-expanded={!isCollapsed}
                  aria-haspopup={
                    repositoryActionsAvailable ? "menu" : undefined
                  }
                  icon={<FolderOpen size={14} />}
                  label={group.label}
                  onContextMenu={
                    repositoryActionsAvailable
                      ? (event) => {
                          event.preventDefault();
                          openRepositoryMenu({
                            key,
                            label: group.label,
                            position: { x: event.clientX, y: event.clientY },
                            threads: group.threads,
                            workspaces,
                          });
                        }
                      : undefined
                  }
                  onKeyDown={
                    repositoryActionsAvailable
                      ? (event) => {
                          if (
                            event.key !== "ContextMenu" &&
                            !(event.shiftKey && event.key === "F10")
                          ) {
                            return;
                          }
                          event.preventDefault();
                          const bounds =
                            event.currentTarget.getBoundingClientRect();
                          openRepositoryMenu({
                            key,
                            label: group.label,
                            position: { x: bounds.left + 20, y: bounds.bottom },
                            threads: group.threads,
                            workspaces,
                          });
                        }
                      : undefined
                  }
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

      {repositoryMenu ? (
        <RepositoryContextMenu
          hasUnread={hasUnread(repositoryMenu.key, repositoryMenu.threads)}
          label={repositoryMenu.label}
          onArchiveAll={() => {
            repositoryMenu.threads.forEach(onArchive);
            closeRepositoryMenu();
          }}
          onClose={closeRepositoryMenu}
          onMarkAllRead={markAllRead}
          onRemove={removeRepository}
          position={repositoryMenu.position}
        />
      ) : null}
    </>
  );
}
