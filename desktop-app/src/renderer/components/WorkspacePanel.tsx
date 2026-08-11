import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  Files,
  Folder,
  MoreHorizontal,
  Paintbrush,
  PanelRightClose,
  RefreshCw,
  Save,
  Search,
  Star,
  TerminalSquare,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { DirectoryEntry, OpenDocument } from "../../shared/types";
import { validatePreviewUrl } from "../../shared/preview-url";
import type { CodexController } from "../state/useCodexController";
import {
  decodeBase64Text,
  encodeBase64Text,
  languageForPath,
} from "../lib/encoding";
import { ChangeReviewPanel } from "./ChangeReviewPanel";
import { EmbeddedBrowser } from "./EmbeddedBrowser";
import type { WorkspaceOpenTarget } from "./WorkspaceOpenMenu";
import { WorkspaceTabs, type WorkspaceTab } from "./WorkspaceTabs";

const CodeEditor = lazy(() =>
  import("./CodeEditor").then((module) => ({ default: module.CodeEditor })),
);

const TerminalPanel = lazy(() =>
  import("./TerminalPanel").then((module) => ({
    default: module.TerminalPanel,
  })),
);

type WorkspacePanelProps = {
  controller: CodexController;
  hidden: boolean;
  requestedChangePath: string | null;
  requestedFile: string | null;
  requestedTab: WorkspaceTab | null;
  onChangeRequestConsumed(): void;
  onClose(): void;
  onPreviewReady(): void;
  onRequestConsumed(): void;
  onTabChange(tab: WorkspaceTab): void;
  onTabRequestConsumed(): void;
};

type DirectoryNodeProps = {
  depth: number;
  entry: DirectoryEntry;
  onOpen(path: string): void;
  path: string;
};

export type { WorkspaceTab } from "./WorkspaceTabs";

type PreviewNavigation = {
  entries: string[];
  index: number;
};

const DEFAULT_PREVIEW_URL = "http://localhost:5173";
const DEFAULT_DOCK_WIDTH = 520;
const DOCK_WIDTH_STORAGE_KEY = "codex-workspace-dock-width";
const DOCK_TAB_STORAGE_KEY = "codex-workspace-dock-tab";

function initialWorkspaceTab(initialPreviewUrl: string | null): WorkspaceTab {
  if (initialPreviewUrl) return "browser";
  const stored = window.localStorage.getItem(DOCK_TAB_STORAGE_KEY);
  if (stored === "preview") return "canvas";
  return stored === "browser" ||
    stored === "canvas" ||
    stored === "changes" ||
    stored === "editor" ||
    stored === "files" ||
    stored === "terminal"
    ? stored
    : "editor";
}

function clampedDockWidth(width: number): number {
  const maximum = Math.max(280, Math.min(900, window.innerWidth - 460));
  return Math.round(Math.min(maximum, Math.max(320, width)));
}

