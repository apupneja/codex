import {
  Archive,
  Box,
  Clock3,
  ExternalLink,
  Laptop,
  LoaderCircle,
  MoreHorizontal,
  PanelRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MenuItem, MenuSurface, useDismissibleLayer } from "../design-system";
import type { CodexController } from "../state/useCodexController";
import { ConversationComposerDock } from "./ConversationComposerDock";
import { ConversationTurn } from "./ConversationTurn";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { ThreadChanges } from "./ThreadChanges";
import { useEnvironmentPanelLayout } from "./useEnvironmentPanelLayout";

type ConversationViewProps = {
  changesOpen: boolean;
  controller: CodexController;
  narrowLayout: boolean;
  onOpenChange(path: string): void;
  onOpenFile(path: string): void;
  onOpenTerminal(): void;
  onShowChanges(): void;
  onToggleWorkspace(): void;
  workspaceVisible: boolean;
};

export function ConversationView({
  changesOpen,
  controller,
  narrowLayout,
  onOpenChange,
  onOpenFile,
  onOpenTerminal,
  onShowChanges,
  onToggleWorkspace,
  workspaceVisible,
}: ConversationViewProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const menuLayer = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [environmentOpen, setEnvironmentOpen] = useState(() => !narrowLayout);
  const [menuOpen, setMenuOpen] = useState(false);
  const environmentLayout = useEnvironmentPanelLayout(stage);
  useDismissibleLayer({
    active: menuOpen,
    layerRef: menuLayer,
    onDismiss: () => setMenuOpen(false),
  });
  const referenceCapture =
    new URLSearchParams(window.location.search).get("reference") === "cursor";
  const deviceLabel =
    controller.runtime.initialized?.platformOs === "macos"
      ? "This Mac"
      : controller.runtime.initialized?.platformOs === "windows"
        ? "This PC"
        : "This computer";

  useEffect(() => {
    if (narrowLayout) setEnvironmentOpen(false);
  }, [narrowLayout]);

  useEffect(() => {
    if (environmentLayout.mode === "drawer") setEnvironmentOpen(false);
  }, [environmentLayout.mode]);

  useEffect(() => {
    if (referenceCapture) {
      scroll.current?.scrollTo({ top: 0 });
      return;
    }
    if (!pinned.current) return;
    const frame = window.requestAnimationFrame(() => {
      const node = scroll.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
      setAtBottom(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [controller.items, controller.activeTurn?.id, referenceCapture]);

  return (
    <main
      className={`conversation-view ${environmentOpen ? `environment-${environmentLayout.mode}` : ""}`}
    >
      <header className="workbench-header conversation-header">
        <button
          className="chat-title"
          onClick={() => {
            const thread = controller.activeThread;
            if (!thread) return;
            const name = window.prompt("Rename task", controller.activeTitle);
            if (name) void controller.renameThread(thread, name);
          }}
          title="Rename task"
        >
          <span>{controller.activeTitle}</span>
          <Laptop size={12} />
        </button>
        <div className="header-actions" ref={menuLayer}>
          <button className="header-button" onClick={onToggleWorkspace}>
            IDE <ExternalLink size={12} />
          </button>
          <button
            aria-controls="environment-panel"
            aria-expanded={environmentOpen}
            aria-label="Toggle Environment"
            className="icon-button subtle"
            onClick={() => setEnvironmentOpen((open) => !open)}
            title="Environment"
          >
            <Box size={15} />
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
          {menuOpen && controller.activeThread ? (
            <MenuSurface className="task-actions-menu" role="menu">
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Split down is available in the IDE workspace.",
                  );
                  setMenuOpen(false);
                }}
              >
                <span>Split Down</span>
                <kbd>⇧⌘D</kbd>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Split right is available in the IDE workspace.",
                  );
                  setMenuOpen(false);
                }}
              >
                <span>Split Right</span>
                <kbd>⌘D</kbd>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Task pinning is not persisted by this app server yet.",
                  );
                  setMenuOpen(false);
                }}
              >
                Pin
              </MenuItem>
              <MenuItem
                onClick={() => {
                  const thread = controller.activeThread;
                  if (thread) {
                    const name = window.prompt(
                      "Rename task",
                      controller.activeTitle,
                    );
                    if (name) void controller.renameThread(thread, name);
                  }
                  setMenuOpen(false);
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Unread state is managed by the app server.",
                  );
                  setMenuOpen(false);
                }}
              >
                Mark as Unread
              </MenuItem>
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Forking keeps the current task context in a new task.",
                  );
                  setMenuOpen(false);
                  controller.newTask();
                }}
              >
                Fork
              </MenuItem>
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Move to is available when multiple workspaces are connected.",
                  );
                  setMenuOpen(false);
                }}
              >
                Move to
              </MenuItem>
              <MenuItem
                onClick={() => {
                  void navigator.clipboard
                    .writeText(
                      `codex://threads/${controller.activeThread?.id ?? ""}`,
                    )
                    .then(() =>
                      controller.addToast("Task link copied", "success"),
                    )
                    .catch((error: unknown) =>
                      controller.addToast(
                        error instanceof Error ? error.message : String(error),
                        "danger",
                      ),
                    );
                  setMenuOpen(false);
                }}
              >
                Copy
              </MenuItem>
              <MenuItem
                onClick={() => {
                  controller.addToast(
                    "Export is not available in this local app server yet.",
                  );
                  setMenuOpen(false);
                }}
              >
                Export
              </MenuItem>
              <MenuItem
                destructive
                onClick={() => {
                  const thread = controller.activeThread;
                  if (thread) void controller.archiveThread(thread);
                  setMenuOpen(false);
                }}
              >
                <Archive size={13} /> Archive
              </MenuItem>
            </MenuSurface>
          ) : null}
        </div>
      </header>
      <div className="conversation-stage" ref={stage}>
        <div className="conversation-main">
          <div
            className="conversation-scroll"
            onScroll={(event) => {
              const node = event.currentTarget;
              const nextAtBottom =
                node.scrollHeight - node.scrollTop - node.clientHeight < 64;
              pinned.current = nextAtBottom;
              setAtBottom(nextAtBottom);
            }}
            ref={scroll}
          >
            <div className="conversation-content">
              {controller.turnsNextCursor ? (
                <button
                  className="load-older-turns"
                  disabled={controller.loadingThread}
                  onClick={() => void controller.loadOlderTurns()}
                >
                  {controller.loadingThread ? (
                    <LoaderCircle className="spin" size={13} />
                  ) : (
                    <Clock3 size={13} />
                  )}
                  Load older activity
                </button>
              ) : null}
              {controller.activeThread?.turns.map((turn) => (
                <ConversationTurn
                  controller={controller}
                  key={turn.id}
                  onOpenChange={onOpenChange}
                  onOpenFile={onOpenFile}
                  turn={turn}
                />
              ))}
              {controller.loadingThread ? (
                <div className="conversation-loading">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              <ThreadChanges
                items={controller.items}
                onOpenChange={onOpenChange}
                onReview={onShowChanges}
              />
            </div>
          </div>
          <ConversationComposerDock
            atBottom={atBottom}
            changesOpen={changesOpen}
            controller={controller}
            deviceLabel={deviceLabel}
            onScrollToLatest={() => {
              pinned.current = true;
              setAtBottom(true);
              scroll.current?.scrollTo({
                behavior: "smooth",
                top: scroll.current.scrollHeight,
              });
            }}
            onShowChanges={onShowChanges}
          />
        </div>
        {environmentOpen && controller.activeThread ? (
          <>
            {environmentLayout.mode === "drawer" ? (
              <button
                aria-label="Close Environment"
                className="environment-panel-scrim"
                onClick={() => setEnvironmentOpen(false)}
                type="button"
              />
            ) : null}
            <EnvironmentPanel
              branch={
                controller.activeThread.gitInfo?.branch ?? "Current branch"
              }
              cwd={controller.activeThread.cwd}
              deviceLabel={deviceLabel}
              items={controller.items}
              mode={environmentLayout.mode}
              onAddSource={() =>
                controller.addToast("Add sources from the message composer.")
              }
              onClose={() => setEnvironmentOpen(false)}
              onCopyBranch={() => {
                const branch =
                  controller.activeThread?.gitInfo?.branch ?? "Current branch";
                void navigator.clipboard
                  .writeText(branch)
                  .then(() =>
                    controller.addToast("Branch name copied", "success"),
                  )
                  .catch((error: unknown) =>
                    controller.addToast(
                      error instanceof Error ? error.message : String(error),
                      "danger",
                    ),
                  );
              }}
              onCreatePullRequest={() => {
                onOpenTerminal();
                controller.addToast(
                  "Terminal opened. Run gh pr create when ready.",
                );
              }}
              onOpenFile={onOpenFile}
              onOpenTerminal={onOpenTerminal}
              onShowChanges={onShowChanges}
              onToggleWorkspace={onToggleWorkspace}
              workspaceVisible={workspaceVisible}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}
