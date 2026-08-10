import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Account,
  DesktopEvent,
  DesktopPreferences,
  JsonObject,
  JsonValue,
  Model,
  RuntimeStatus,
  ServerRequest,
  Thread,
  ThreadItem,
  Turn,
} from "../../shared/types";

export type AppView =
  | "automations"
  | "customize"
  | "new"
  | "settings"
  | "thread";

export type PlanStep = {
  status: "completed" | "inProgress" | "pending";
  step: string;
};

export type Toast = {
  id: string;
  message: string;
  tone: "danger" | "info" | "success";
};

type ThreadListResponse = { data: Thread[]; nextCursor: string | null };
type ModelListResponse = { data: Model[]; nextCursor: string | null };
type AccountReadResponse = {
  account: Account | null;
  requiresOpenaiAuth: boolean;
};
type TurnsPage = {
  data: Turn[];
  nextCursor: string | null;
  backwardsCursor: string | null;
};
type ThreadResponse = {
  thread: Thread;
  model?: string;
  initialTurnsPage?: TurnsPage | null;
};
type TurnResponse = { turn: Turn };

const THREAD_PAGE_SIZE = 100;
const MAX_THREAD_PAGES = 10;

async function listRecentThreads(
  initialCursor: string | null = null,
): Promise<ThreadListResponse> {
  const threads: Thread[] = [];
  let cursor: string | null = initialCursor;
  for (let page = 0; page < MAX_THREAD_PAGES; page += 1) {
    const response: ThreadListResponse =
      await window.codexDesktop.request<ThreadListResponse>("thread/list", {
        archived: false,
        cursor,
        limit: THREAD_PAGE_SIZE,
        sortDirection: "desc",
        sortKey: "updated_at",
      });
    for (const thread of response.data) {
      if (!threads.some((candidate) => candidate.id === thread.id)) {
        threads.push(thread);
      }
    }
    cursor = response.nextCursor;
    if (!cursor) break;
  }
  return { data: threads, nextCursor: cursor };
}

const DEFAULT_PREFERENCES: DesktopPreferences = {
  approvalPolicy: "on-request",
  editorFontSize: 13,
  lastWorkspace: null,
  recentWorkspaces: [],
  rightPanelOpen: true,
  sandbox: "workspace-write",
  selectedEffort: "high",
  selectedModel: null,
  sidebarOpen: true,
  theme: "dark",
};

