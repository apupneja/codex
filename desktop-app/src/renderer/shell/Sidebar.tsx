import { useEffect, useMemo, useState } from "react";

import type { Thread } from "../../shared/protocol";
import { ProjectCreateDialog } from "../features/projects/ProjectCreateDialog";
import { projectContainsPath } from "../features/projects/project-paths";
import { useProductMode } from "../state/product-mode";
import type { Route } from "../state/navigation";
import { useSession } from "../state/session";
import { isThreadPinned, subscribeToThreadPins } from "../state/thread-pins";
import {
  BackIcon,
  ForwardIcon,
  HelpIcon,
  ModeCheckIcon,
  NewChatIcon,
  PluginsIcon,
  ProfileLogoutIcon,
  ProfilePetIcon,
  PullRequestIcon,
  QuickChatIcon,
  ScheduledIcon,
  SearchIcon,
  SettingsIcon,
  SidebarChevronIcon,
  SidebarToggleIcon,
  SummaryAddIcon,
} from "../ui/AppIcons";
import { IconButton } from "../ui/IconButton";
import { SidebarOptionsMenu } from "./SidebarOptionsMenu";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarThreadRow, threadTitle } from "./SidebarThreadRow";

export function Sidebar({
  activeThreadBusy,
  activeRoute,
  canGoBack,
  canGoForward,
  onBack,
  onClose,
  onForward,
  onNavigate,
  onOpenQuickChat,
  onOpenThread,
  onShowPet,
  threads,
}: {
  activeThreadBusy: boolean;
  activeRoute: Route;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack(): void;
  onClose(): void;
  onForward(): void;
  onNavigate(route: Route): void;
  onOpenQuickChat(): void;
  onOpenThread(thread: Thread): void;
  onShowPet(): void;
  threads: Thread[];
}) {
  const { mode, setMode } = useProductMode();
  const { account, localProjects, logout, selectProject, selectedProjectId } =
    useSession();
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [recentsExpanded, setRecentsExpanded] = useState(true);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [pinRevision, setPinRevision] = useState(0);
  useEffect(
    () => subscribeToThreadPins(() => setPinRevision((value) => value + 1)),
    [],
  );
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? threads.filter((thread) =>
          threadTitle(thread).toLowerCase().includes(value),
        )
      : threads;
  }, [query, threads]);
  const projectThreadIds = useMemo(
    () =>
      new Set(
        filtered
          .filter((thread) =>
            localProjects.some((project) =>
              projectContainsPath(project.rootPaths, thread.cwd),
            ),
          )
          .map((thread) => thread.id),
      ),
    [filtered, localProjects],
  );
  const [pinnedThreads, recentThreads] = useMemo(
    () => [
      filtered.filter((thread) => isThreadPinned(thread.id)),
      filtered.filter(
        (thread) =>
          !isThreadPinned(thread.id) && !projectThreadIds.has(thread.id),
      ),
    ],
    [filtered, pinRevision, projectThreadIds],
  );
  const email = account?.email || "OpenAI account";
  const avatar =
    email === "OpenAI account" ? "P" : email.charAt(0).toUpperCase();

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-toolbar">
          <IconButton
            icon={SidebarToggleIcon}
            label="Hide sidebar"
            onClick={onClose}
          />
          <IconButton
            disabled={!canGoBack}
            icon={BackIcon}
            label="Back"
            onClick={onBack}
          />
          <IconButton
            disabled={!canGoForward}
            icon={ForwardIcon}
            label="Forward"
            onClick={onForward}
          />
        </div>

        <div className="sidebar-mode-row">
          <button
            aria-label={`Switch mode, current mode: ${mode === "work" ? "ChatGPT" : "Codex"}`}
            aria-expanded={modeMenuOpen}
            aria-haspopup="menu"
            className={`sidebar-mode sidebar-mode--${mode}`}
            onClick={() => setModeMenuOpen((value) => !value)}
            type="button"
          >
            <span>{mode === "work" ? "ChatGPT" : "Codex"}</span>
            <SidebarChevronIcon aria-hidden="true" />
          </button>
          <IconButton
            icon={SearchIcon}
            label="Search"
            onClick={() => setSearching((value) => !value)}
            size="sm"
          />
          {modeMenuOpen && (
            <div aria-label="Switch mode" className="mode-menu" role="menu">
              <button
                className="mode-menu__item"
                onClick={() => {
                  setMode("work");
                  setModeMenuOpen(false);
                  onNavigate({ kind: "newTask" });
                }}
                role="menuitem"
                type="button"
              >
                <span className="mode-menu__copy">
                  <strong>ChatGPT</strong>
                  <small>Create, learn, and explore</small>
                </span>
                {mode === "work" && <ModeCheckIcon aria-hidden="true" />}
              </button>
              <button
                className="mode-menu__item"
                onClick={() => {
                  setMode("codex");
                  setModeMenuOpen(false);
                  onNavigate({ kind: "newTask" });
                }}
                role="menuitem"
                type="button"
              >
                <span className="mode-menu__copy">
                  <strong>Codex</strong>
                  <small>Build, debug, and ship</small>
                </span>
                {mode === "codex" && <ModeCheckIcon aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>

        {mode === "work" ? (
          <button
            className="sidebar-new-chat sidebar-new-chat--work"
            onClick={() => onNavigate({ kind: "newTask" })}
            type="button"
          >
            <div className="sidebar-new-chat__content">
              <span className="sidebar-nav-icon">
                <NewChatIcon aria-hidden="true" />
              </span>
              <span>New chat</span>
            </div>
          </button>
        ) : (
          <div className="sidebar-new-chat">
            <button
              className="sidebar-new-chat__main"
              onClick={() => onNavigate({ kind: "newTask" })}
              type="button"
            >
              <NewChatIcon aria-hidden="true" />
              <span>New chat</span>
            </button>
            <button
              aria-label="Quick chat"
              className="sidebar-new-chat__quick"
              onClick={onOpenQuickChat}
              type="button"
            >
              <QuickChatIcon aria-hidden="true" />
            </button>
          </div>
        )}

        <nav
          aria-label={mode === "codex" ? "Codex" : "ChatGPT"}
          className="sidebar-primary-nav"
        >
          {mode === "codex" && (
            <button
              className={activeRoute.kind === "pullRequests" ? "is-active" : ""}
              onClick={() => onNavigate({ kind: "pullRequests" })}
              type="button"
            >
              <PullRequestIcon aria-hidden="true" />
              <span>Pull requests</span>
            </button>
          )}
          <button
            className={activeRoute.kind === "automations" ? "is-active" : ""}
            onClick={() => onNavigate({ kind: "automations" })}
            type="button"
          >
            <div className="sidebar-primary-nav__content">
              <span className="sidebar-nav-icon">
                <ScheduledIcon aria-hidden="true" />
              </span>
              <span>Scheduled</span>
            </div>
          </button>
          <button
            className={activeRoute.kind === "skills" ? "is-active" : ""}
            onClick={() => onNavigate({ kind: "skills" })}
            type="button"
          >
            <div className="sidebar-primary-nav__content">
              <span className="sidebar-nav-icon">
                <PluginsIcon aria-hidden="true" />
              </span>
              <span>
                <span className="sidebar-primary-nav__label">Plugins</span>
              </span>
            </div>
          </button>
        </nav>

        {searching && (
          <label className="sidebar-search">
            <SearchIcon aria-hidden="true" />
            <input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats"
              value={query}
            />
          </label>
        )}

        {mode === "work" ? (
          <div aria-label="Loading chats" className="sidebar-work-skeletons">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            {pinnedThreads.length > 0 && (
              <ThreadSection
                activeThreadBusy={activeThreadBusy}
                activeRoute={activeRoute}
                label="Pinned"
                onOpenThread={onOpenThread}
                threads={pinnedThreads}
                variant="pinned"
              />
            )}
            <section className="sidebar-section sidebar-section--projects">
              <header>
                <button
                  aria-expanded={projectsExpanded}
                  className="sidebar-section__toggle"
                  onClick={() => setProjectsExpanded((value) => !value)}
                  type="button"
                >
                  <span>Projects</span>
                  <SidebarChevronIcon aria-hidden="true" />
                </button>
                <span className="sidebar-section__actions">
                  <SidebarOptionsMenu kind="projects" />
                  <IconButton
                    icon={SummaryAddIcon}
                    label="Add new project"
                    onClick={() => setCreateProjectOpen(true)}
                    size="sm"
                  />
                </span>
              </header>
              {projectsExpanded &&
                (localProjects.length === 0 ? (
                  <p>No projects</p>
                ) : (
                  <SidebarProjects
                    activeRoute={activeRoute}
                    activeThreadBusy={activeThreadBusy}
                    onNavigate={onNavigate}
                    onOpenThread={onOpenThread}
                    projects={localProjects}
                    selectedProjectId={selectedProjectId}
                    selectProject={selectProject}
                    threads={filtered.filter(
                      (thread) => !isThreadPinned(thread.id),
                    )}
                  />
                ))}
            </section>

            <section className="sidebar-section sidebar-section--recents">
              <header>
                <button
                  aria-expanded={recentsExpanded}
                  className="sidebar-section__toggle"
                  onClick={() => setRecentsExpanded((value) => !value)}
                  type="button"
                >
                  <span>Recents</span>
                  <SidebarChevronIcon aria-hidden="true" />
                </button>
                <span className="sidebar-section__actions">
                  <SidebarOptionsMenu kind="chats" />
                  <IconButton
                    icon={NewChatIcon}
                    label="New chat"
                    onClick={() => onNavigate({ kind: "newTask" })}
                    size="sm"
                  />
                </span>
              </header>
              {recentsExpanded && (
                <div className="sidebar-threads" aria-label="Recent chats">
                  {recentThreads.length === 0 ? (
                    <p>No chats</p>
                  ) : (
                    recentThreads.map((thread) => (
                      <SidebarThreadRow
                        busy={
                          activeThreadBusy &&
                          activeRoute.kind === "thread" &&
                          activeRoute.threadId === thread.id
                        }
                        activeRoute={activeRoute}
                        key={thread.id}
                        onOpenThread={onOpenThread}
                        thread={thread}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          </>
        )}

        <div className="sidebar-bottom">
          {profileMenuOpen && (
            <div aria-label="Account" className="profile-menu" role="menu">
              <div className="profile-menu__identity" role="menuitem">
                <span className="profile-menu__avatar">{avatar}</span>
                <span>{email}</span>
              </div>
              <div className="profile-menu__divider" />
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  onShowPet();
                }}
                role="menuitem"
                type="button"
              >
                <ProfilePetIcon aria-hidden="true" />
                <span>Show pet</span>
              </button>
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  onNavigate({ kind: "settings" });
                }}
                role="menuitem"
                type="button"
              >
                <SettingsIcon aria-hidden="true" />
                <span>Settings</span>
                <kbd>⌘,</kbd>
              </button>
              <button
                onClick={() => void logout()}
                role="menuitem"
                type="button"
              >
                <ProfileLogoutIcon aria-hidden="true" />
                <span>Log out</span>
              </button>
            </div>
          )}
          <button
            aria-label="Open profile menu"
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            className={`sidebar-settings${profileMenuOpen ? " is-active" : ""}`}
            onClick={() => setProfileMenuOpen((value) => !value)}
            type="button"
          >
            <SettingsIcon aria-hidden="true" />
            <span>Settings</span>
          </button>
          <IconButton
            icon={HelpIcon}
            label="Open help menu"
            onClick={() =>
              void window.chatgptDesktop.openExternal("https://help.openai.com")
            }
          />
        </div>
      </aside>
      {createProjectOpen && (
        <ProjectCreateDialog onClose={() => setCreateProjectOpen(false)} />
      )}
    </>
  );
}

function ThreadSection({
  activeThreadBusy,
  activeRoute,
  label,
  onOpenThread,
  threads,
  variant,
}: {
  activeThreadBusy: boolean;
  activeRoute: Route;
  label: string;
  onOpenThread(thread: Thread): void;
  threads: Thread[];
  variant: "pinned";
}) {
  return (
    <section className={`sidebar-section sidebar-section--${variant}`}>
      <header>
        <span>{label}</span>
      </header>
      <div className="sidebar-threads">
        {threads.map((thread) => (
          <SidebarThreadRow
            busy={
              activeThreadBusy &&
              activeRoute.kind === "thread" &&
              activeRoute.threadId === thread.id
            }
            activeRoute={activeRoute}
            key={thread.id}
            onOpenThread={onOpenThread}
            thread={thread}
          />
        ))}
      </div>
    </section>
  );
}
