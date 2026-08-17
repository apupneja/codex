import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  HostEvent,
  JsonValue,
  Thread,
  ThreadItem,
  ThreadTokenUsage,
  Turn,
} from "../../shared/protocol";
import type { LocalAttachment } from "../../shared/bridge";
import { permissionDetails } from "../features/approvals/permission-request";
import { projectContainsPath } from "../features/projects/project-paths";
import { applyThreadItemStreamEvent } from "./thread-stream-events";
import {
  mergeCompletedTurn,
  mergeThreadCatalog,
  replaceTurn,
} from "./thread-store";

export type PromptDraft = {
  attachments?: LocalAttachment[];
  effort: string;
  model: string;
  text: string;
};
export type PermissionMode = "full" | "ask" | "read";
export type ProjectColor =
  | "black"
  | "blue"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow";
export type ProjectMarkerName =
  | "bar-chart"
  | "book"
  | "brain"
  | "currency-dollar"
  | "customize"
  | "desk-globe"
  | "dumbbell"
  | "edit"
  | "flask"
  | "folder"
  | "function"
  | "globe"
  | "graduation-cap"
  | "health"
  | "heart"
  | "kettlebell"
  | "logs"
  | "lotus"
  | "music"
  | "palette"
  | "paw"
  | "plane"
  | "plant"
  | "popcorn"
  | "scale"
  | "stethoscope"
  | "suitcase"
  | "terminal"
  | "wrench"
  | "writing";
export type ProjectAppearance = {
  color: ProjectColor;
  marker: ProjectMarkerName;
};
export type LocalProject = {
  appearance?: ProjectAppearance;
  createdAt: number;
  id: string;
  name: string;
  rootPaths: string[];
  updatedAt: number;
};
export type Approval = {
  id: string | number;
  method: string;
  params: Record<string, unknown>;
};
export type ApprovalDecision =
  | "accept"
  | "acceptForSession"
  | "cancel"
  | "decline"
  | {
      acceptWithExecpolicyAmendment: {
        execpolicy_amendment: string[];
      };
    }
  | {
      applyNetworkPolicyAmendment: {
        network_policy_amendment: Record<string, JsonValue>;
      };
    };

