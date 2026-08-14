import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Blocks,
  Bot,
  CircleHelp,
  Keyboard,
  LoaderCircle,
  LogIn,
  LogOut,
  PanelLeft,
  Search,
  Send,
  Settings,
  Slack,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import type { Account, Thread } from "../../shared/types";
import referenceAvatarUrl from "../assets/reference-avatar.png";
import { MenuItem, MenuSeparator, MenuSurface } from "../design-system";
import type { AppView } from "../state/useCodexController";
import { CodexMark } from "./CodexMark";
import type { SidebarGrouping } from "./sidebar-repositories";
import { SidebarRow } from "./SidebarRow";
import { SidebarRepositories } from "./SidebarRepositories";

export type { SidebarGrouping } from "./sidebar-repositories";

type SidebarProps = {
  account: Account | null;
  activeThread: Thread | null;
  onArchive(thread: Thread): void;
  hasMoreThreads: boolean;
  onChooseWorkspace(): void;
  onNewTask(): void;
  onNewTaskInWorkspace(workspace: string): void;
  onRemoveWorkspaces(workspaces: string[]): void;
  onLoadMore(): void;
  onLogout(): void;
  onSearch(): void;
  onSelectThread(thread: Thread): void;
  onSetGrouping(grouping: SidebarGrouping): void;
  onSetView(view: AppView): void;
  onSignIn(): void;
  onToggle(): void;
  recentWorkspaces: string[];
  threads: Thread[];
  view: AppView;
  grouping: SidebarGrouping;
  signingIn: boolean;
};

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
  onRemoveWorkspaces,
  onLoadMore,
  onLogout,
  onSearch,
  onSelectThread,
  onSetGrouping,
  onSetView,
  onSignIn,
  onToggle,
  recentWorkspaces,
  threads,
  view,
  grouping,
  signingIn,
}: SidebarProps) {
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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

      <SidebarRepositories
        activeThread={activeThread}
        grouping={grouping}
        hasMoreThreads={hasMoreThreads}
        onArchive={onArchive}
        onChooseWorkspace={onChooseWorkspace}
        onLoadMore={onLoadMore}
        onNewTaskInWorkspace={onNewTaskInWorkspace}
        onRemoveWorkspaces={onRemoveWorkspaces}
        onSelectThread={onSelectThread}
        onSetGrouping={onSetGrouping}
        recentWorkspaces={recentWorkspaces}
        threads={threads}
        view={view}
      />

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
              {!account ? (
                <MenuItem
                  onClick={() => {
                    onSignIn();
                    setAccountMenuOpen(false);
                  }}
                >
                  {signingIn ? (
                    <LoaderCircle className="spin" size={13} />
                  ) : (
                    <LogIn aria-hidden="true" size={13} />
                  )}
                  {signingIn ? "Open browser again" : "Sign in with ChatGPT"}
                </MenuItem>
              ) : (
                <>
                  {(
                    [
                      ["Create Profile", UserRound],
                      ["Get Codex for iOS", Smartphone],
                      ["Docs", BookOpen],
                      ["Shortcuts", Keyboard],
                      ["Contact Us", CircleHelp],
                    ] as const
                  ).map(([item, Icon]) => (
                    <MenuItem
                      key={item}
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <Icon aria-hidden="true" size={13} />
                      {item}
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuItem
                    onClick={() => {
                      onLogout();
                      setAccountMenuOpen(false);
                    }}
                  >
                    <LogOut aria-hidden="true" size={13} />
                    Log out
                  </MenuItem>
                </>
              )}
            </MenuSurface>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
