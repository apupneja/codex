import {
  Archive,
  Bot,
  Check,
  ChevronDown,
  Circle,
  CircleDashed,
  Clipboard,
  Clock3,
  Code2,
  ExternalLink,
  FileCode2,
  GitFork,
  Globe2,
  Laptop,
  LoaderCircle,
  MoreHorizontal,
  PanelRight,
  Search,
  Sparkles,
  TerminalSquare,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ThreadItem } from "../../shared/types";
import { MenuItem, MenuSurface, useDismissibleLayer } from "../design-system";
import type { CodexController, PlanStep } from "../state/useCodexController";
import { ConversationComposerDock } from "./ConversationComposerDock";
import { ConversationTurnStatus } from "./ConversationTurnStatus";
import { ThreadChanges } from "./ThreadChanges";
import { UserMessage } from "./UserMessage";

type ConversationViewProps = {
  changesOpen: boolean;
  controller: CodexController;
  onOpenChange(path: string): void;
  onOpenFile(path: string): void;
  onOpenTerminal(): void;
  onShowChanges(): void;
  onToggleWorkspace(): void;
};

function localPathFromHref(href: string, cwd: string | null): string | null {
  if (/^[A-Za-z]:[\\/]/.test(href)) {
    return decodeURIComponent(href.split(/[?#]/, 1)[0] ?? href);
  }
  try {
    const url = new URL(href);
    if (url.protocol !== "file:") return null;
    const path = decodeURIComponent(url.pathname);
    return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
  } catch {
    if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
      return null;
    }
    const path = decodeURIComponent(href.split(/[?#]/, 1)[0] ?? "");
    return path && cwd ? path : null;
  }
}

function localPathFromCode(value: string, cwd: string | null): string | null {
  const reference = value.trim();
  if (!reference || /\s/.test(reference)) return null;
  const path = reference
    .replace(/#L\d+(?:C\d+)?$/i, "")
    .replace(/:\d+(?::\d+)?$/, "");
  const absolute = /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(path);
  if (!path || (!absolute && /^[a-z][a-z0-9+.-]*:/i.test(path))) return null;
  const fileName = path.split(/[/\\]/).pop() ?? "";
  const looksLikeFile =
    /^[^/\\]+\.[a-z0-9][a-z0-9._-]*$/i.test(fileName) ||
    /^(?:build|dockerfile|justfile|license|makefile|readme|workspace)$/i.test(
      fileName,
    );
  if (!looksLikeFile) return null;
  return absolute || cwd ? path : null;
}

function reasoningText(
  item: Extract<ThreadItem, { type: "reasoning" }>,
): string {
  const seen = new Set<string>();
  return [...item.summary, ...item.content]
    .flatMap((entry) => entry.split(/\n{2,}/))
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const normalized = entry.replace(/\s+/g, " ");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n\n");
}

export function ToolItem({
  cwd,
  item,
  onOpenChange,
  onOpenFile,
}: {
  cwd: string | null;
  item: ThreadItem;
  onOpenChange(path: string): void;
  onOpenFile(path: string): void;
}) {
  const [expanded, setExpanded] = useState(item.type === "reasoning");
  if (item.type === "reasoning") {
    const text = reasoningText(item);
    return (
      <div className="activity-item reasoning-item">
        <button
          aria-expanded={expanded}
          className="activity-summary"
          onClick={() => setExpanded((value) => !value)}
        >
          <span>Thought briefly</span>
          <ChevronDown className={expanded ? "expanded" : ""} size={13} />
        </button>
        {expanded ? (
          <div className="activity-detail reasoning-detail">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => {
                  const localPath = href ? localPathFromHref(href, cwd) : null;
                  return (
                    <a
                      href={href}
                      onClick={(event) => {
                        event.preventDefault();
                        if (localPath) {
                          onOpenFile(localPath);
                        } else if (href && !href.startsWith("#")) {
                          void window.codexDesktop
                            .openExternal(href)
                            .catch(() => undefined);
                        }
                      }}
                    >
                      {localPath ? (
                        <FileCode2 size={11} />
                      ) : (
                        <ExternalLink size={11} />
                      )}
                      {children}
                    </a>
                  );
                },
                code: ({ children, className }) => {
                  const value = String(children).replace(/\n$/, "");
                  const localPath = className
                    ? null
                    : localPathFromCode(value, cwd);
                  return localPath ? (
                    <button
                      className="reasoning-file-link"
                      onClick={() => onOpenFile(localPath)}
                      title={`Open ${localPath}`}
                      type="button"
                    >
                      <FileCode2 size={11} />
                      <code>{children}</code>
                    </button>
                  ) : (
                    <code className={className}>{children}</code>
                  );
                },
              }}
              remarkPlugins={[remarkGfm]}
            >
              {text}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>
    );
  }
  if (item.type === "commandExecution") {
    const running = item.status === "inProgress";
    const aggregate = /^(Explored|Edited|Ran)\b/.test(item.command);
    const aggregateParts = aggregate
      ? /^(.*?)(?: \+(\d+) [−-](\d+))?$/.exec(item.command)
      : null;
    return (
      <div className="activity-item command-item">
        <button
          aria-expanded={expanded}
          className={`activity-summary ${aggregate ? "aggregate-summary" : ""}`}
          onClick={() => setExpanded((value) => !value)}
        >
          {aggregate ? (
            <>
              <span>{aggregateParts?.[1] ?? item.command}</span>
              {aggregateParts?.[2] ? (
                <b className="addition">+{aggregateParts[2]}</b>
              ) : null}
              {aggregateParts?.[3] ? (
                <b className="deletion">-{aggregateParts[3]}</b>
              ) : null}
            </>
          ) : (
            <>
              {running ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <TerminalSquare size={14} />
              )}
              <span>
                {running
                  ? "Running"
                  : item.exitCode === 0
                    ? "Ran"
                    : "Command failed"}
              </span>
              <code>{item.command}</code>
            </>
          )}
          <ChevronDown className={expanded ? "expanded" : ""} size={13} />
        </button>
        {expanded ? (
          <div
            className={`activity-detail terminal-output ${aggregate ? "aggregate-detail" : ""}`}
          >
            <div className="terminal-output-header">
              <span>{item.cwd}</span>
              {item.durationMs ? (
                <span>{Math.round(item.durationMs)}ms</span>
              ) : null}
            </div>
            <pre>{item.aggregatedOutput || "No output"}</pre>
          </div>
        ) : null}
      </div>
    );
  }
  if (item.type === "fileChange") {
    const additions = item.changes.reduce(
      (count, change) =>
        count +
        change.diff
          .split("\n")
          .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
          .length,
      0,
    );
    const deletions = item.changes.reduce(
      (count, change) =>
        count +
        change.diff
          .split("\n")
          .filter((line) => line.startsWith("-") && !line.startsWith("---"))
          .length,
      0,
    );
    return (
      <div className="activity-item file-change-activity">
        <button
          aria-expanded={expanded}
          className="activity-summary file-change-summary"
          onClick={() => setExpanded((value) => !value)}
        >
          <span>
            Edited {item.changes.length}{" "}
            {item.changes.length === 1 ? "file" : "files"}
          </span>
          <b className="addition">+{additions}</b>
          <b className="deletion">-{deletions}</b>
          <ChevronDown className={expanded ? "expanded" : ""} size={13} />
        </button>
        {expanded ? (
          <div className="file-change-inline-files">
            {item.changes.map((change) => (
              <button
                className="changed-file-row"
                key={change.path}
                onClick={() => onOpenChange(change.path)}
              >
                <FileCode2 size={14} />
                <span>{change.path}</span>
                <small>{change.kind.type ?? "modified"}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  if (item.type === "mcpToolCall") {
    return (
      <div className="activity-item">
        <button
          className="activity-summary"
          onClick={() => setExpanded((value) => !value)}
        >
          <Wrench size={14} />
          <span>{item.status === "inProgress" ? "Calling" : "Called"}</span>
          <code>
            {item.server} · {item.tool}
          </code>
          <ChevronDown className={expanded ? "expanded" : ""} size={13} />
        </button>
        {expanded ? (
          <pre className="activity-detail">
            {JSON.stringify(
              {
                arguments: item.arguments,
                ...(item.result ? { result: item.result } : {}),
                ...(item.error ? { error: item.error.message } : {}),
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </div>
    );
  }
  if (item.type === "dynamicToolCall") {
    return (
      <div className="activity-item">
        <button
          className="activity-summary"
          onClick={() => setExpanded((value) => !value)}
        >
          <Wrench size={14} />
          <span>{item.status === "inProgress" ? "Calling" : "Called"}</span>
          <code>
            {item.namespace ? `${item.namespace} · ` : ""}
            {item.tool}
          </code>
          <ChevronDown className={expanded ? "expanded" : ""} size={13} />
        </button>
        {expanded ? (
          <pre className="activity-detail">
            {JSON.stringify(
              {
                arguments: item.arguments,
                content: item.contentItems,
                success: item.success,
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </div>
    );
  }
  if (item.type === "collabAgentToolCall") {
    return (
      <div className="activity-item">
        <div className="activity-summary">
          <Users size={14} />
          <span>
            {item.status === "inProgress" ? "Coordinating" : "Coordinated"}
          </span>
          <code>{item.tool}</code>
        </div>
      </div>
    );
  }
  if (item.type === "webSearch") {
    return (
      <div className="activity-item">
        <div className="activity-summary">
          <Globe2 size={14} />
          <span>Browsed the web</span>
          <code>{item.query}</code>
        </div>
      </div>
    );
  }
  if (item.type === "imageView") {
    return (
      <button
        className="activity-summary inline-activity"
        onClick={() => onOpenFile(item.path)}
      >
        <Search size={14} /> Viewed <code>{item.path}</code>
      </button>
    );
  }
  if (item.type === "subAgentActivity") {
    return (
      <div className="activity-item">
        <div className="activity-summary">
          <Bot size={14} />
          <span>{item.kind}</span>
          <code>{item.agentPath}</code>
        </div>
      </div>
    );
  }
  if (item.type === "hookPrompt") {
    return (
      <div className="activity-item">
        <button
          className="activity-summary"
          onClick={() => setExpanded((value) => !value)}
        >
          <Sparkles size={14} /> <span>Hook guidance</span>
          <ChevronDown className={expanded ? "expanded" : ""} size={13} />
        </button>
        {expanded ? (
          <pre className="activity-detail">
            {item.fragments.map((fragment) => fragment.text).join("\n\n")}
          </pre>
        ) : null}
      </div>
    );
  }
  if (item.type === "sleep") {
    return (
      <div className="activity-item">
        <div className="activity-summary">
          <Clock3 size={14} />{" "}
          <span>Waited {Math.round(item.durationMs / 1_000)}s</span>
        </div>
      </div>
    );
  }
  if (item.type === "imageGeneration") {
    return (
      <div className="file-change-card generated-image-card">
        <div className="file-change-heading">
          <span>
            <Sparkles size={15} /> Generated image
          </span>
          <span>{item.status}</span>
        </div>
        {item.revisedPrompt ? <p>{item.revisedPrompt}</p> : null}
        {item.result.startsWith("data:image/") ? (
          <img
            alt={item.revisedPrompt ?? "Generated image"}
            src={item.result}
          />
        ) : null}
        {item.savedPath ? (
          <button
            className="changed-file-row"
            onClick={() => onOpenFile(item.savedPath!)}
          >
            <FileCode2 size={14} /> <span>{item.savedPath}</span>
          </button>
        ) : null}
      </div>
    );
  }
  if (item.type === "enteredReviewMode" || item.type === "exitedReviewMode") {
    return (
      <div className="activity-item">
        <div className="activity-summary">
          <Code2 size={14} />
          <span>
            {item.type === "enteredReviewMode"
              ? "Started review"
              : "Completed review"}
          </span>
          <code>{item.review}</code>
        </div>
      </div>
    );
  }
  if (item.type === "contextCompaction") {
    return (
      <div className="activity-item">
        <div className="activity-summary">
          <Sparkles size={14} /> <span>Compacted conversation context</span>
        </div>
      </div>
    );
  }
  const unknown = item as unknown as { type?: string };
  return (
    <div className="activity-item">
      <div className="activity-summary">
        <Wrench size={14} /> <span>{unknown.type ?? "Activity"}</span>
      </div>
    </div>
  );
}

function Plan({ steps }: { steps: PlanStep[] }) {
  if (!steps.length) return null;
  return (
    <section className="plan-card" aria-label="Task plan">
      <div className="plan-title">
        <CircleDashed size={15} /> Plan
      </div>
      {steps.map((step) => (
        <div className={`plan-step plan-${step.status}`} key={step.step}>
          {step.status === "completed" ? (
            <Check size={13} />
          ) : step.status === "inProgress" ? (
            <LoaderCircle className="spin" size={13} />
          ) : (
            <Circle size={11} />
          )}
          <span>{step.step}</span>
        </div>
      ))}
    </section>
  );
}

function MessageActions({
  controller,
  text,
}: {
  controller: CodexController;
  text: string;
}) {
  return (
    <div className="message-actions">
      <button
        aria-label="Helpful response"
        onClick={() => controller.addToast("Feedback recorded", "success")}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        aria-label="Unhelpful response"
        onClick={() => controller.addToast("Feedback recorded")}
      >
        <ThumbsDown size={13} />
      </button>
      <button
        aria-label="Branch from response"
        onClick={() =>
          controller.addToast("Start a new chat to branch from this response")
        }
      >
        <GitFork size={13} />
      </button>
      <button
        aria-label="Copy response"
        onClick={() =>
          void navigator.clipboard
            .writeText(text)
            .then(() => controller.addToast("Response copied", "success"))
            .catch((error: unknown) =>
              controller.addToast(
                error instanceof Error ? error.message : String(error),
                "danger",
              ),
            )
        }
      >
        <Clipboard size={13} />
      </button>
    </div>
  );
}

export function ConversationView({
  changesOpen,
  controller,
  onOpenChange,
  onOpenFile,
  onOpenTerminal,
  onShowChanges,
  onToggleWorkspace,
}: ConversationViewProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const menuLayer = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
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
    <main className="conversation-view">
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
          {controller.activeThread?.turns.map((turn) => {
            const streamingMessageId =
              turn.status === "inProgress"
                ? [...turn.items]
                    .reverse()
                    .find((item) => item.type === "agentMessage")?.id
                : null;
            return (
              <section
                aria-busy={turn.status === "inProgress"}
                className={`turn ${turn.status === "inProgress" ? "is-streaming" : ""}`}
                key={turn.id}
              >
                {turn.items.map((item) => {
                  if (item.type === "userMessage") {
                    return (
                      <UserMessage
                        item={item}
                        key={item.id}
                        onOpenFile={onOpenFile}
                      />
                    );
                  }
                  if (item.type === "agentMessage") {
                    const commentary = item.phase === "commentary";
                    return (
                      <article
                        className={`agent-message markdown ${commentary ? "turn-trace agent-commentary" : "turn-answer"} ${item.id === streamingMessageId ? "is-streaming" : ""}`}
                        key={item.id}
                      >
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (href) {
                                    const localPath = localPathFromHref(
                                      href,
                                      controller.activeThread?.cwd ?? null,
                                    );
                                    if (localPath) {
                                      onOpenFile(localPath);
                                    } else if (!href.startsWith("#")) {
                                      void window.codexDesktop
                                        .openExternal(href)
                                        .catch((error: unknown) =>
                                          controller.addToast(
                                            error instanceof Error
                                              ? error.message
                                              : String(error),
                                            "danger",
                                          ),
                                        );
                                    }
                                  }
                                }}
                              >
                                {children}
                                <ExternalLink size={11} />
                              </a>
                            ),
                            code: ({ children, className }) => (
                              <code className={className}>{children}</code>
                            ),
                          }}
                          remarkPlugins={[remarkGfm]}
                        >
                          {item.text}
                        </ReactMarkdown>
                      </article>
                    );
                  }
                  if (item.type === "plan") {
                    return (
                      <div
                        className="agent-message markdown turn-trace"
                        key={item.id}
                      >
                        <ReactMarkdown>{item.text}</ReactMarkdown>
                      </div>
                    );
                  }
                  return (
                    <div className="turn-trace turn-trace-item" key={item.id}>
                      <ToolItem
                        cwd={controller.activeThread?.cwd ?? null}
                        item={item}
                        onOpenChange={onOpenChange}
                        onOpenFile={onOpenFile}
                      />
                    </div>
                  );
                })}
                {(() => {
                  const response = [...turn.items]
                    .reverse()
                    .find(
                      (item) =>
                        item.type === "agentMessage" &&
                        item.phase !== "commentary",
                    );
                  return response?.type === "agentMessage" ? (
                    <MessageActions
                      controller={controller}
                      key={`${turn.id}-actions`}
                      text={response.text}
                    />
                  ) : null;
                })()}
                <ConversationTurnStatus turn={turn} />
              </section>
            );
          })}
          <Plan steps={controller.plan} />
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
        onOpenTerminal={onOpenTerminal}
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
    </main>
  );
}