type SessionValue = {
  account: { email?: string | null; planType?: string; type: string } | null;
  auth: "loading" | "signedIn" | "signedOut";
  threads: Thread[];
  tokenUsage: ThreadTokenUsage | null;
  current: Thread | null;
  localProjects: LocalProject[];
  project: string | null;
  selectedProjectId: string | null;
  permissionMode: PermissionMode;
  models: Array<{ value: string; label: string }>;
  queue: PromptDraft[];
  activeTurnId: string | null;
  runtime: "connecting" | "online" | "offline";
  error: string | null;
  approvals: Approval[];
  openThread(thread: Thread): Promise<void>;
  startNewTask(): void;
  chooseProject(): Promise<void>;
  pickProjectFolder(): Promise<string | null>;
  createProject(
    name: string,
    rootPaths: string[],
    appearance?: ProjectAppearance,
  ): LocalProject;
  updateProject(
    projectId: string,
    name: string,
    rootPaths: string[],
    appearance?: ProjectAppearance,
  ): void;
  removeProject(projectId: string): void;
  selectProject(projectId: string | null): void;
  submit(draft: PromptDraft, followUpBehavior?: "queue" | "steer"): void;
  interrupt(): Promise<void>;
  archiveCurrent(): Promise<void>;
  forkCurrent(): Promise<Thread | null>;
  renameCurrent(name: string): Promise<void>;
  editQueuedPrompt(index: number): PromptDraft | null;
  removeQueuedPrompt(index: number): void;
  setPermissionMode(mode: PermissionMode): void;
  steerQueuedPrompt(index: number): Promise<void>;
  resolveApproval(approval: Approval, decision: ApprovalDecision): void;
  resolvePermissionRequest(
    request: Approval,
    scope: "session" | "turn" | null,
  ): void;
  resolveOptionPicker(
    request: Approval,
    response: {
      action: "dismiss" | "skip" | "submit";
      selectedOptions: string[];
      freeformAnswer: string | null;
    },
  ): void;
  resolveMcpElicitation(
    request: Approval,
    action: "accept" | "cancel" | "decline",
    content: JsonValue,
    responseMeta?: JsonValue,
  ): void;
  resolveSetupContextPicker(
    request: Approval,
    action: "continue" | "dismiss" | "skip",
    selectedSources: string[],
  ): void;
  resolveUserInput(request: Approval, answers: Record<string, string[]>): void;
  dismissUserInput(request: Approval): void;
  signIn(): Promise<void>;
  signInWithApiKey(apiKey: string): Promise<void>;
  logout(): Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

const LOCAL_PROJECTS_KEY = "chatgpt.local-projects";
const SELECTED_PROJECT_KEY = "chatgpt.selected-project";

const approvalNotificationTitles: Record<string, string> = {
  "item/commandExecution/requestApproval": "Command approval",
  "item/fileChange/requestApproval": "File edit approval",
  "item/permissions/requestApproval": "Permission approval",
};

function storedBoolean(key: string, fallback: boolean): boolean {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

function threadNotificationTitle(thread: Thread | undefined): string {
  const title = thread?.name?.trim() || thread?.preview?.trim();
  return title ? title.slice(0, 60) : "Turn complete";
}

function lastAgentMessage(turn: Turn): string {
  for (let index = turn.items.length - 1; index >= 0; index -= 1) {
    const item = turn.items[index];
    if (item.type !== "agentMessage") continue;
    if (item.text?.trim()) return item.text.trim();
    const content = item.content
      ?.map((part) =>
        typeof part === "string" ? part.trim() : (part.text?.trim() ?? ""),
      )
      .filter(Boolean)
      .join("\n");
    if (content) return content;
  }
  return "ChatGPT finished a turn.";
}

function readLocalProjects(): LocalProject[] {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) ?? "{}");
    const projects = Array.isArray(stored)
      ? stored
      : stored && typeof stored === "object"
        ? Object.values(stored)
        : [];
    return projects.filter(
      (project): project is LocalProject =>
        project != null &&
        typeof project === "object" &&
        typeof (project as LocalProject).id === "string" &&
        typeof (project as LocalProject).name === "string" &&
        Array.isArray((project as LocalProject).rootPaths) &&
        typeof (project as LocalProject).createdAt === "number" &&
        typeof (project as LocalProject).updatedAt === "number",
    );
  } catch {
    return [];
  }
}

function readSelectedProjectId(): string | null {
  return localStorage.getItem(SELECTED_PROJECT_KEY);
}

