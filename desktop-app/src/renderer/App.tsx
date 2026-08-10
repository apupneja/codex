import { AlertTriangle, PanelLeftOpen, RefreshCw } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { JsonObject, JsonValue, Thread } from "../shared/types";

import { ApprovalDialog } from "./components/ApprovalDialog";
import { CommandPalette } from "./components/CommandPalette";
import { ConversationView } from "./components/ConversationView";
import { NewTaskView } from "./components/NewTaskView";
import { Sidebar } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import {
  AutomationsView,
  CustomizeView,
  SettingsView,
} from "./components/UtilityViews";
import { useCodexController } from "./state/useCodexController";

const WorkspacePanel = lazy(() =>
  import("./components/WorkspacePanel").then((module) => ({
    default: module.WorkspacePanel,
  })),
);

function matchingFileChanges(
  thread: Thread | null,
  threadId: string,
  itemId: string,
): JsonValue | undefined {
  if (thread?.id !== threadId) return undefined;
  const item = thread.turns
    .flatMap((turn) => turn.items)
    .find(
      (candidate) => candidate.id === itemId && candidate.type === "fileChange",
    );
  return item?.type === "fileChange"
    ? (item.changes as unknown as JsonValue)
    : undefined;
}

export default function App() {
  const controller = useCodexController();
  const { chooseWorkspace, newTask, preferences, setView, updatePreferences } =
    controller;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [requestedFile, setRequestedFile] = useState<string | null>(null);
  const [requestedWorkspaceTab, setRequestedWorkspaceTab] = useState<
    "changes" | "terminal" | null
  >(null);
  const approvalRequest = controller.serverRequests[0];
  const approvalParams = approvalRequest?.params as unknown as
    | JsonObject
    | undefined;
  const approvalThreadId =
    typeof approvalParams?.threadId === "string"
      ? approvalParams.threadId
      : null;
  const approvalItemId =
    typeof approvalParams?.itemId === "string" ? approvalParams.itemId : null;
  const activeApprovalChanges = useMemo(
    () =>
      approvalThreadId && approvalItemId
        ? matchingFileChanges(
            controller.activeThread,
            approvalThreadId,
            approvalItemId,
          )
        : undefined,
    [approvalItemId, approvalThreadId, controller.activeThread],
  );
  const [loadedApprovalChanges, setLoadedApprovalChanges] =
    useState<JsonValue>();
  const [approvalChangesLoading, setApprovalChangesLoading] = useState(false);
  const workspaceVisible =
    controller.preferences.rightPanelOpen &&
    (controller.view === "new" || controller.view === "thread");
  const [workspaceMounted, setWorkspaceMounted] = useState(workspaceVisible);
  const smokePreviewRequested = useMemo(
    () => new URLSearchParams(window.location.search).has("preview"),
    [],
  );
  const referenceCapture = useMemo(
    () =>
      new URLSearchParams(window.location.search).get("reference") === "cursor",
    [],
  );

  useEffect(() => {
    if (workspaceVisible) {
      setWorkspaceMounted(true);
    }
  }, [workspaceVisible]);

  const toggleSidebar = useCallback(() => {
    void updatePreferences({ sidebarOpen: !preferences.sidebarOpen });
  }, [preferences.sidebarOpen, updatePreferences]);
  const toggleWorkspace = useCallback(() => {
    void updatePreferences({ rightPanelOpen: !preferences.rightPanelOpen });
  }, [preferences.rightPanelOpen, updatePreferences]);
  const openFile = useCallback(
    (path: string) => {
      setRequestedFile(path);
      if (!preferences.rightPanelOpen) {
        void updatePreferences({ rightPanelOpen: true });
      }
    },
    [preferences.rightPanelOpen, updatePreferences],
  );
  const showChanges = useCallback(() => {
    setRequestedWorkspaceTab("changes");
    if (!preferences.rightPanelOpen) {
      void updatePreferences({ rightPanelOpen: true });
    }
  }, [preferences.rightPanelOpen, updatePreferences]);
  const openTerminal = useCallback(() => {
    setRequestedWorkspaceTab("terminal");
    if (!preferences.rightPanelOpen) {
      void updatePreferences({ rightPanelOpen: true });
    }
  }, [preferences.rightPanelOpen, updatePreferences]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark =
        preferences.theme === "dark" ||
        (preferences.theme === "system" && media.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [preferences.theme]);

  useEffect(() => {
    function runShortcut(shortcut: string): void {
      if (shortcut === "new-task") newTask();
      if (shortcut === "search") setPaletteOpen(true);
      if (shortcut === "toggle-sidebar") toggleSidebar();
      if (shortcut === "open-repository") void chooseWorkspace();
    }
    const unsubscribe = window.codexDesktop.onShortcut(runShortcut);
    const keydown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "n") {
        event.preventDefault();
        newTask();
      }
      if (command && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (command && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
      if (command && event.key === ",") {
        event.preventDefault();
        setView("settings");
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", keydown);
    return () => {
      unsubscribe();
      window.removeEventListener("keydown", keydown);
    };
  }, [chooseWorkspace, newTask, setView, toggleSidebar]);

  useEffect(() => {
    if (
      controller.bootstrapped &&
      (!smokePreviewRequested ||
        (previewReady && Boolean(controller.activeThread?.turns.length))) &&
      import.meta.env.MODE !== "test"
    ) {
      const timer = window.setTimeout(
        () => window.codexDesktop.signalSmokeReady(),
        smokePreviewRequested ? 400 : 1_200,
      );
      return () => window.clearTimeout(timer);
    }
  }, [
    controller.activeThread?.turns.length,
    controller.bootstrapped,
    previewReady,
    smokePreviewRequested,
  ]);

  useEffect(() => {
    setLoadedApprovalChanges(undefined);
    if (
      approvalRequest?.method !== "item/fileChange/requestApproval" ||
      !approvalThreadId ||
      !approvalItemId ||
      activeApprovalChanges
    ) {
      setApprovalChangesLoading(false);
      return;
    }
    let cancelled = false;
    setApprovalChangesLoading(true);
    void window.codexDesktop
      .request<{ thread: Thread }>("thread/read", {
        includeTurns: true,
        threadId: approvalThreadId,
      })
      .then((response) => {
        if (!cancelled) {
          setLoadedApprovalChanges(
            matchingFileChanges(
              response.thread,
              approvalThreadId,
              approvalItemId,
            ),
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setApprovalChangesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeApprovalChanges,
    approvalItemId,
    approvalRequest?.method,
    approvalThreadId,
  ]);

  return (
    <div className={`app-shell ${referenceCapture ? "reference-capture" : ""}`}>
      {controller.preferences.sidebarOpen ? (
        <Sidebar
          account={controller.account}
          activeThread={controller.activeThread}
          onArchive={(thread) => void controller.archiveThread(thread)}
          onChooseWorkspace={() => void controller.chooseWorkspace()}
          onNewTask={controller.newTask}
          onLoadMore={() => void controller.loadMoreThreads()}
          onSearch={() => setPaletteOpen(true)}
          onSelectThread={controller.selectThread}
          onSetView={controller.setView}
          onToggle={toggleSidebar}
          recentWorkspaces={controller.preferences.recentWorkspaces}
          threads={controller.threads}
          hasMoreThreads={Boolean(controller.threadsNextCursor)}
          view={controller.view}
        />
      ) : (
        <button
          aria-label="Show sidebar"
          className="show-sidebar"
          onClick={toggleSidebar}
        >
          <PanelLeftOpen size={15} />
        </button>
      )}

      <div className="main-workspace">
        {controller.view === "new" ? (
          <NewTaskView
            controller={controller}
            onToggleWorkspace={toggleWorkspace}
          />
        ) : controller.view === "thread" ? (
          <ConversationView
            controller={controller}
            onOpenFile={openFile}
            onOpenTerminal={openTerminal}
            onShowChanges={showChanges}
            onToggleWorkspace={toggleWorkspace}
          />
        ) : controller.view === "automations" ? (
          <AutomationsView controller={controller} />
        ) : controller.view === "customize" ? (
          <CustomizeView controller={controller} />
        ) : (
          <SettingsView controller={controller} />
        )}

        {workspaceMounted ? (
          <Suspense
            fallback={
              <div className="workspace-loading">
                <RefreshCw className="spin" size={15} /> Loading workspace
              </div>
            }
          >
            <WorkspacePanel
              controller={controller}
              hidden={!workspaceVisible}
              onClose={() =>
                void controller.updatePreferences({ rightPanelOpen: false })
              }
              onPreviewReady={() => setPreviewReady(true)}
              onRequestConsumed={() => setRequestedFile(null)}
              onTabRequestConsumed={() => setRequestedWorkspaceTab(null)}
              requestedFile={requestedFile}
              requestedTab={requestedWorkspaceTab}
            />
          </Suspense>
        ) : null}
      </div>

      {controller.runtime.phase === "starting" ||
      controller.runtime.phase === "restarting" ? (
        <div className="runtime-pill">
          <RefreshCw className="spin" size={13} />
          {controller.runtime.phase === "starting"
            ? "Starting Codex"
            : controller.runtime.detail}
        </div>
      ) : null}
      {controller.runtime.phase === "failed" ? (
        <div className="runtime-error">
          <AlertTriangle size={17} />
          <div>
            <strong>Codex runtime unavailable</strong>
            <span>{controller.runtime.detail}</span>
          </div>
          <button
            className="button-secondary"
            onClick={() => void window.codexDesktop.restartRuntime()}
          >
            Retry
          </button>
        </div>
      ) : null}
      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNewTask={controller.newTask}
          onOpenFile={openFile}
          onOpenRepository={() => void controller.chooseWorkspace()}
          onSelectThread={controller.selectThread}
          onSetView={controller.setView}
          onToggleWorkspace={toggleWorkspace}
          threads={controller.threads}
          workspace={
            controller.activeThread?.cwd ?? controller.preferences.lastWorkspace
          }
        />
      ) : null}
      {approvalRequest ? (
        <ApprovalDialog
          fileChanges={activeApprovalChanges ?? loadedApprovalChanges}
          fileChangesLoading={approvalChangesLoading}
          key={`${typeof approvalRequest.id}:${approvalRequest.id}`}
          onRespond={(request, result) =>
            void controller.respondToServerRequest(request, result)
          }
          request={approvalRequest}
        />
      ) : null}
      <Toasts onDismiss={controller.dismissToast} toasts={controller.toasts} />
    </div>
  );
}
