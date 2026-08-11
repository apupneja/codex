import {
  AlertTriangle,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
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
import { Sidebar, type SidebarGrouping } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import type { WorkspaceTab } from "./components/WorkspacePanel";
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
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [narrowSidebarOpen, setNarrowSidebarOpen] = useState(false);
  const [newTaskWorkspaceOpen, setNewTaskWorkspaceOpen] = useState(false);
  const [viewBeforeSettings, setViewBeforeSettings] = useState<
    "automations" | "customize" | "new" | "thread"
  >("new");
  const [sidebarGrouping, setSidebarGroupingState] = useState<SidebarGrouping>(
    () =>
      (window.localStorage.getItem(
        "cursor-sidebar-grouping",
      ) as SidebarGrouping | null) ?? "repository",
  );
  const [requestedFile, setRequestedFile] = useState<string | null>(null);
  const [requestedChangePath, setRequestedChangePath] = useState<string | null>(
    null,
  );
  const [requestedWorkspaceTab, setRequestedWorkspaceTab] =
    useState<WorkspaceTab | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>(
    () => {
      if (new URLSearchParams(window.location.search).has("preview")) {
        return "browser";
      }
      const stored = window.localStorage.getItem("codex-workspace-dock-tab");
      return stored === "browser" ||
        stored === "canvas" ||
        stored === "changes" ||
        stored === "editor" ||
        stored === "files" ||
        stored === "terminal"
        ? stored
        : stored === "preview"
          ? "canvas"
          : "editor";
    },
  );
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
    (controller.preferences.rightPanelOpen && controller.view === "thread") ||
    (controller.view === "new" && newTaskWorkspaceOpen);
  const narrowLayout =
    viewportWidth < (workspaceVisible ? 260 + 424 + 520 : 260 + 424);
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

  useEffect(() => {
    const updateLayout = () => {
      setViewportWidth(window.innerWidth);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (!narrowLayout) setNarrowSidebarOpen(false);
  }, [narrowLayout]);

  useEffect(() => setNarrowSidebarOpen(false), [controller.view]);

  useEffect(() => {
    if (controller.view !== "settings") {
      setViewBeforeSettings(controller.view);
    }
  }, [controller.view]);

  const sidebarMode = narrowLayout
    ? narrowSidebarOpen
      ? "overlay"
      : "hidden"
    : preferences.sidebarOpen
      ? "inline"
      : "hidden";

  const toggleSidebar = useCallback(() => {
    if (narrowLayout) {
      setNarrowSidebarOpen((open) => !open);
      return;
    }
    void updatePreferences({ sidebarOpen: !preferences.sidebarOpen });
  }, [narrowLayout, preferences.sidebarOpen, updatePreferences]);
  const setNativeWorkspaceVisibility = useCallback(
    (visibility: "closed" | "open") =>
      window.codexDesktop.setWorkspacePanelVisibility({
        sidebarMode,
        visibility,
      }),
    [sidebarMode],
  );
  const openWorkspace = useCallback(() => {
    void setNativeWorkspaceVisibility("open");
    if (controller.view === "new") {
      setNewTaskWorkspaceOpen(true);
    } else if (!preferences.rightPanelOpen) {
      void updatePreferences({ rightPanelOpen: true });
    }
  }, [
    controller.view,
    preferences.rightPanelOpen,
    setNativeWorkspaceVisibility,
    updatePreferences,
  ]);
  const toggleWorkspace = useCallback(() => {
    if (controller.view === "new") {
      if (newTaskWorkspaceOpen) {
        setNewTaskWorkspaceOpen(false);
        void setNativeWorkspaceVisibility("closed");
      } else {
        openWorkspace();
      }
      return;
    }
    if (preferences.rightPanelOpen) {
      void updatePreferences({ rightPanelOpen: false });
      void setNativeWorkspaceVisibility("closed");
    } else {
      openWorkspace();
    }
  }, [
    controller.view,
    newTaskWorkspaceOpen,
    openWorkspace,
    preferences.rightPanelOpen,
    setNativeWorkspaceVisibility,
    updatePreferences,
  ]);
  const openFile = useCallback(
    (path: string) => {
      setRequestedFile(path);
      openWorkspace();
    },
    [openWorkspace],
  );
  const showChanges = useCallback(() => {
    setRequestedChangePath(null);
    setRequestedWorkspaceTab("changes");
    openWorkspace();
  }, [openWorkspace]);
  const openChangedFile = useCallback(
    (path: string) => {
      setRequestedChangePath(path);
      setRequestedWorkspaceTab("changes");
      openWorkspace();
    },
    [openWorkspace],
  );
  const openTerminal = useCallback(() => {
    setRequestedWorkspaceTab("terminal");
    openWorkspace();
  }, [openWorkspace]);
  const openWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
      setRequestedWorkspaceTab(tab);
      openWorkspace();
    },
    [openWorkspace],
  );
  const setSidebarGrouping = useCallback((grouping: SidebarGrouping) => {
    window.localStorage.setItem("cursor-sidebar-grouping", grouping);
    setSidebarGroupingState(grouping);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark =
        preferences.theme === "dark" ||
        preferences.theme === "dark-high-contrast" ||
        (preferences.theme === "system" && media.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.documentElement.dataset.themeVariant = preferences.theme;
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [preferences.theme]);

  useEffect(() => {
    const uiFontSize = Number.isFinite(preferences.uiFontSize)
      ? preferences.uiFontSize
      : 13;
    const scale = uiFontSize / 13;
    const sizes = {
      "--font-size-3xs": 10,
      "--font-size-2xs": 10,
      "--font-size-xs": 10,
      "--font-size-sm": 11,
      "--font-size-md": 12,
      "--font-size-base": 13,
      "--font-size-lg": 14,
      "--font-size-xl": 15,
      "--font-size-2xl": 16,
      "--font-size-3xl": 17,
      "--font-size-4xl": 19,
    } as const;
    for (const [token, baseSize] of Object.entries(sizes)) {
      document.documentElement.style.setProperty(
        token,
        `${Math.round(baseSize * scale * 100) / 100}px`,
      );
    }
  }, [preferences.uiFontSize]);

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
      if (command && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        openWorkspaceTab("browser");
      } else if (command && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
      if (command && event.key.toLowerCase() === "j") {
        event.preventDefault();
        openWorkspaceTab("terminal");
      }
      if (command && event.key.toLowerCase() === "g") {
        event.preventDefault();
        openWorkspaceTab("files");
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
  }, [chooseWorkspace, newTask, openWorkspaceTab, setView, toggleSidebar]);

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
      {controller.view !== "settings" &&
      !narrowLayout &&
      controller.preferences.sidebarOpen ? (
        <Sidebar
          account={controller.account}
          activeThread={controller.activeThread}
          onArchive={(thread) => void controller.archiveThread(thread)}
          onChooseWorkspace={() => void controller.chooseWorkspace()}
          onNewTask={controller.newTask}
          onNewTaskInWorkspace={(workspace) =>
            void controller.selectWorkspace(workspace)
          }
          onLoadMore={() => void controller.loadMoreThreads()}
          onSearch={() => setPaletteOpen(true)}
          onSelectThread={controller.selectThread}
          onSetGrouping={setSidebarGrouping}
          onSetView={controller.setView}
          onToggle={toggleSidebar}
          recentWorkspaces={controller.preferences.recentWorkspaces}
          threads={controller.threads}
          hasMoreThreads={Boolean(controller.threadsNextCursor)}
          view={controller.view}
          grouping={sidebarGrouping}
        />
      ) : controller.view !== "settings" ? (
        <div className="collapsed-navigation">
          <button
            aria-label="Show Sidebar"
            className="show-sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeft size={15} />
          </button>
          <button
            aria-label="Search"
            className="collapsed-search"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={14} />
          </button>
          {controller.view === "thread" && !narrowSidebarOpen ? (
            <button
              aria-label="New Agent"
              className="collapsed-new-agent"
              onClick={controller.newTask}
            >
              <Plus size={15} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="main-workspace">
        {controller.view === "new" ? (
          <NewTaskView
            controller={controller}
            onToggleWorkspace={toggleWorkspace}
          />
        ) : controller.view === "thread" ? (
          <ConversationView
            changesOpen={workspaceVisible && activeWorkspaceTab === "changes"}
            controller={controller}
            onOpenChange={openChangedFile}
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
          <SettingsView
            controller={controller}
            onClose={() => controller.setView(viewBeforeSettings)}
          />
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
              onClose={() => {
                if (controller.view === "new") {
                  setNewTaskWorkspaceOpen(false);
                } else {
                  void controller.updatePreferences({ rightPanelOpen: false });
                }
                void setNativeWorkspaceVisibility("closed");
              }}
              onChangeRequestConsumed={() => setRequestedChangePath(null)}
              onPreviewReady={() => setPreviewReady(true)}
              onRequestConsumed={() => setRequestedFile(null)}
              onTabRequestConsumed={() => setRequestedWorkspaceTab(null)}
              onTabChange={setActiveWorkspaceTab}
              requestedFile={requestedFile}
              requestedChangePath={requestedChangePath}
              requestedTab={requestedWorkspaceTab}
            />
          </Suspense>
        ) : null}
      </div>

      {controller.view !== "settings" && narrowLayout && narrowSidebarOpen ? (
        <>
          <button
            aria-label="Close sidebar"
            className="sidebar-overlay-scrim"
            onClick={() => setNarrowSidebarOpen(false)}
          />
          <div className="narrow-sidebar-layer">
            <Sidebar
              account={controller.account}
              activeThread={controller.activeThread}
              onArchive={(thread) => void controller.archiveThread(thread)}
              onChooseWorkspace={() => void controller.chooseWorkspace()}
              onLoadMore={() => void controller.loadMoreThreads()}
              onNewTask={controller.newTask}
              onNewTaskInWorkspace={(workspace) =>
                void controller.selectWorkspace(workspace)
              }
              onSearch={() => setPaletteOpen(true)}
              onSelectThread={controller.selectThread}
              onSetGrouping={setSidebarGrouping}
              onSetView={controller.setView}
              onToggle={toggleSidebar}
              recentWorkspaces={controller.preferences.recentWorkspaces}
              threads={controller.threads}
              hasMoreThreads={Boolean(controller.threadsNextCursor)}
              view={controller.view}
              grouping={sidebarGrouping}
            />
          </div>
        </>
      ) : null}

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
          onPerformAppAction={(action) => {
            void window.codexDesktop
              .performAppAction(action)
              .catch((error) =>
                controller.addToast(
                  error instanceof Error ? error.message : String(error),
                  "danger",
                ),
              );
          }}
          onResetAdViews={() => {
            window.localStorage.removeItem("cursor-in-app-ad-views");
            controller.addToast("In-app ad views reset.", "success");
          }}
          onSelectThread={controller.selectThread}
          onSetGrouping={setSidebarGrouping}
          onSetModel={(selectedModel) =>
            void controller.updatePreferences({ selectedModel })
          }
          onSetTheme={(theme) => void controller.updatePreferences({ theme })}
          onSetView={controller.setView}
          onToggleWorkspace={toggleWorkspace}
          onUnavailable={(label) =>
            controller.addToast(`${label} is not available on this system.`)
          }
          threads={controller.threads}
          workspace={
            controller.activeThread?.cwd ??
            controller.preferences.lastWorkspace ??
            controller.threads[0]?.cwd ??
            null
          }
          workspaceVisible={workspaceVisible}
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