function createProjectId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const api = window.chatgptDesktop;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [account, setAccount] = useState<SessionValue["account"]>(null);
  const [auth, setAuth] = useState<SessionValue["auth"]>("loading");
  const [current, setCurrent] = useState<Thread | null>(null);
  const [localProjects, setLocalProjects] = useState(readLocalProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(
    readSelectedProjectId,
  );
  const [project, setProject] = useState<string | null>(() => {
    const selectedId = readSelectedProjectId();
    return (
      readLocalProjects().find((item) => item.id === selectedId)
        ?.rootPaths[0] ?? null
    );
  });
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const [models, setModels] = useState([{ value: "", label: "Default" }]);
  const [queue, setQueue] = useState<PromptDraft[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<SessionValue["runtime"]>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tokenUsageByThread, setTokenUsageByThread] = useState<
    Record<string, ThreadTokenUsage>
  >({});
  const currentId = useRef<string | null>(null);
  const threadsRef = useRef<Thread[]>([]);

  const refreshAuth = useCallback(async () => {
    try {
      const result = await api.request<{
        account?: SessionValue["account"];
        requiresOpenaiAuth?: boolean;
      }>("account/read", { refreshToken: false });
      setAuth(
        result.account || result.requiresOpenaiAuth === false
          ? "signedIn"
          : "signedOut",
      );
      setAccount(result.account ?? null);
    } catch {
      setAuth("signedIn");
    }
  }, [api]);

  useEffect(() => {
    currentId.current = current?.id ?? null;
  }, [current]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    localStorage.setItem(
      LOCAL_PROJECTS_KEY,
      JSON.stringify(
        Object.fromEntries(localProjects.map((item) => [item.id, item])),
      ),
    );
  }, [localProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  }, [selectedProjectId]);

  const selectProject = useCallback(
    (projectId: string | null) => {
      setSelectedProjectId(projectId);
      setProject(
        projectId == null
          ? null
          : (localProjects.find((item) => item.id === projectId)
              ?.rootPaths[0] ?? null),
      );
    },
    [localProjects],
  );

  const pickProjectFolder = useCallback(() => api.selectFolder(), [api]);

  const createProject = useCallback(
    (name: string, rootPaths: string[], appearance?: ProjectAppearance) => {
      const timestamp = Date.now();
      const nextProject: LocalProject = {
        appearance,
        createdAt: timestamp,
        id: createProjectId(),
        name: name.trim() || "New project",
        rootPaths: Array.from(new Set(rootPaths)),
        updatedAt: timestamp,
      };
      setLocalProjects((items) => [...items, nextProject]);
      setSelectedProjectId(nextProject.id);
      setProject(nextProject.rootPaths[0] ?? null);
      return nextProject;
    },
    [],
  );

  const updateProject = useCallback(
    (
      projectId: string,
      name: string,
      rootPaths: string[],
      appearance?: ProjectAppearance,
    ) => {
      const normalizedPaths = Array.from(new Set(rootPaths));
      setLocalProjects((items) =>
        items.map((item) =>
          item.id === projectId
            ? {
                ...item,
                appearance,
                name: name.trim() || item.name,
                rootPaths: normalizedPaths,
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
      if (selectedProjectId === projectId) {
        setProject(normalizedPaths[0] ?? null);
      }
    },
    [selectedProjectId],
  );

  const removeProject = useCallback(
    (projectId: string) => {
      setLocalProjects((items) =>
        items.filter((item) => item.id !== projectId),
      );
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setProject(null);
      }
    },
    [selectedProjectId],
  );

  const refreshThreads = useCallback(async () => {
    const localCatalog = api
      .listLocalThreads()
      .then((localThreads) => {
        setThreads((items) => mergeThreadCatalog(items, localThreads));
      })
      .catch(() => undefined);
    try {
      const result = await api.request<{ data: Thread[] }>("thread/list", {
        limit: 500,
        sortKey: "updated_at",
      });
      setThreads((items) => mergeThreadCatalog(result.data, items));
      setRuntime("online");
    } catch (reason) {
      setRuntime("offline");
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    await localCatalog;
  }, [api]);

  const refreshThread = useCallback(
    async (threadId: string) => {
      try {
        const result = await api.request<{ thread: Thread }>("thread/read", {
          includeTurns: true,
          threadId,
        });
        setThreads((items) => [
          result.thread,
          ...items.filter((item) => item.id !== threadId),
        ]);
        if (currentId.current === threadId) setCurrent(result.thread);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    },
    [api],
  );

  useEffect(() => {
    void refreshAuth();
    void refreshThreads();
    void api
      .request<{ data?: Array<Record<string, unknown>> }>("model/list", {
        limit: 100,
      })
      .then((result) => {
        const available = (result.data ?? [])
          .map((model) => {
            const value = String(model.id ?? model.model ?? model.slug ?? "");
            return {
              value,
              label: String(model.displayName ?? model.name ?? value),
            };
          })
          .filter((model) => model.value);
        if (available.length) {
          setModels([{ value: "", label: "Default" }, ...available]);
        }
      })
      .catch(() => undefined);
  }, [api, refreshAuth, refreshThreads]);

  const receive = useCallback(
    (event: HostEvent) => {
      if (event.kind === "runtime") {
        setRuntime(event.status);
        if (event.message) setError(event.message);
        return;
      }
      if (event.kind === "request") {
        if (
          event.method === "item/permissions/requestApproval" &&
          permissionDetails(event.params.permissions).length === 0
        ) {
          api.answer(event.id, { permissions: {}, scope: "turn" });
          return;
        }
        setApprovals((items) => [...items, event]);
        const threadId = String(event.params.threadId ?? "");
        const isVisible = document.hasFocus() && currentId.current === threadId;
        const approvalTitle = approvalNotificationTitles[event.method];
        if (
          approvalTitle &&
          storedBoolean("general-permission-notifications", true) &&
          !isVisible
        ) {
          const reason =
            typeof event.params.reason === "string"
              ? event.params.reason.trim() || "Approval required"
              : "Approval required";
          void api.showNotification({
            body: reason,
            id: `approval-${event.id}`,
            title: approvalTitle,
          });
        } else if (
          (event.method === "item/tool/requestUserInput" ||
            event.method === "item/tool/requestOptionPicker") &&
          storedBoolean("general-question-notifications", true) &&
          !isVisible
        ) {
          const questions = Array.isArray(event.params.questions)
            ? event.params.questions
            : [];
          const questionCount = questions.length;
          const thread = threadsRef.current.find(
            (item) => item.id === threadId,
          );
          void api.showNotification({
            body:
              questionCount === 1
                ? "Answer 1 question to proceed."
                : questionCount > 1
                  ? `Answer ${questionCount} questions to proceed.`
                  : "Answer a question to proceed.",
            id: `question-${event.id}`,
            title:
              threadNotificationTitle(thread) === "Turn complete"
                ? "Need your input"
                : threadNotificationTitle(thread),
          });
        }
        return;
      }
      const { method, params } = event;
      if (
        method === "account/updated" ||
        method === "account/login/completed"
      ) {
        void refreshAuth();
        return;
      }
      if (method === "thread/started") {
        const thread = params.thread as Thread;
        setThreads((items) => [
          thread,
          ...items.filter((item) => item.id !== thread.id),
        ]);
        return;
      }
      if (method === "thread/archived") {
        const threadId = String(params.threadId);
        setThreads((items) => items.filter((item) => item.id !== threadId));
        if (currentId.current === threadId) setCurrent(null);
        return;
      }
      if (method === "thread/name/updated") {
        const threadId = String(params.threadId);
        const name = typeof params.name === "string" ? params.name : null;
        setThreads((items) =>
          items.map((thread) =>
            thread.id === threadId ? { ...thread, name } : thread,
          ),
        );
        if (currentId.current === threadId) {
          setCurrent((thread) => (thread ? { ...thread, name } : thread));
        }
        return;
      }
      if (method === "thread/tokenUsage/updated") {
        const threadId = String(params.threadId ?? "");
        if (threadId) {
          setTokenUsageByThread((usage) => ({
            ...usage,
            [threadId]: params.tokenUsage as ThreadTokenUsage,
          }));
        }
        return;
      }
      if (method === "serverRequest/resolved") {
        const requestId = String(params.requestId ?? "");
        setApprovals((items) =>
          items.filter((approval) => String(approval.id) !== requestId),
        );
        void api.closeNotification(`approval-${requestId}`);
        void api.closeNotification(`question-${requestId}`);
        return;
      }
      const threadId = String(params.threadId ?? "");
      if (!threadId) return;
      if (method === "turn/completed") {
        const mode =
          localStorage.getItem("chatgpt.turn-notifications") ?? "unfocused";
        if (mode !== "off" && (mode === "always" || !document.hasFocus())) {
          const turn = params.turn as Turn;
          const thread = threadsRef.current.find(
            (item) => item.id === threadId,
          );
          void api.showNotification({
            body: lastAgentMessage(turn),
            id: `turn-${turn.id}`,
            title: threadNotificationTitle(thread),
          });
        }
      }
      if (currentId.current !== threadId) return;
      const turnId = String(
        params.turnId ?? (params.turn as Turn | undefined)?.id ?? "",
      );
      if (method === "turn/started") {
        const turn = params.turn as Turn;
        setActiveTurnId(turn.id);
        setCurrent((thread) => (thread ? replaceTurn(thread, turn) : thread));
      } else if (method === "turn/completed") {
        setActiveTurnId(null);
        setCurrent((thread) =>
          thread ? mergeCompletedTurn(thread, params.turn as Turn) : thread,
        );
        setTimeout(() => void refreshThread(threadId), 80);
      } else {
        setCurrent((thread) =>
          thread
            ? applyThreadItemStreamEvent(thread, method, params, turnId)
            : thread,
        );
      }
    },
    [refreshAuth, refreshThread],
  );

  useEffect(() => api.subscribe(receive), [api, receive]);

  const openThread = useCallback(
    async (thread: Thread) => {
      setError(null);
      setProject(thread.cwd);
      setSelectedProjectId(
        localProjects.find((item) =>
          projectContainsPath(item.rootPaths, thread.cwd),
        )?.id ?? null,
      );
      try {
        const result = await api.request<{ thread: Thread }>("thread/resume", {
          threadId: thread.id,
        });
        setCurrent(result.thread);
        setActiveTurnId(
          result.thread.turns.find((turn) => turn.status === "inProgress")
            ?.id ?? null,
        );
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    },
    [api, localProjects],
  );

  const runSubmission = useCallback(
    async (draft: PromptDraft) => {
      setActiveTurnId("starting");
      setError(null);
      try {
        let thread = current;
        if (!thread) {
          const params: Record<string, unknown> = {
            approvalPolicy: permissionMode === "full" ? "never" : "on-request",
            sandbox:
              permissionMode === "full"
                ? "danger-full-access"
                : permissionMode === "read"
                  ? "read-only"
                  : "workspace-write",
            serviceName: "chatgpt_desktop",
          };
          if (project) params.cwd = project;
          if (draft.model) params.model = draft.model;
          thread = (
            await api.request<{ thread: Thread }>("thread/start", params)
          ).thread;
          setCurrent(thread);
          setThreads((items) => [
            thread!,
            ...items.filter((item) => item.id !== thread!.id),
          ]);
        }
        const input: Array<Record<string, unknown>> = [];
        if (draft.text) input.push({ type: "text", text: draft.text });
        for (const attachment of draft.attachments ?? []) {
          input.push({
            path: attachment.path,
            type: attachment.kind === "audio" ? "localAudio" : "localImage",
          });
        }
        const params: Record<string, unknown> = {
          approvalPolicy: permissionMode === "full" ? "never" : "on-request",
          effort: draft.effort,
          input,
          sandboxPolicy:
            permissionMode === "full"
              ? { type: "dangerFullAccess" }
              : permissionMode === "read"
                ? { networkAccess: false, type: "readOnly" }
                : {
                    excludeSlashTmp: false,
                    excludeTmpdirEnvVar: false,
                    networkAccess: false,
                    type: "workspaceWrite",
                    writableRoots: project ? [project] : [],
                  },
          threadId: thread.id,
        };
        if (draft.model) params.model = draft.model;
        if (project) params.cwd = project;
        const result = await api.request<{ turn: Turn }>("turn/start", params);
        const userItem: ThreadItem = {
          content: [{ type: "text", text: draft.text }],
          id: `local-${result.turn.id}`,
          type: "userMessage",
        };
        const turn = {
          ...result.turn,
          items: result.turn.items.length ? result.turn.items : [userItem],
        };
        setCurrent((value) => (value ? replaceTurn(value, turn) : value));
        setActiveTurnId(result.turn.id);
      } catch (reason) {
        setActiveTurnId(null);
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    },
    [api, current, permissionMode, project],
  );

  const steerDraft = useCallback(
    async (draft: PromptDraft) => {
      if (!current || !activeTurnId || activeTurnId === "starting") return;
      const input: Array<Record<string, unknown>> = [];
      if (draft.text) input.push({ type: "text", text: draft.text });
      for (const attachment of draft.attachments ?? []) {
        input.push({
          path: attachment.path,
          type: attachment.kind === "audio" ? "localAudio" : "localImage",
        });
      }
      await api.request("turn/steer", {
        expectedTurnId: activeTurnId,
        input,
        threadId: current.id,
      });
    },
    [activeTurnId, api, current],
  );

  const submit = useCallback(
    (draft: PromptDraft, followUpBehavior?: "queue" | "steer") => {
      if (!activeTurnId) {
        void runSubmission(draft);
        return;
      }
      const behavior =
        followUpBehavior ??
        (localStorage.getItem("general-follow-up-behavior") === "Queue"
          ? "queue"
          : "steer");
      if (behavior === "queue") setQueue((items) => [...items, draft]);
      else void steerDraft(draft);
    },
    [activeTurnId, runSubmission, steerDraft],
  );

  useEffect(() => {
    if (!activeTurnId && current && queue.length) {
      const [next, ...rest] = queue;
      setQueue(rest);
      void runSubmission(next);
    }
  }, [activeTurnId, current, queue, runSubmission]);

  const value = useMemo<SessionValue>(
    () => ({
      activeTurnId,
      account,
      approvals,
      auth,
      archiveCurrent: async () => {
        if (!current) return;
        await api.request("thread/archive", { threadId: current.id });
        setCurrent(null);
      },
      chooseProject: async () => {
        const folder = await pickProjectFolder();
        if (folder) {
          setProject(folder);
          setSelectedProjectId(
            localProjects.find((item) => item.rootPaths.includes(folder))?.id ??
              null,
          );
        }
      },
      createProject,
      current,
      editQueuedPrompt: (index) => {
        const draft = queue[index] ?? null;
        setQueue((items) =>
          items.filter((_, itemIndex) => itemIndex !== index),
        );
        return draft;
      },
      dismissUserInput: (request) => {
        const threadId = String(request.params.threadId ?? "");
        const turnId = String(request.params.turnId ?? "");
        if (threadId && turnId) {
          void api.request("turn/interrupt", { threadId, turnId });
        }
        setApprovals((items) => items.filter((item) => item.id !== request.id));
        void api.closeNotification(`question-${request.id}`);
      },
      error,
      forkCurrent: async () => {
        if (!current) return null;
        const result = await api.request<{ thread: Thread }>("thread/fork", {
          threadId: current.id,
        });
        setCurrent(result.thread);
        setThreads((items) => [
          result.thread,
          ...items.filter((thread) => thread.id !== result.thread.id),
        ]);
        return result.thread;
      },
      interrupt: async () => {
        if (!current || !activeTurnId || activeTurnId === "starting") return;
        await api.request("turn/interrupt", {
          threadId: current.id,
          turnId: activeTurnId,
        });
      },
      logout: async () => {
        await api.request("account/logout", {});
        setAccount(null);
        setAuth("signedOut");
      },
      models,
      localProjects,
      openThread,
      permissionMode,
      pickProjectFolder,
      project,
      queue,
      removeProject,
      removeQueuedPrompt: (index) =>
        setQueue((items) =>
          items.filter((_, itemIndex) => itemIndex !== index),
        ),
      renameCurrent: async (name) => {
        if (!current) return;
        const trimmedName = name.trim();
        if (!trimmedName) return;
        await api.request("thread/name/set", {
          name: trimmedName,
          threadId: current.id,
        });
        setCurrent((thread) =>
          thread ? { ...thread, name: trimmedName } : thread,
        );
        setThreads((items) =>
          items.map((thread) =>
            thread.id === current.id
              ? { ...thread, name: trimmedName }
              : thread,
          ),
        );
      },
      resolveApproval: (approval, decision) => {
        api.answer(approval.id, { decision } as JsonValue);
        setApprovals((items) =>
          items.filter((item) => item.id !== approval.id),
        );
        void api.closeNotification(`approval-${approval.id}`);
      },
      resolvePermissionRequest: (request, scope) => {
        api.answer(
          request.id,
          (scope == null
            ? { permissions: {}, scope: "turn" }
            : {
                permissions: request.params.permissions ?? {},
                scope,
                strictAutoReview: false,
              }) as JsonValue,
        );
        setApprovals((items) => items.filter((item) => item.id !== request.id));
        void api.closeNotification(`approval-${request.id}`);
      },
      resolveOptionPicker: (request, response) => {
        api.answer(request.id, response as JsonValue);
        setApprovals((items) => items.filter((item) => item.id !== request.id));
        void api.closeNotification(`question-${request.id}`);
      },
      resolveMcpElicitation: (
        request,
        action,
        content,
        responseMeta = null,
      ) => {
        api.answer(request.id, {
          _meta: responseMeta,
          action,
          content: action === "accept" ? content : null,
        } as JsonValue);
        setApprovals((items) => items.filter((item) => item.id !== request.id));
      },
      resolveSetupContextPicker: (request, action, selectedSources) => {
        api.answer(request.id, {
          action,
          selectedSources: action === "continue" ? selectedSources : [],
          step: "context",
        } as JsonValue);
        setApprovals((items) => items.filter((item) => item.id !== request.id));
      },
      resolveUserInput: (request, answers) => {
        api.answer(request.id, {
          answers: Object.fromEntries(
            Object.entries(answers).map(([questionId, values]) => [
              questionId,
              { answers: values },
            ]),
          ),
        } as JsonValue);
        setApprovals((items) => items.filter((item) => item.id !== request.id));
        void api.closeNotification(`question-${request.id}`);
      },
      runtime,
      selectProject,
      selectedProjectId,
      setPermissionMode,
      signIn: async () => {
        setError(null);
        try {
          const result = await api.request<{
            authUrl?: string;
            type: string;
          }>("account/login/start", {
            appBrand: "chatgpt",
            codexStreamlinedLogin: true,
            type: "chatgpt",
            useHostedLoginSuccessPage: true,
          });
          if (result.authUrl) await api.openExternal(result.authUrl);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      },
      signInWithApiKey: async (apiKey) => {
        setError(null);
        try {
          await api.request("account/login/start", {
            apiKey,
            type: "apiKey",
          });
          await refreshAuth();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      },
      startNewTask: () => {
        setCurrent(null);
        setActiveTurnId(null);
        setError(null);
      },
      steerQueuedPrompt: async (index) => {
        const draft = queue[index];
        if (
          !draft ||
          !current ||
          !activeTurnId ||
          activeTurnId === "starting"
        ) {
          return;
        }
        setQueue((items) =>
          items.filter((_, itemIndex) => itemIndex !== index),
        );
        await steerDraft(draft);
      },
      submit,
      threads,
      tokenUsage: current ? (tokenUsageByThread[current.id] ?? null) : null,
      updateProject,
    }),
    [
      account,
      activeTurnId,
      api,
      approvals,
      auth,
      createProject,
      current,
      error,
      localProjects,
      models,
      openThread,
      permissionMode,
      pickProjectFolder,
      project,
      queue,
      removeProject,
      runtime,
      refreshAuth,
      selectProject,
      selectedProjectId,
      submit,
      steerDraft,
      threads,
      tokenUsageByThread,
      updateProject,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
