import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  File,
  FileDiff,
  Folder,
  GitPullRequest,
  Globe2,
  Maximize2,
  MoreHorizontal,
  Paintbrush,
  PanelRightClose,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  TerminalSquare,
  X,
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

import type { DirectoryEntry, OpenDocument } from "../../shared/types";
import { validatePreviewUrl } from "../../shared/preview-url";
import type { CodexController } from "../state/useCodexController";
import {
  decodeBase64Text,
  encodeBase64Text,
  languageForPath,
} from "../lib/encoding";

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
  requestedFile: string | null;
  requestedTab: "changes" | "terminal" | null;
  onClose(): void;
  onPreviewReady(): void;
  onRequestConsumed(): void;
  onTabRequestConsumed(): void;
};

type DirectoryNodeProps = {
  depth: number;
  entry: DirectoryEntry;
  onOpen(path: string): void;
  path: string;
};

type WorkspaceTab = "changes" | "editor" | "preview" | "terminal";

type PreviewNavigation = {
  entries: string[];
  index: number;
};

const DEFAULT_PREVIEW_URL = "http://localhost:5173";

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
  onClose,
  onPreviewReady,
  onRequestConsumed,
  onTabRequestConsumed,
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
  const [tab, setTab] = useState<WorkspaceTab>(
    initialPreviewUrl ? "preview" : "editor",
  );
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
  const documentsRef = useRef<OpenDocument[]>([]);
  const loadedWorkspaceRef = useRef<string | null>(workspace);
  const savingPathsRef = useRef<Set<string>>(new Set());
  const treeRequestGeneration = useRef(0);
  const activeDocument =
    documents.find((document) => document.path === activePath) ?? null;
  const previewUrl = previewNavigation.entries[previewNavigation.index] ?? null;
  const previewLocation = previewUrl ? new URL(previewUrl) : null;
  const previewWorkspaceName = workspace
    ?.split(/[\\/]/)
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const previewLabel = previewLocation
    ? `${previewWorkspaceName || previewLocation.hostname}${previewLocation.port ? ` :${previewLocation.port}` : ""}`
    : "Preview";

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
        setTab("editor");
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
        setTab("editor");
      } catch (error) {
        if (loadedWorkspaceRef.current !== requestedWorkspace) return;
        addToast(
          `Could not open file: ${error instanceof Error ? error.message : String(error)}`,
          "danger",
        );
      }
    },
    [addToast, documents, workspace],
  );

  useEffect(() => {
    if (requestedFile) {
      void openFile(requestedFile);
      onRequestConsumed();
    }
  }, [onRequestConsumed, openFile, requestedFile]);

  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
      onTabRequestConsumed();
    }
  }, [onTabRequestConsumed, requestedTab]);

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
      setTab("preview");
    },
    [previewNavigation],
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

  return (
    <aside
      aria-hidden={hidden || undefined}
      className={`workspace-panel ${hidden ? "workspace-panel-hidden" : ""} ${workspaceFocused ? "workspace-focused" : ""}`}
    >
      <div className="workspace-tabs">
        <button
          className={`workspace-preview-primary ${tab === "preview" ? "active" : ""}`}
          onClick={() => setTab("preview")}
          title={previewUrl ?? "Open a local web preview"}
        >
          <Globe2 size={13} /> {previewLabel}
        </button>
        {referenceCapture && previewUrl ? (
          <button
            className="workspace-preview-secondary"
            onClick={() => {
              const alternate = new URL(previewUrl);
              alternate.port = String(Number(alternate.port || "80") + 1);
              navigatePreview(alternate.toString());
            }}
            title="Open the adjacent local preview"
          >
            <Globe2 size={13} /> Signal Arena <span>:5174</span>
          </button>
        ) : null}
        {documents.map((document) => (
          <button
            className={
              tab === "editor" && activePath === document.path ? "active" : ""
            }
            key={document.path}
            onClick={() => {
              setActivePath(document.path);
              setTab("editor");
            }}
            title={document.path}
          >
            <Code2 size={13} />
            {document.path.split(/[\\/]/).pop()}
            {document.dirty ? <span className="dirty-dot" /> : null}
            <X
              size={11}
              onClick={(event) => {
                event.stopPropagation();
                if (
                  document.dirty &&
                  !window.confirm(
                    `Discard unsaved changes to ${document.path}?`,
                  )
                ) {
                  return;
                }
                setDocuments((current) => {
                  const next = current.filter(
                    (item) => item.path !== document.path,
                  );
                  if (activePath === document.path) {
                    setActivePath(next.at(-1)?.path ?? null);
                  }
                  return next;
                });
              }}
            />
          </button>
        ))}
        {referenceCapture &&
        !documents.some((document) =>
          document.path.endsWith("capture-ui.mjs"),
        ) ? (
          <button
            onClick={() => {
              if (workspace)
                void openFile(appendPath(workspace, "capture-ui.mjs"));
            }}
          >
            <span className="javascript-tab-icon">JS</span> capture-ui.mjs
          </button>
        ) : null}
        <button
          className={`workspace-pr-tab ${tab === "changes" ? "active" : ""}`}
          onClick={() => setTab("changes")}
        >
          <GitPullRequest size={13} /> PR
          {controller.diff ? <span className="tab-badge">•</span> : null}
        </button>
        {tab === "terminal" ? (
          <button className="active" onClick={() => setTab("terminal")}>
            <TerminalSquare size={13} /> Terminal
          </button>
        ) : null}
        <span className="workspace-tab-spacer" />
        <div className="workspace-tab-actions">
          <button
            aria-label="Open a new preview"
            onClick={() => navigatePreview(DEFAULT_PREVIEW_URL)}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label={workspaceFocused ? "Restore panel" : "Maximize panel"}
            onClick={() => setWorkspaceFocused((current) => !current)}
          >
            <Maximize2 size={16} />
          </button>
          <button aria-label="Hide workspace panel" onClick={onClose}>
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>

      <div
        className={`workspace-body ${tab === "preview" ? "workspace-body-preview" : ""}`}
      >
        <div className="workspace-main">
          {tab === "preview" ? (
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
                    onClick={() => setTab("terminal")}
                    title="Terminal"
                  >
                    <TerminalSquare size={16} />
                  </button>
                  <details className="preview-menu">
                    <summary aria-label="Preview menu" title="Preview menu">
                      <MoreHorizontal size={13} />
                    </summary>
                    <div className="preview-menu-popover">
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
                    <Globe2 size={27} />
                    <strong>Preview a local web app</strong>
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
          ) : tab === "changes" ? (
            controller.diff ? (
              <pre className="unified-diff">{controller.diff}</pre>
            ) : (
              <div className="panel-empty">
                <FileDiff size={24} /> No changes in this task yet.
              </div>
            )
          ) : tab === "terminal" ? (
            <Suspense
              fallback={
                <div className="panel-empty">
                  <RefreshCw className="spin" size={18} /> Starting terminal…
                </div>
              }
            >
              <TerminalPanel cwd={workspace} runtime={controller.runtime} />
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
              <Code2 size={24} /> Select a file from the explorer.
            </div>
          )}
        </div>

        {tab !== "preview" ? (
          <div className="file-explorer">
            <div className="explorer-heading">
              <strong>
                {workspace?.split(/[\\/]/).filter(Boolean).pop() ?? "Explorer"}
              </strong>
              <button
                aria-label="Refresh files"
                onClick={() => void refreshTree()}
              >
                <RefreshCw size={12} />
              </button>
            </div>
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
                const path = workspace
                  ? appendPath(workspace, entry.fileName)
                  : entry.fileName;
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
          </div>
        ) : null}
      </div>
    </aside>
  );
}