function mergeItems(
  current: ThreadItem[],
  incoming: ThreadItem[],
): ThreadItem[] {
  const merged = [...current];
  for (const item of incoming) {
    const index = merged.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) {
      merged[index] = item;
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function mergeTurns(current: Turn[], incoming: Turn): Turn[] {
  const index = current.findIndex((turn) => turn.id === incoming.id);
  if (index < 0) {
    return [...current, incoming];
  }
  const existing = current[index];
  if (!existing) {
    return current;
  }
  const merged = [...current];
  merged[index] = {
    ...existing,
    ...incoming,
    items: mergeItems(existing.items, incoming.items),
  };
  return merged;
}

function updateTurnItem(
  thread: Thread,
  turnId: string,
  updater: (items: ThreadItem[]) => ThreadItem[],
): Thread {
  return {
    ...thread,
    turns: thread.turns.map((turn) =>
      turn.id === turnId ? { ...turn, items: updater(turn.items) } : turn,
    ),
  };
}

function stringParam(params: JsonObject, key: string): string | null {
  return typeof params[key] === "string" ? params[key] : null;
}

function requestIdParam(
  params: JsonObject,
  key: string,
): number | string | null {
  const value = params[key];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function sameRequestId(left: number | string, right: number | string): boolean {
  return typeof left === typeof right && left === right;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function titleForThread(thread: Thread): string {
  return thread.name?.trim() || thread.preview.trim() || "Untitled task";
}

export function useCodexController() {
  const [runtime, setRuntime] = useState<RuntimeStatus>({ phase: "starting" });
  const [preferences, setPreferencesState] =
    useState<DesktopPreferences>(DEFAULT_PREFERENCES);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [view, setView] = useState<AppView>("new");
  const [diff, setDiff] = useState("");
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [tokenPercent, setTokenPercent] = useState(0);
  const [serverRequests, setServerRequests] = useState<ServerRequest[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [turnsNextCursor, setTurnsNextCursor] = useState<string | null>(null);
  const [threadsNextCursor, setThreadsNextCursor] = useState<string | null>(
    null,
  );
  const [bootstrapped, setBootstrapped] = useState(false);
  const bootstrapping = useRef(false);
  const activeThreadRef = useRef<Thread | null>(null);
  const preferencesRef = useRef(preferences);
  const workspaceContextRef = useRef<string | null>(preferences.lastWorkspace);
  const threadSelectionGeneration = useRef(0);
  const workspaceChangeGuardRef = useRef<
    ((nextWorkspace: string | null) => boolean) | null
  >(null);
  const previousRuntimePhase = useRef(runtime.phase);

  useEffect(() => {
    activeThreadRef.current = activeThread;
    if (activeThread) {
      workspaceContextRef.current = activeThread.cwd;
    } else if (!loadingThread) {
      workspaceContextRef.current = preferences.lastWorkspace;
    }
  }, [activeThread, loadingThread, preferences.lastWorkspace]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const addToast = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, tone }].slice(-4));
      window.setTimeout(
        () =>
          setToasts((current) => current.filter((toast) => toast.id !== id)),
        5_000,
      );
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const updatePreferences = useCallback(
    async (patch: Partial<DesktopPreferences>) => {
      const next = await window.codexDesktop.setPreferences(patch);
      preferencesRef.current = next;
      setPreferencesState(next);
      return next;
    },
    [],
  );

  const registerWorkspaceChangeGuard = useCallback(
    (guard: (nextWorkspace: string | null) => boolean) => {
      workspaceChangeGuardRef.current = guard;
      return () => {
        if (workspaceChangeGuardRef.current === guard) {
          workspaceChangeGuardRef.current = null;
        }
      };
    },
    [],
  );

  const canChangeWorkspace = useCallback((nextWorkspace: string | null) => {
    return (
      workspaceContextRef.current === nextWorkspace ||
      (workspaceChangeGuardRef.current?.(nextWorkspace) ?? true)
    );
  }, []);

  const resetToNewTask = useCallback((workspace: string | null) => {
    threadSelectionGeneration.current += 1;
    activeThreadRef.current = null;
    workspaceContextRef.current = workspace;
    setActiveThread(null);
    setDiff("");
    setPlan([]);
    setTurnsNextCursor(null);
    setLoadingThread(false);
    setView("new");
  }, []);

  const refreshThreads = useCallback(async () => {
    const response = await listRecentThreads();
    setThreads(response.data);
    setThreadsNextCursor(response.nextCursor);
  }, []);

  const bootstrap = useCallback(async () => {
    if (bootstrapping.current) {
      return;
    }
    bootstrapping.current = true;
    try {
      const [savedPreferences, threadResponse, modelResponse, accountResponse] =
        await Promise.all([
          window.codexDesktop.getPreferences(),
          listRecentThreads(),
          window.codexDesktop.request<ModelListResponse>("model/list", {
            includeHidden: false,
          }),
          window.codexDesktop.request<AccountReadResponse>("account/read", {
            refreshToken: false,
          }),
        ]);
      preferencesRef.current = savedPreferences;
      setPreferencesState(savedPreferences);
      setThreads(threadResponse.data);
      setThreadsNextCursor(threadResponse.nextCursor);
      setModels(modelResponse.data);
      setAccount(accountResponse.account);
      setRequiresAuth(accountResponse.requiresOpenaiAuth);
      const selectedModel =
        modelResponse.data.find(
          (model) => model.id === savedPreferences.selectedModel,
        ) ??
        modelResponse.data.find((model) => model.isDefault) ??
        modelResponse.data[0];
      const preferencePatch: Partial<DesktopPreferences> = {};
      if (!savedPreferences.selectedModel && selectedModel) {
        preferencePatch.selectedModel = selectedModel.id;
      }
      if (
        selectedModel &&
        !selectedModel.supportedReasoningEfforts.some(
          (option) =>
            option.reasoningEffort === savedPreferences.selectedEffort,
        )
      ) {
        preferencePatch.selectedEffort = selectedModel.defaultReasoningEffort;
      }
      if (Object.keys(preferencePatch).length > 0) {
        await updatePreferences(preferencePatch);
      }
      setBootstrapped(true);
    } catch (error) {
      addToast(`Could not load Codex: ${messageForError(error)}`, "danger");
    } finally {
      bootstrapping.current = false;
    }
  }, [addToast, updatePreferences]);

  const applyNotification = useCallback(
    (method: string, params: JsonObject) => {
      const threadId = stringParam(params, "threadId");
      const turnId = stringParam(params, "turnId");

      if (method === "desktop/deepLink") {
        const rawUrl = stringParam(params, "url");
        if (rawUrl) {
          try {
            const url = new URL(rawUrl);
            if (url.hostname === "threads" && url.pathname === "/new") {
              const path = url.searchParams.get("path");
              const validPath =
                path &&
                /^(?:[A-Za-z]:[\\/]|\/)/.test(path) &&
                !/^(?:[\\/]{2})/.test(path)
                  ? path
                  : null;
              const previousPreferences = preferencesRef.current;
              const nextWorkspace =
                validPath ?? previousPreferences.lastWorkspace;
              if (!canChangeWorkspace(nextWorkspace)) {
                void updatePreferences({
                  lastWorkspace: previousPreferences.lastWorkspace,
                  recentWorkspaces: previousPreferences.recentWorkspaces,
                }).catch((error: unknown) =>
                  addToast(
                    `Could not restore repository selection: ${messageForError(error)}`,
                    "danger",
                  ),
                );
                return;
              }
              if (validPath) {
                void updatePreferences({
                  lastWorkspace: validPath,
                  recentWorkspaces: [
                    validPath,
                    ...previousPreferences.recentWorkspaces.filter(
                      (entry) => entry !== validPath,
                    ),
                  ],
                });
              }
              resetToNewTask(nextWorkspace);
            } else if (url.hostname === "threads") {
              const id = url.pathname.replace(/^\//, "");
              const thread = threads.find((candidate) => candidate.id === id);
              if (thread) {
                void selectThreadInternal(thread);
              } else if (id) {
                void window.codexDesktop
                  .request<ThreadResponse>("thread/read", {
                    includeTurns: false,
                    threadId: id,
                  })
                  .then((response) => selectThreadInternal(response.thread))
                  .catch(() =>
                    addToast("The linked task could not be opened", "danger"),
                  );
              }
            }
          } catch {
            addToast("Ignored an invalid Codex deep link", "danger");
          }
        }
        return;
      }

      if (method === "serverRequest/resolved") {
        const requestId = requestIdParam(params, "requestId");
        if (requestId !== null) {
          setServerRequests((current) =>
            current.filter((request) => !sameRequestId(request.id, requestId)),
          );
        }
        return;
      }

      if (
        method === "thread/status/changed" &&
        threadId &&
        isObject(params.status)
      ) {
        setThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? { ...thread, status: params.status as Thread["status"] }
              : thread,
          ),
        );
        setActiveThread((thread) =>
          thread?.id === threadId
            ? { ...thread, status: params.status as Thread["status"] }
            : thread,
        );
        return;
      }

      if (method === "thread/name/updated" && threadId) {
        const name = stringParam(params, "threadName");
        setThreads((current) =>
          current.map((thread) =>
            thread.id === threadId ? { ...thread, name } : thread,
          ),
        );
        setActiveThread((thread) =>
          thread?.id === threadId ? { ...thread, name } : thread,
        );
        return;
      }

      if (method === "turn/started" && threadId && isObject(params.turn)) {
        const incoming = params.turn as unknown as Turn;
        setActiveThread((thread) =>
          thread?.id === threadId
            ? {
                ...thread,
                status: { type: "active", activeFlags: [] },
                turns: mergeTurns(thread.turns, incoming),
              }
            : thread,
        );
        return;
      }

      if (method === "turn/completed" && threadId && isObject(params.turn)) {
        const incoming = params.turn as unknown as Turn;
        setActiveThread((thread) =>
          thread?.id === threadId
            ? {
                ...thread,
                status: { type: "idle" },
                turns: mergeTurns(thread.turns, incoming),
              }
            : thread,
        );
        void refreshThreads();
        return;
      }

      if (
        (method === "item/started" || method === "item/completed") &&
        threadId &&
        turnId &&
        isObject(params.item)
      ) {
        const incoming = params.item as unknown as ThreadItem;
        setActiveThread((thread) =>
          thread?.id === threadId
            ? updateTurnItem(thread, turnId, (items) =>
                mergeItems(items, [incoming]),
              )
            : thread,
        );
        return;
      }

      if (method === "item/agentMessage/delta" && threadId && turnId) {
        const itemId = stringParam(params, "itemId");
        const delta = stringParam(params, "delta");
        if (!itemId || delta === null) {
          return;
        }
        setActiveThread((thread) => {
          if (thread?.id !== threadId) {
            return thread;
          }
          return updateTurnItem(thread, turnId, (items) => {
            const index = items.findIndex((item) => item.id === itemId);
            const next = [...items];
            if (index >= 0) {
              const current = next[index];
              if (current?.type === "agentMessage") {
                next[index] = { ...current, text: `${current.text}${delta}` };
              }
            } else {
              next.push({
                type: "agentMessage",
                id: itemId,
                text: delta,
                phase: null,
                memoryCitation: null,
              });
            }
            return next;
          });
        });
        return;
      }

      if (
        (method === "item/reasoning/summaryTextDelta" ||
          method === "item/reasoning/textDelta") &&
        threadId &&
        turnId
      ) {
        const itemId = stringParam(params, "itemId");
        const delta = stringParam(params, "delta");
        if (!itemId || delta === null) {
          return;
        }
        const summary = method.includes("summary");
        setActiveThread((thread) => {
          if (thread?.id !== threadId) {
            return thread;
          }
          return updateTurnItem(thread, turnId, (items) => {
            const index = items.findIndex((item) => item.id === itemId);
            const next = [...items];
            if (index >= 0) {
              const current = next[index];
              if (current?.type === "reasoning") {
                const field = summary
                  ? [...current.summary]
                  : [...current.content];
                const partIndex = Number(
                  params[summary ? "summaryIndex" : "contentIndex"] ?? 0,
                );
                field[partIndex] = `${field[partIndex] ?? ""}${delta}`;
                next[index] = summary
                  ? { ...current, summary: field }
                  : { ...current, content: field };
              }
            } else {
              next.push({
                type: "reasoning",
                id: itemId,
                summary: summary ? [delta] : [],
                content: summary ? [] : [delta],
              });
            }
            return next;
          });
        });
        return;
      }

      if (
        method === "item/commandExecution/outputDelta" &&
        threadId &&
        turnId
      ) {
        const itemId = stringParam(params, "itemId");
        const delta = stringParam(params, "delta");
        if (!itemId || delta === null) {
          return;
        }
        setActiveThread((thread) =>
          thread?.id === threadId
            ? updateTurnItem(thread, turnId, (items) =>
                items.map((item) =>
                  item.id === itemId && item.type === "commandExecution"
                    ? {
                        ...item,
                        aggregatedOutput: `${item.aggregatedOutput ?? ""}${delta}`,
                      }
                    : item,
                ),
              )
            : thread,
        );
        return;
      }

      if (
        method === "item/fileChange/patchUpdated" &&
        threadId &&
        turnId &&
        Array.isArray(params.changes)
      ) {
        const itemId = stringParam(params, "itemId");
        if (!itemId) return;
        const changes = params.changes as unknown as Extract<
          ThreadItem,
          { type: "fileChange" }
        >["changes"];
        setActiveThread((thread) =>
          thread?.id === threadId
            ? updateTurnItem(thread, turnId, (items) =>
                items.map((item) =>
                  item.id === itemId && item.type === "fileChange"
                    ? { ...item, changes }
                    : item,
                ),
              )
            : thread,
        );
        return;
      }

      if (
        method === "turn/diff/updated" &&
        threadId === activeThreadRef.current?.id
      ) {
        setDiff(stringParam(params, "diff") ?? "");
        return;
      }

      if (
        method === "turn/plan/updated" &&
        threadId === activeThreadRef.current?.id
      ) {
        const rawPlan = Array.isArray(params.plan) ? params.plan : [];
        setPlan(
          rawPlan.filter(isObject).map((step) => ({
            status:
              step.status === "completed" || step.status === "inProgress"
                ? step.status
                : "pending",
            step: typeof step.step === "string" ? step.step : "Working",
          })),
        );
        return;
      }

      if (
        method === "thread/tokenUsage/updated" &&
        threadId === activeThreadRef.current?.id
      ) {
        const usage = isObject(params.tokenUsage)
          ? params.tokenUsage
          : undefined;
        const totalBreakdown = isObject(usage?.total) ? usage.total : undefined;
        const total = Number(totalBreakdown?.totalTokens ?? 0);
        const window = Number(usage?.modelContextWindow ?? 0);
        setTokenPercent(
          window > 0 ? Math.min(100, Math.round((total / window) * 100)) : 0,
        );
        return;
      }

      if (method === "account/updated") {
        void window.codexDesktop
          .request<AccountReadResponse>("account/read", { refreshToken: false })
          .then((response) => {
            setAccount(response.account);
            setRequiresAuth(response.requiresOpenaiAuth);
          })
          .catch((error: unknown) =>
            addToast(
              `Could not refresh account: ${messageForError(error)}`,
              "danger",
            ),
          );
        return;
      }

      if (
        method === "thread/started" ||
        method === "thread/archived" ||
        method === "thread/deleted" ||
        method === "thread/unarchived"
      ) {
        void refreshThreads();
        return;
      }

      if (
        method === "error" ||
        method === "warning" ||
        method === "configWarning"
      ) {
        const nestedError = isObject(params.error) ? params.error : undefined;
        const message =
          stringParam(params, "message") ??
          stringParam(params, "summary") ??
          (nestedError ? stringParam(nestedError, "message") : null) ??
          "Codex reported an issue";
        addToast(message, method === "error" ? "danger" : "info");
        return;
      }

      if (method === "desktop/protocolWarning") {
        addToast(
          stringParam(params, "detail") ?? "Ignored an invalid runtime message",
          "danger",
        );
      }
    },
    [
      addToast,
      canChangeWorkspace,
      refreshThreads,
      resetToNewTask,
      threads,
      updatePreferences,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    void window.codexDesktop.getPreferences().then((value) => {
      if (!cancelled) {
        preferencesRef.current = value;
        setPreferencesState(value);
      }
    });
    const unsubscribe = window.codexDesktop.onEvent((event: DesktopEvent) => {
      if (event.type === "runtime") {
        setRuntime(event.payload);
        if (event.payload.phase !== "ready") {
          setServerRequests([]);
        }
        return;
      }
      if (event.type === "server-request") {
        setServerRequests((current) => {
          const incoming = event.payload as ServerRequest;
          return current.some((request) =>
            sameRequestId(request.id, incoming.id),
          )
            ? current
            : [...current, incoming];
        });
        return;
      }
      const notification = event.payload as unknown as {
        method: string;
        params?: JsonObject;
      };
      applyNotification(notification.method, notification.params ?? {});
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyNotification]);

  const selectThreadInternal = useCallback(
    async (thread: Thread) => {
      if (!canChangeWorkspace(thread.cwd)) return;
      const previousThread = activeThreadRef.current;
      const previousWorkspace = workspaceContextRef.current;
      const generation = ++threadSelectionGeneration.current;
      activeThreadRef.current = null;
      setActiveThread(null);
      setLoadingThread(true);
      setView("thread");
      setDiff("");
      setPlan([]);
      setTurnsNextCursor(null);
      try {
        let response: ThreadResponse;
        try {
          response = await window.codexDesktop.request<ThreadResponse>(
            "thread/resume",
            {
              excludeTurns: true,
              initialTurnsPage: {
                itemsView: "full",
                limit: 30,
                sortDirection: "desc",
              },
              threadId: thread.id,
            },
          );
        } catch {
          response = await window.codexDesktop.request<ThreadResponse>(
            "thread/read",
            {
              includeTurns: true,
              threadId: thread.id,
            },
          );
        }
        if (generation !== threadSelectionGeneration.current) return;
        const initialTurns = response.initialTurnsPage?.data
          ? [...response.initialTurnsPage.data].reverse()
          : response.thread.turns;
        const hydratedThread = { ...response.thread, turns: initialTurns };
        setTurnsNextCursor(response.initialTurnsPage?.nextCursor ?? null);
        activeThreadRef.current = hydratedThread;
        workspaceContextRef.current = hydratedThread.cwd;
        setActiveThread(hydratedThread);
      } catch (error) {
        if (generation !== threadSelectionGeneration.current) return;
        addToast(`Could not open task: ${messageForError(error)}`, "danger");
        activeThreadRef.current = previousThread;
        workspaceContextRef.current = previousWorkspace;
        setActiveThread(previousThread);
        setView(previousThread ? "thread" : "new");
      } finally {
        if (generation === threadSelectionGeneration.current) {
          setLoadingThread(false);
        }
      }
    },
    [addToast, canChangeWorkspace],
  );

  useEffect(() => {
    const previousPhase = previousRuntimePhase.current;
    previousRuntimePhase.current = runtime.phase;
    if (runtime.phase !== "ready") return;

    void bootstrap();
    if (previousPhase !== "ready") {
      const thread = activeThreadRef.current;
      if (thread) void selectThreadInternal(thread);
    }
  }, [bootstrap, runtime.phase, selectThreadInternal]);

  const selectThread = useCallback(
    (thread: Thread) => void selectThreadInternal(thread),
    [selectThreadInternal],
  );

  const newTask = useCallback(() => {
    const workspace = preferencesRef.current.lastWorkspace;
    if (!canChangeWorkspace(workspace)) return;
    resetToNewTask(workspace);
  }, [canChangeWorkspace, resetToNewTask]);

  const chooseWorkspace = useCallback(async () => {
    const previousPreferences = preferencesRef.current;
    const selected = await window.codexDesktop.chooseWorkspace();
    if (selected) {
      if (!canChangeWorkspace(selected)) {
        const restored = await window.codexDesktop.setPreferences({
          lastWorkspace: previousPreferences.lastWorkspace,
          recentWorkspaces: previousPreferences.recentWorkspaces,
        });
        preferencesRef.current = restored;
        setPreferencesState(restored);
        return null;
      }
      const next = await window.codexDesktop.getPreferences();
      preferencesRef.current = next;
      setPreferencesState(next);
      resetToNewTask(selected);
    }
    return selected;
  }, [canChangeWorkspace, resetToNewTask]);

  const submitPrompt = useCallback(
    async (text: string, attachments: string[] = []) => {
      const prompt = text.trim();
      if (!prompt) {
        return false;
      }
      if (new TextEncoder().encode(prompt).byteLength > 32 * 1_024) {
        addToast("Prompts are limited to 32 KiB of text", "danger");
        return false;
      }
      try {
        let thread = activeThreadRef.current;
        if (!thread) {
          let cwd = preferences.lastWorkspace;
          if (!cwd) {
            cwd = await chooseWorkspace();
          }
          if (!cwd) {
            return false;
          }
          const started = await window.codexDesktop.request<ThreadResponse>(
            "thread/start",
            {
              approvalPolicy: preferences.approvalPolicy,
              cwd,
              model: preferences.selectedModel,
              sandbox: preferences.sandbox,
            },
          );
          thread = started.thread;
          activeThreadRef.current = thread;
          setActiveThread(thread);
          setView("thread");
          setThreads((current) => [
            thread as Thread,
            ...current.filter((item) => item.id !== thread?.id),
          ]);
        }

        const activeTurn = [...thread.turns]
          .reverse()
          .find((turn) => turn.status === "inProgress");
        const input = [
          { type: "text", text: prompt, text_elements: [] },
          ...attachments.map((path) => {
            const name = path.split(/[\\/]/).pop() ?? path;
            if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(path)) {
              return { type: "localImage", path };
            }
            if (/\.(?:aac|flac|m4a|mp3|ogg|wav)$/i.test(path)) {
              return { type: "localAudio", path };
            }
            return { type: "mention", name, path };
          }),
        ] as unknown as JsonValue[];
        if (activeTurn) {
          await window.codexDesktop.request("turn/steer", {
            expectedTurnId: activeTurn.id,
            input,
            threadId: thread.id,
          });
        } else {
          const response = await window.codexDesktop.request<TurnResponse>(
            "turn/start",
            {
              effort: preferences.selectedEffort,
              input,
              model: preferences.selectedModel,
              threadId: thread.id,
            },
          );
          setActiveThread((current) =>
            current?.id === thread?.id
              ? { ...current, turns: mergeTurns(current.turns, response.turn) }
              : current,
          );
        }
        return true;
      } catch (error) {
        addToast(`Could not send prompt: ${messageForError(error)}`, "danger");
        return false;
      }
    },
    [addToast, chooseWorkspace, preferences],
  );

  const interrupt = useCallback(async () => {
    const thread = activeThreadRef.current;
    const activeTurn = thread?.turns.find(
      (turn) => turn.status === "inProgress",
    );
    if (!thread || !activeTurn) {
      return;
    }
    try {
      await window.codexDesktop.request("turn/interrupt", {
        threadId: thread.id,
        turnId: activeTurn.id,
      });
    } catch (error) {
      addToast(`Could not stop turn: ${messageForError(error)}`, "danger");
    }
  }, [addToast]);

  const loadOlderTurns = useCallback(async () => {
    const thread = activeThreadRef.current;
    if (!thread || !turnsNextCursor || loadingThread) return;
    const generation = threadSelectionGeneration.current;
    setLoadingThread(true);
    try {
      const response = await window.codexDesktop.request<TurnsPage>(
        "thread/turns/list",
        {
          cursor: turnsNextCursor,
          itemsView: "full",
          limit: 30,
          sortDirection: "desc",
          threadId: thread.id,
        },
      );
      if (
        generation !== threadSelectionGeneration.current ||
        activeThreadRef.current?.id !== thread.id
      ) {
        return;
      }
      const older = [...response.data].reverse();
      setActiveThread((current) => {
        if (current?.id !== thread.id) return current;
        const existing = new Set(current.turns.map((turn) => turn.id));
        return {
          ...current,
          turns: [
            ...older.filter((turn) => !existing.has(turn.id)),
            ...current.turns,
          ],
        };
      });
      setTurnsNextCursor(response.nextCursor);
    } catch (error) {
      if (
        generation !== threadSelectionGeneration.current ||
        activeThreadRef.current?.id !== thread.id
      ) {
        return;
      }
      addToast(
        `Could not load older turns: ${messageForError(error)}`,
        "danger",
      );
    } finally {
      if (
        generation === threadSelectionGeneration.current &&
        activeThreadRef.current?.id === thread.id
      ) {
        setLoadingThread(false);
      }
    }
  }, [addToast, loadingThread, turnsNextCursor]);

  const loadMoreThreads = useCallback(async () => {
    if (!threadsNextCursor) return;
    try {
      const response = await listRecentThreads(threadsNextCursor);
      setThreads((current) => {
        const existing = new Set(current.map((thread) => thread.id));
        return [
          ...current,
          ...response.data.filter((thread) => !existing.has(thread.id)),
        ];
      });
      setThreadsNextCursor(response.nextCursor);
    } catch (error) {
      addToast(
        `Could not load more tasks: ${messageForError(error)}`,
        "danger",
      );
    }
  }, [addToast, threadsNextCursor]);

  const respondToServerRequest = useCallback(
    async (request: ServerRequest, result: JsonValue) => {
      try {
        await window.codexDesktop.respond(request.id, result);
        setServerRequests((current) =>
          current.filter(
            (candidate) => !sameRequestId(candidate.id, request.id),
          ),
        );
      } catch (error) {
        addToast(
          `Could not answer request: ${messageForError(error)}`,
          "danger",
        );
      }
    },
    [addToast],
  );

  const archiveThread = useCallback(
    async (thread: Thread) => {
      const active = activeThreadRef.current?.id === thread.id;
      if (active && !canChangeWorkspace(preferencesRef.current.lastWorkspace)) {
        return;
      }
      try {
        await window.codexDesktop.request("thread/archive", {
          threadId: thread.id,
        });
        setThreads((current) =>
          current.filter((candidate) => candidate.id !== thread.id),
        );
        if (active) {
          resetToNewTask(preferencesRef.current.lastWorkspace);
        }
      } catch (error) {
        addToast(`Could not archive task: ${messageForError(error)}`, "danger");
      }
    },
    [addToast, canChangeWorkspace, resetToNewTask],
  );

  const renameThread = useCallback(
    async (thread: Thread, rawName: string) => {
      const name = rawName.trim().slice(0, 120);
      if (!name || name === titleForThread(thread)) {
        return;
      }
      try {
        await window.codexDesktop.request("thread/name/set", {
          name,
          threadId: thread.id,
        });
        setThreads((current) =>
          current.map((candidate) =>
            candidate.id === thread.id ? { ...candidate, name } : candidate,
          ),
        );
        setActiveThread((current) =>
          current?.id === thread.id ? { ...current, name } : current,
        );
      } catch (error) {
        addToast(`Could not rename task: ${messageForError(error)}`, "danger");
      }
    },
    [addToast],
  );

  const startReview = useCallback(async () => {
    const thread = activeThreadRef.current;
    if (!thread) {
      return;
    }
    try {
      const response = await window.codexDesktop.request<
        TurnResponse & { reviewThreadId: string }
      >("review/start", {
        delivery: "inline",
        target: { type: "uncommittedChanges" },
        threadId: thread.id,
      });
      setActiveThread((current) =>
        current?.id === response.reviewThreadId
          ? {
              ...current,
              status: { type: "active", activeFlags: [] },
              turns: mergeTurns(current.turns, response.turn),
            }
          : current,
      );
    } catch (error) {
      addToast(`Could not start review: ${messageForError(error)}`, "danger");
    }
  }, [addToast]);

  const activeTurn = useMemo(
    () =>
      activeThread?.turns.findLast((turn) => turn.status === "inProgress") ??
      null,
    [activeThread],
  );
  const items = useMemo(
    () => activeThread?.turns.flatMap((turn) => turn.items) ?? [],
    [activeThread],
  );
  const activeTitle = activeThread ? titleForThread(activeThread) : "New task";

  return {
    account,
    activeThread,
    activeTitle,
    activeTurn,
    addToast,
    archiveThread,
    bootstrapped,
    chooseWorkspace,
    diff,
    dismissToast,
    interrupt,
    items,
    loadingThread,
    loadOlderTurns,
    loadMoreThreads,
    models,
    newTask,
    plan,
    preferences,
    refreshThreads,
    registerWorkspaceChangeGuard,
    renameThread,
    requiresAuth,
    respondToServerRequest,
    runtime,
    selectThread,
    serverRequests,
    setView,
    startReview,
    submitPrompt,
    threads,
    threadsNextCursor,
    toasts,
    tokenPercent,
    turnsNextCursor,
    updatePreferences,
    view,
  };
}

export type CodexController = ReturnType<typeof useCodexController>;