function appendPath(parent: string, child: string): string {
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[\\/]$/, "")}${separator}${child}`;
}

function DirectoryNode({ depth, entry, onOpen, path }: DirectoryNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirectoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle(): Promise<void> {
    if (!entry.isDirectory) {
      onOpen(path);
      return;
    }
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) {
      setLoading(true);
      setFailed(false);
      try {
        const response = await window.codexDesktop.request<{
          entries: DirectoryEntry[];
        }>("fs/readDirectory", { path });
        setChildren(
          response.entries.sort(
            (left, right) =>
              Number(right.isDirectory) - Number(left.isDirectory) ||
              left.fileName.localeCompare(right.fileName),
          ),
        );
      } catch {
        setChildren([]);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button
        className="file-tree-row"
        onClick={() => void toggle()}
        style={{ paddingLeft: 10 + depth * 13 }}
        title={failed ? `Could not load ${path}` : path}
      >
        {entry.isDirectory ? (
          expanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )
        ) : (
          <span className="tree-spacer" />
        )}
        {entry.isDirectory ? <Folder size={13} /> : <File size={13} />}
        <span className="tree-name">{entry.fileName}</span>
        {loading ? <RefreshCw className="spin" size={11} /> : null}
        {failed ? <span className="tree-error">!</span> : null}
      </button>
      {expanded
        ? children?.map((child) => {
            const childPath = appendPath(path, child.fileName);
            return (
              <DirectoryNode
                depth={depth + 1}
                entry={child}
                key={childPath}
                onOpen={onOpen}
                path={childPath}
              />
            );
          })
        : null}
    </>
  );
}

export function WorkspacePanel({
  controller,
  hidden,
  onChangeRequestConsumed,
  onClose,
  onPreviewReady,
  onRequestConsumed,
  onTabChange,
  onTabRequestConsumed,
  requestedChangePath,
  requestedFile,
  requestedTab,
}: WorkspacePanelProps) {
  const resolvedWorkspace =
    controller.activeThread?.cwd ??
    controller.preferences.lastWorkspace ??
    null;
  const retainedWorkspace = useRef<string | null>(resolvedWorkspace);
  const workspace =
    controller.loadingThread && !controller.activeThread
      ? retainedWorkspace.current
      : resolvedWorkspace;
  const { addToast } = controller;
  const initialPreviewUrl = useMemo(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "preview",
    );
    if (!requested) return null;
    const result = validatePreviewUrl(requested, window.location.origin);
    return result.ok ? result.url : null;
  }, []);
  const referenceCapture = useMemo(
    () =>
      new URLSearchParams(window.location.search).get("reference") === "cursor",
    [],
  );
  const [rootEntries, setRootEntries] = useState<DirectoryEntry[]>([]);
  const [documents, setDocuments] = useState<OpenDocument[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeChangePath, setActiveChangePath] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>(() =>
    initialWorkspaceTab(initialPreviewUrl),
  );
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(() => [
    initialWorkspaceTab(initialPreviewUrl),
  ]);
  const [dockWidth, setDockWidth] = useState(() => {
    const rawStored = window.localStorage.getItem(DOCK_WIDTH_STORAGE_KEY);
    const stored = rawStored === null ? DEFAULT_DOCK_WIDTH : Number(rawStored);
    return clampedDockWidth(
      Number.isFinite(stored) ? stored : DEFAULT_DOCK_WIDTH,
    );
  });
  const [filter, setFilter] = useState("");
  const [savingPaths, setSavingPaths] = useState<Set<string>>(() => new Set());
  const [previewDraft, setPreviewDraft] = useState(
    initialPreviewUrl ?? DEFAULT_PREVIEW_URL,
  );
  const [previewNavigation, setPreviewNavigation] = useState<PreviewNavigation>(
    initialPreviewUrl
      ? { entries: [initialPreviewUrl], index: 0 }
      : { entries: [], index: -1 },
  );
  const [previewFrameVersion, setPreviewFrameVersion] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(
    initialPreviewUrl !== null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFavorite, setPreviewFavorite] = useState(false);
  const [workspaceFocused, setWorkspaceFocused] = useState(false);
  const [workspaceOpenMenu, setWorkspaceOpenMenu] = useState(false);
  const documentsRef = useRef<OpenDocument[]>([]);
  const loadedWorkspaceRef = useRef<string | null>(workspace);
  const savingPathsRef = useRef<Set<string>>(new Set());
  const resizeRef = useRef<{
    pointerId: number;
    startWidth: number;
    x: number;
  } | null>(null);
  const treeRequestGeneration = useRef(0);
  const activeDocument =
    documents.find((document) => document.path === activePath) ?? null;
  const previewUrl = previewNavigation.entries[previewNavigation.index] ?? null;

  const activateTab = useCallback((nextTab: WorkspaceTab) => {
    setOpenTabs((current) =>
      current.includes(nextTab) ? current : [...current, nextTab],
    );
    setTab(nextTab);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DOCK_TAB_STORAGE_KEY, tab);
    onTabChange(tab);
  }, [onTabChange, tab]);
  useEffect(() => {
    if (!controller.loadingThread || controller.activeThread) {
      retainedWorkspace.current = resolvedWorkspace;
    }
  }, [controller.activeThread, controller.loadingThread, resolvedWorkspace]);

  useEffect(
    () =>
      controller.registerWorkspaceChangeGuard((nextWorkspace) => {
        const dirtyDocuments = documentsRef.current.filter(
          (document) => document.dirty,
        );
        if (dirtyDocuments.length === 0) return true;
        const destination =
          nextWorkspace?.split(/[\\/]/).filter(Boolean).pop() ??
          "another repository";
        return window.confirm(
          `Switch to ${destination} and discard unsaved changes in ${dirtyDocuments.length} open ${dirtyDocuments.length === 1 ? "file" : "files"}?`,
        );
      }),
    [controller.registerWorkspaceChangeGuard],
  );

  useEffect(() => {
    if (loadedWorkspaceRef.current === workspace) return;
    loadedWorkspaceRef.current = workspace;
    treeRequestGeneration.current += 1;
    documentsRef.current = [];
    savingPathsRef.current = new Set();
    setRootEntries([]);
    setDocuments([]);
    setSavingPaths(new Set());
    setActivePath(null);
    setFilter("");
    setPreviewDraft(DEFAULT_PREVIEW_URL);
    setPreviewNavigation({ entries: [], index: -1 });
    setPreviewFrameVersion(0);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewFavorite(false);
  }, [workspace]);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    window.codexDesktop.setUnsavedChanges(
      documents.some((document) => document.dirty),
    );
  }, [documents]);

  useEffect(
    () => () => {
      document.body.classList.remove("workspace-dock-resizing");
    },
    [],
  );

  const refreshTree = useCallback(async () => {
    const generation = ++treeRequestGeneration.current;
    if (!workspace) {
      setRootEntries([]);
      return;
    }
    try {
      const response = await window.codexDesktop.request<{
        entries: DirectoryEntry[];
      }>("fs/readDirectory", { path: workspace });
      if (generation !== treeRequestGeneration.current) return;
      setRootEntries(
        response.entries.sort(
          (left, right) =>
            Number(right.isDirectory) - Number(left.isDirectory) ||
            left.fileName.localeCompare(right.fileName),
        ),
      );
    } catch (error) {
      if (generation !== treeRequestGeneration.current) return;
      addToast(
        `Could not read workspace: ${error instanceof Error ? error.message : String(error)}`,
        "danger",
      );
    }
  }, [addToast, workspace]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    if (!workspace) return;
    const watchId = crypto.randomUUID();
    let cancelled = false;
    let watching = false;

    const unsubscribe = window.codexDesktop.onEvent((event) => {
      if (
        event.type !== "notification" ||
        event.payload.method !== "fs/changed" ||
        event.payload.params?.watchId !== watchId
      ) {
        return;
      }
      const changedPaths = Array.isArray(event.payload.params.changedPaths)
        ? event.payload.params.changedPaths.filter(
            (path): path is string => typeof path === "string",
          )
        : [];
      void refreshTree();
      const affected = documentsRef.current.filter((document) =>
        changedPaths.some(
          (path) =>
            document.path === path ||
            document.path.startsWith(`${path}/`) ||
            document.path.startsWith(`${path}\\`),
        ),
      );
      for (const document of affected) {
        void window.codexDesktop
          .request<{ dataBase64: string }>("fs/readFile", {
            path: document.path,
          })
          .then((response) => {
            if (cancelled) return;
            const diskText = decodeBase64Text(response.dataBase64);
            const latest = documentsRef.current.find(
              (candidate) => candidate.path === document.path,
            );
            if (!latest) return;
            if (
              latest.dirty &&
              diskText !== latest.text &&
              diskText !== latest.originalText &&
              !latest.externalChanged
            ) {
              addToast(
                `${document.path.split(/[\\/]/).pop()} changed on disk; review before saving.`,
                "danger",
              );
            }
            setDocuments((current) =>
              current.map((candidate) => {
                if (candidate.path !== document.path) return candidate;
                if (diskText === candidate.text) {
                  return {
                    ...candidate,
                    dirty: false,
                    externalChanged: false,
                    originalText: diskText,
                  };
                }
                if (!candidate.dirty) {
                  return {
                    ...candidate,
                    externalChanged: false,
                    originalText: diskText,
                    text: diskText,
                  };
                }
                return diskText !== candidate.originalText
                  ? { ...candidate, externalChanged: true }
                  : candidate;
              }),
            );
          })
          .catch(() => {
            if (cancelled) return;
            setDocuments((current) =>
              current.map((candidate) =>
                candidate.path === document.path
                  ? { ...candidate, externalChanged: true }
                  : candidate,
              ),
            );
          });
      }
    });

    void window.codexDesktop
      .request("fs/watch", { path: workspace, watchId })
      .then(() => {
        if (cancelled) {
          void window.codexDesktop
            .request("fs/unwatch", { watchId })
            .catch(() => undefined);
        } else {
          watching = true;
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribe();
      if (watching) {
        void window.codexDesktop
          .request("fs/unwatch", { watchId })
          .catch(() => undefined);
      }
    };
  }, [addToast, refreshTree, workspace]);

  const openFile = useCallback(
    async (rawPath: string) => {
      if (!workspace) return;
      const requestedWorkspace = workspace;
      const absolute = /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(rawPath)
        ? rawPath
        : appendPath(workspace, rawPath);
      const existing = documents.find((document) => document.path === absolute);
      if (existing) {
        setActivePath(absolute);
        activateTab("editor");
        return;
      }
      try {
        const response = await window.codexDesktop.request<{
          dataBase64: string;
        }>("fs/readFile", {
          path: absolute,
        });
        if (response.dataBase64.length > 8 * 1024 * 1024) {
          throw new Error("File is too large for the editor");
        }
        const text = decodeBase64Text(response.dataBase64);
        if (text.includes("\0")) {
          throw new Error("Binary files cannot be edited here");
        }
        if (loadedWorkspaceRef.current !== requestedWorkspace) return;
        const document: OpenDocument = {
          dirty: false,
          externalChanged: false,
          language: languageForPath(absolute),
          originalText: text,
          path: absolute,
          text,
        };
        setDocuments((current) =>
          current.some((candidate) => candidate.path === absolute)
            ? current
            : [...current, document],
        );
        setActivePath(absolute);
        activateTab("editor");
      } catch (error) {
        if (loadedWorkspaceRef.current !== requestedWorkspace) return;
        addToast(
          `Could not open file: ${error instanceof Error ? error.message : String(error)}`,
          "danger",
        );
      }
    },
    [activateTab, addToast, documents, workspace],
  );

  useEffect(() => {
    if (requestedFile) {
      void openFile(requestedFile);
      onRequestConsumed();
    }
  }, [onRequestConsumed, openFile, requestedFile]);

  useEffect(() => {
    if (requestedTab) {
      if (requestedTab === "changes") setActiveChangePath(null);
      activateTab(requestedTab);
      onTabRequestConsumed();
    }
  }, [activateTab, onTabRequestConsumed, requestedTab]);

  useEffect(() => {
    if (!requestedChangePath) return;
    setActiveChangePath(requestedChangePath);
    activateTab("changes");
    onChangeRequestConsumed();
  }, [activateTab, onChangeRequestConsumed, requestedChangePath]);

  const saveActive = useCallback(async () => {
    if (!activeDocument || savingPathsRef.current.has(activeDocument.path)) {
      return;
    }
    const path = activeDocument.path;
    const savedText = activeDocument.text;
    const originalText = activeDocument.originalText;
    const nextSavingPaths = new Set(savingPathsRef.current).add(path);
    savingPathsRef.current = nextSavingPaths;
    setSavingPaths(nextSavingPaths);
    try {
      let changedOnDisk = activeDocument.externalChanged;
      try {
        const latest = await window.codexDesktop.request<{
          dataBase64: string;
        }>("fs/readFile", { path });
        const diskText = decodeBase64Text(latest.dataBase64);
        changedOnDisk = diskText !== originalText && diskText !== savedText;
      } catch {
        changedOnDisk = true;
      }
      if (
        changedOnDisk &&
        !window.confirm(
          `${path} changed on disk. Overwrite it with the editor contents?`,
        )
      ) {
        return;
      }
      await window.codexDesktop.request("fs/writeFile", {
        dataBase64: encodeBase64Text(savedText),
        path,
      });
      setDocuments((current) =>
        current.map((document) =>
          document.path === path
            ? {
                ...document,
                dirty: document.text !== savedText,
                externalChanged: false,
                originalText: savedText,
              }
            : document,
        ),
      );
      addToast("File saved", "success");
    } catch (error) {
      addToast(
        `Could not save file: ${error instanceof Error ? error.message : String(error)}`,
        "danger",
      );
    } finally {
      const remaining = new Set(savingPathsRef.current);
      remaining.delete(path);
      savingPathsRef.current = remaining;
      setSavingPaths(remaining);
    }
  }, [activeDocument, addToast]);

  const visibleEntries = useMemo(
    () =>
      filter
        ? rootEntries.filter((entry) =>
            entry.fileName.toLowerCase().includes(filter.toLowerCase()),
          )
        : rootEntries,
    [filter, rootEntries],
  );

  const navigatePreview = useCallback(
    (rawUrl: string) => {
      const result = validatePreviewUrl(rawUrl, window.location.origin);
      if (!result.ok) {
        setPreviewError(result.reason);
        return;
      }
      const entries = [
        ...previewNavigation.entries.slice(0, previewNavigation.index + 1),
        result.url,
      ];
      setPreviewNavigation({ entries, index: entries.length - 1 });
      setPreviewDraft(result.url);
      setPreviewError(null);
      setPreviewLoading(true);
      setPreviewFrameVersion((current) => current + 1);
      activateTab("canvas");
    },
    [activateTab, previewNavigation],
  );

  function navigatePreviewHistory(nextIndex: number): void {
    const url = previewNavigation.entries[nextIndex];
    if (!url) return;
    setPreviewNavigation((current) => ({ ...current, index: nextIndex }));
    setPreviewDraft(url);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewFrameVersion((current) => current + 1);
  }

  function reloadPreview(): void {
    if (!previewUrl) {
      navigatePreview(previewDraft);
      return;
    }
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewFrameVersion((current) => current + 1);
  }

  function resetPreview(): void {
    setPreviewDraft(DEFAULT_PREVIEW_URL);
    setPreviewNavigation({ entries: [], index: -1 });
    setPreviewFrameVersion(0);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewFavorite(false);
  }

  function openWorkspaceTarget(
    target: WorkspaceOpenTarget,
    input?: string,
  ): void {
    activateTab(target);
    if (target === "browser" && input) {
      void window.codexDesktop
        .navigateEmbeddedBrowser(input)
        .catch((error) =>
          addToast(
            `Could not open browser: ${error instanceof Error ? error.message : String(error)}`,
            "danger",
          ),
        );
    } else if (target === "canvas" && input) {
      navigatePreview(input);
    }
  }

  function closeWorkspaceTab(closingTab: WorkspaceTab): void {
    const remaining = openTabs.filter((candidate) => candidate !== closingTab);
    const fallback = remaining.at(-1) ?? "editor";
    setOpenTabs(remaining.length ? remaining : [fallback]);
    if (tab === closingTab) setTab(fallback);
  }

  function closeDocument(document: OpenDocument): void {
    if (
      document.dirty &&
      !window.confirm(`Discard unsaved changes to ${document.path}?`)
    ) {
      return;
    }
    setDocuments((current) => {
      const next = current.filter((item) => item.path !== document.path);
      if (activePath === document.path) {
        setActivePath(next.at(-1)?.path ?? null);
      }
      return next;
    });
  }

  function resizeDock(event: ReactPointerEvent<HTMLDivElement>): void {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const width = clampedDockWidth(
      resize.startWidth + resize.x - event.clientX,
    );
    setDockWidth(width);
  }

  function finishDockResize(event: ReactPointerEvent<HTMLDivElement>): void {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const width = clampedDockWidth(
      resize.startWidth + resize.x - event.clientX,
    );
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    document.body.classList.remove("workspace-dock-resizing");
    setDockWidth(width);
    window.localStorage.setItem(DOCK_WIDTH_STORAGE_KEY, String(width));
  }

  return (
    <aside
      aria-hidden={hidden || undefined}
      className={`workspace-panel ${hidden ? "workspace-panel-hidden" : ""} ${workspaceFocused ? "workspace-focused" : ""}`}
      id="workspace-panel"
      style={{ "--workspace-dock-width": `${dockWidth}px` } as CSSProperties}
    >
      <div
        aria-label="Resize workspace dock"
        aria-orientation="vertical"
        className="workspace-resize-handle"
        onDoubleClick={() => {
          const width = clampedDockWidth(DEFAULT_DOCK_WIDTH);
          setDockWidth(width);
          window.localStorage.setItem(DOCK_WIDTH_STORAGE_KEY, String(width));
        }}
        onPointerCancel={finishDockResize}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeRef.current = {
            pointerId: event.pointerId,
            startWidth: dockWidth,
            x: event.clientX,
          };
          document.body.classList.add("workspace-dock-resizing");
        }}
        onPointerMove={resizeDock}
        onPointerUp={finishDockResize}
        role="separator"
      />
      <WorkspaceTabs
        activePath={activePath}
        activeTab={tab}
        documents={documents}
        focused={workspaceFocused}
        menuOpen={workspaceOpenMenu}
        onActivateDocument={(path) => {
          setActivePath(path);
          activateTab("editor");
        }}
        onActivateTab={activateTab}
        onClose={onClose}
        onCloseDocument={closeDocument}
        onCloseTab={closeWorkspaceTab}
        onMenuOpenChange={setWorkspaceOpenMenu}
        onOpenTarget={openWorkspaceTarget}
        onToggleFocused={() => setWorkspaceFocused((current) => !current)}
        openTabs={openTabs}
      />

      <div
        className={`workspace-body ${tab === "browser" || tab === "canvas" ? "workspace-body-preview" : ""}`}
      >
        <div className="workspace-main">
          {tab === "browser" ? (
            <EmbeddedBrowser
              initialUrl={initialPreviewUrl}
              onReady={onPreviewReady}
              visible={!hidden && !workspaceOpenMenu}
            />
          ) : tab === "canvas" ? (
            <div className="preview-browser">
              <div className="preview-toolbar">
                <div className="preview-navigation-controls">
                  <button
                    aria-label="Go back"
                    disabled={previewNavigation.index <= 0}
                    onClick={() =>
                      navigatePreviewHistory(previewNavigation.index - 1)
                    }
                    title="Back"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    aria-label="Go forward"
                    disabled={
                      previewNavigation.index < 0 ||
                      previewNavigation.index >=
                        previewNavigation.entries.length - 1
                    }
                    onClick={() =>
                      navigatePreviewHistory(previewNavigation.index + 1)
                    }
                    title="Forward"
                  >
                    <ArrowRight size={16} />
                  </button>
                  <button
                    aria-label="Reload preview"
                    onClick={reloadPreview}
                    title="Reload"
                  >
                    <RefreshCw
                      className={previewLoading ? "spin" : undefined}
                      size={14}
                    />
                  </button>
                  <button
                    aria-label={
                      previewFavorite
                        ? "Remove preview bookmark"
                        : "Bookmark preview"
                    }
                    className={previewFavorite ? "preview-favorite" : ""}
                    onClick={() => setPreviewFavorite((current) => !current)}
                    title={previewFavorite ? "Remove bookmark" : "Bookmark"}
                  >
                    <Star
                      fill={previewFavorite ? "currentColor" : "none"}
                      size={14}
                    />
                  </button>
                </div>

                <form
                  className="preview-address"
                  onSubmit={(event) => {
                    event.preventDefault();
                    navigatePreview(previewDraft);
                  }}
                >
                  <input
                    aria-describedby={
                      previewError ? "preview-url-error" : undefined
                    }
                    aria-invalid={previewError ? true : undefined}
                    aria-label="Preview address"
                    autoCapitalize="none"
                    autoCorrect="off"
                    onChange={(event) => {
                      setPreviewDraft(event.target.value);
                      if (previewError) setPreviewError(null);
                    }}
                    placeholder={DEFAULT_PREVIEW_URL}
                    spellCheck={false}
                    value={(referenceCapture
                      ? previewDraft.replace("127.0.0.1", "localhost")
                      : previewDraft
                    ).replace(/\/$/, "")}
                  />
                </form>

                <div className="preview-page-controls">
                  <button
                    aria-label="Enter design mode"
                    disabled={!previewUrl}
                    onClick={() => {
                      if (!previewUrl) return;
                      addToast("Design mode enabled");
                    }}
                    title="Design mode"
                  >
                    <Paintbrush size={14} />
                  </button>
                  <button
                    aria-label="Show terminal"
                    onClick={() => activateTab("terminal")}
                    title="Terminal"
                  >
                    <TerminalSquare size={16} />
                  </button>
                  <details className="preview-menu">
                    <summary aria-label="Preview menu" title="Preview menu">
                      <MoreHorizontal size={13} />
                    </summary>
                    <div className="ui-menu preview-menu-popover">
                      <button
                        disabled={!previewUrl}
                        onClick={() => {
                          if (!previewUrl) return;
                          void navigator.clipboard
                            .writeText(previewUrl)
                            .then(() => addToast("Preview URL copied"))
                            .catch(() =>
                              addToast("Could not copy preview URL", "danger"),
                            );
                        }}
                      >
                        Copy address
                      </button>
                      <button onClick={resetPreview}>Reset preview</button>
                    </div>
                  </details>
                  <button
                    aria-label="Open preview in default browser"
                    disabled={!previewUrl}
                    onClick={() => {
                      if (!previewUrl) return;
                      void window.codexDesktop
                        .openExternal(previewUrl)
                        .catch((error) =>
                          addToast(
                            `Could not open preview: ${error instanceof Error ? error.message : String(error)}`,
                            "danger",
                          ),
                        );
                    }}
                    title="Open in default browser"
                  >
                    <PanelRightClose size={16} />
                  </button>
                </div>
              </div>

              {previewError ? (
                <div
                  className="preview-url-error"
                  id="preview-url-error"
                  role="alert"
                >
                  {previewError}
                </div>
              ) : null}

              <div className="preview-viewport">
                {previewUrl ? (
                  <>
                    {previewLoading ? (
                      <div className="preview-loading" role="status">
                        <RefreshCw className="spin" size={15} /> Loading local
                        preview…
                      </div>
                    ) : null}
                    <iframe
                      allow="camera 'none'; clipboard-read 'none'; clipboard-write 'none'; geolocation 'none'; microphone 'none'"
                      key={`${previewUrl}-${previewFrameVersion}`}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError(
                          "The local preview could not be loaded. Check that its development server is running.",
                        );
                      }}
                      onLoad={() => {
                        setPreviewLoading(false);
                        onPreviewReady();
                      }}
                      referrerPolicy="no-referrer"
                      sandbox="allow-forms allow-same-origin allow-scripts"
                      src={previewUrl}
                      title="Local web preview"
                    />
                  </>
                ) : (
                  <div className="panel-empty preview-empty">
                    <Paintbrush size={27} />
                    <strong>Open a local app on Canvas</strong>
                    <span>
                      Enter a localhost URL above and press Return. External
                      hosts are blocked.
                    </span>
                    <button
                      className="button-secondary"
                      onClick={() => navigatePreview(previewDraft)}
                    >
                      Open {DEFAULT_PREVIEW_URL}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : tab === "files" ? (
            <div className="file-explorer file-explorer-surface">
              <div className="explorer-heading">
                <strong>
                  {workspace?.split(/[\\/]/).filter(Boolean).pop() ??
                    "Explorer"}
                </strong>
                <button
                  aria-label="Refresh files"
                  disabled={!workspace}
                  onClick={() => void refreshTree()}
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              {workspace ? (
                <>
                  <label className="explorer-search">
                    <Search size={12} />
                    <input
                      aria-label="Filter files"
                      onChange={(event) => setFilter(event.target.value)}
                      placeholder="Filter files"
                      value={filter}
                    />
                  </label>
                  <div className="file-tree">
                    {visibleEntries.map((entry) => {
                      const path = appendPath(workspace, entry.fileName);
                      return (
                        <DirectoryNode
                          depth={0}
                          entry={entry}
                          key={path}
                          onOpen={(selectedPath) => void openFile(selectedPath)}
                          path={path}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="panel-empty explorer-empty">
                  <Files size={25} />
                  <strong>Open a repository</strong>
                  <span>Choose a project to browse and edit its files.</span>
                  <button
                    className="button-secondary"
                    onClick={() => void controller.chooseWorkspace()}
                  >
                    Open Repository
                  </button>
                </div>
              )}
            </div>
          ) : tab === "changes" ? (
            <ChangeReviewPanel
              branch={
                controller.activeThread?.gitInfo?.branch ?? "Current branch"
              }
              diff={controller.diff}
              items={controller.items}
              selectedPath={activeChangePath}
            />
          ) : tab === "terminal" ? (
            <Suspense
              fallback={
                <div className="panel-empty">
                  <RefreshCw className="spin" size={18} /> Starting terminal…
                </div>
              }
            >
              <TerminalPanel
                cwd={workspace}
                fontSize={controller.preferences.editorFontSize}
                runtime={controller.runtime}
              />
            </Suspense>
          ) : activeDocument ? (
            <div className="editor-wrap">
              <div className="editor-toolbar">
                <span>{activeDocument.path}</span>
                {activeDocument.externalChanged ? (
                  <strong className="external-change-warning">
                    Changed on disk
                  </strong>
                ) : null}
                <button
                  disabled={
                    !activeDocument.dirty ||
                    savingPaths.has(activeDocument.path)
                  }
                  onClick={() => void saveActive()}
                >
                  <Save size={13} />
                  {savingPaths.has(activeDocument.path)
                    ? "Saving…"
                    : "Save"}{" "}
                  <kbd>⌘S</kbd>
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="panel-empty">
                    <RefreshCw className="spin" size={18} /> Loading editor…
                  </div>
                }
              >
                <CodeEditor
                  document={activeDocument}
                  fontSize={controller.preferences.editorFontSize}
                  onChange={(value) =>
                    setDocuments((current) =>
                      current.map((document) =>
                        document.path === activeDocument.path
                          ? {
                              ...document,
                              dirty: (value ?? "") !== document.originalText,
                              text: value ?? "",
                            }
                          : document,
                      ),
                    )
                  }
                  onSave={() => void saveActive()}
                  theme={controller.preferences.theme}
                />
              </Suspense>
            </div>
          ) : (
            <div className="panel-empty">
              <Code2 size={24} />
              <strong>No file open</strong>
              <span>Select a file from the project explorer.</span>
              <button
                className="button-secondary"
                onClick={() => activateTab("files")}
              >
                Open Explorer
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
