import { X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { ThreadMenu } from "../features/thread/ThreadMenu";
import { ThreadSummaryPanel } from "../features/thread/ThreadSummaryPanel";
import { UsagePopover } from "../features/thread/UsagePopover";
import type { Route } from "../state/navigation";
import { useProductMode } from "../state/product-mode";
import {
  BackIcon,
  BottomPanelIcon,
  FolderIcon,
  ForwardIcon,
  NewChatIcon,
  RightPanelIcon,
  SidebarToggleIcon,
  SummaryListIcon,
  TemporaryChatIcon,
  TemporaryMemoryIcon,
} from "../ui/AppIcons";
import { IconButton } from "../ui/IconButton";

export function Titlebar({
  canGoBack,
  canGoForward,
  sidebarOpen,
  panelOpen,
  bottomPanelOpen,
  showBottomPanelControl,
  showThreadMenu,
  onBack,
  onForward,
  onNewTask,
  onOpenFiles,
  onTogglePanel,
  onToggleBottom,
  onToggleSidebar,
  onToggleSummary,
  onOpenScheduledTask,
  onOpenSideChat,
  onOpenUsageSettings,
  route,
  summaryOpen,
  title,
}: {
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  sidebarOpen: boolean;
  panelOpen: boolean;
  bottomPanelOpen: boolean;
  showBottomPanelControl: boolean;
  showThreadMenu: boolean;
  onBack(): void;
  onForward(): void;
  onNewTask(): void;
  onOpenFiles(): void;
  onTogglePanel(): void;
  onToggleBottom(): void;
  onToggleSidebar(): void;
  onToggleSummary(): void;
  onOpenScheduledTask(): void;
  onOpenSideChat(): void;
  onOpenUsageSettings(): void;
  route: Route;
  summaryOpen: boolean;
}) {
  const { chatGptMode, mode, setChatGptMode, setTemporaryChat, temporaryChat } =
    useProductMode();
  const [temporaryChatExplainerOpen, setTemporaryChatExplainerOpen] =
    useState(false);
  const [renameRequestId, setRenameRequestId] = useState(0);
  const showPanelControls = route.kind === "newTask" || route.kind === "thread";
  const isThread = route.kind === "thread";
  const showWorkModes = route.kind === "newTask" && mode === "work";

  return (
    <header
      className={`titlebar${isThread ? " titlebar--thread" : ""}${sidebarOpen ? "" : " titlebar--sidebar-collapsed"}`}
    >
      {!sidebarOpen && (
        <div className="titlebar__left">
          <div className="titlebar__navigation">
            <IconButton
              icon={SidebarToggleIcon}
              label="Show sidebar"
              onClick={onToggleSidebar}
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
          <IconButton icon={NewChatIcon} label="New chat" onClick={onNewTask} />
        </div>
      )}
      {isThread && (
        <div className="titlebar__thread">
          <FolderIcon aria-hidden="true" className="titlebar__thread-folder" />
          <button
            className="titlebar__thread-title"
            onClick={() => setRenameRequestId((value) => value + 1)}
            type="button"
          >
            {title}
          </button>
          <UsagePopover
            onOpenSettings={onOpenUsageSettings}
            threadId={route.threadId}
          />
          {showThreadMenu && (
            <ThreadMenu
              onOpenScheduledTask={onOpenScheduledTask}
              onOpenSideChat={onOpenSideChat}
              renameRequestId={renameRequestId}
            />
          )}
        </div>
      )}
      {showWorkModes && (
        <div
          aria-label="Composer mode"
          className="titlebar__work-modes"
          role="group"
        >
          <span aria-hidden="true" className="titlebar__work-modes-underlay" />
          <span
            aria-hidden="true"
            className={`titlebar__work-modes-selection titlebar__work-modes-selection--${chatGptMode}`}
          />
          <button
            aria-pressed={chatGptMode === "chat"}
            className={chatGptMode === "chat" ? "is-active" : ""}
            onClick={() => setChatGptMode("chat")}
            type="button"
          >
            Chat
          </button>
          <button
            aria-pressed={chatGptMode === "work"}
            className={chatGptMode === "work" ? "is-active" : ""}
            onClick={() => {
              setChatGptMode("work");
              setTemporaryChatExplainerOpen(false);
            }}
            type="button"
          >
            Work
          </button>
        </div>
      )}
      <div className="titlebar__actions">
        {showPanelControls && (
          <>
            {showWorkModes && chatGptMode === "chat" && (
              <IconButton
                className={temporaryChat ? "is-active" : ""}
                icon={TemporaryChatIcon}
                label={
                  temporaryChat
                    ? "Turn off temporary chat"
                    : "Turn on temporary chat"
                }
                onClick={() => {
                  if (temporaryChat) {
                    setTemporaryChat(false);
                    setTemporaryChatExplainerOpen(false);
                  } else {
                    setTemporaryChat(true);
                    setTemporaryChatExplainerOpen(true);
                  }
                }}
              />
            )}
            {isThread && (
              <IconButton
                className={summaryOpen ? "is-active" : ""}
                icon={SummaryListIcon}
                label="Toggle summary"
                onClick={onToggleSummary}
              />
            )}
            {!panelOpen && (
              <>
                {showBottomPanelControl && (
                  <IconButton
                    className={bottomPanelOpen ? "is-active" : ""}
                    icon={BottomPanelIcon}
                    label="Toggle bottom panel"
                    onClick={onToggleBottom}
                    shortcut="⌘J"
                  />
                )}
                <IconButton
                  icon={RightPanelIcon}
                  label="Toggle side panel"
                  onClick={onTogglePanel}
                  shortcut="⌥⌘B"
                />
              </>
            )}
          </>
        )}
      </div>
      {summaryOpen && isThread && (
        <ThreadSummaryPanel onOpenFiles={onOpenFiles} />
      )}
      {temporaryChatExplainerOpen &&
        createPortal(
          <div className="temporary-chat-backdrop">
            <section
              aria-label="Temporary Chat"
              aria-modal="true"
              className="temporary-chat-dialog"
              role="dialog"
            >
              <h2>Temporary Chat</h2>
              <div className="temporary-chat-dialog__feature">
                <TemporaryChatIcon aria-hidden="true" />
                <div>
                  <strong>Not in history</strong>
                  <p>Temporary chats won&apos;t appear in your history</p>
                </div>
              </div>
              <div className="temporary-chat-dialog__feature">
                <TemporaryMemoryIcon aria-hidden="true" />
                <div>
                  <strong>Memory off</strong>
                  <p>
                    While in a temporary chat, ChatGPT won&apos;t use or update
                    its memory. Custom instructions will still be followed if
                    you have them enabled.
                  </p>
                </div>
              </div>
              <button
                className="temporary-chat-dialog__continue"
                onClick={() => setTemporaryChatExplainerOpen(false)}
                type="button"
              >
                Continue
              </button>
            </section>
          </div>,
          document.body,
        )}
    </header>
  );
}
