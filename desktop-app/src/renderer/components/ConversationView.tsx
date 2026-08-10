import {
  Archive,
  ArrowDown,
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
  FolderOpen,
  GitBranch,
  GitFork,
  Globe2,
  Laptop,
  Link,
  LoaderCircle,
  MoreHorizontal,
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
import type { CodexController, PlanStep } from "../state/useCodexController";
import { Composer } from "./Composer";

type ConversationViewProps = {
  controller: CodexController;
  onOpenFile(path: string): void;
  onOpenTerminal(): void;
  onShowChanges(): void;
  onToggleWorkspace(): void;
};

function localPathFromHref(href: string, cwd: string | null): string | null {
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

function UserMessage({
  item,
  onOpenFile,
}: {
  item: Extract<ThreadItem, { type: "userMessage" }>;
  onOpenFile(path: string): void;
}) {
  const text = item.content
    .filter((entry) => entry.type === "text")
    .map((entry) => (entry.type === "text" ? entry.text : ""))
    .join("\n");
  const attachments = item.content.filter((entry) => entry.type !== "text");
  return (
    <div className="user-message">
      {text ? <div>{text}</div> : null}
      {attachments.length ? (
        <div className="message-attachments">
          {attachments.map((entry, index) => {
            const path =
              entry.type === "localImage" ||
              entry.type === "localAudio" ||
              entry.type === "skill" ||
              entry.type === "mention"
                ? entry.path
                : null;
            const label =
              entry.type === "skill" || entry.type === "mention"
                ? entry.name
                : (path?.split(/[\\/]/).pop() ?? entry.type);
            return path ? (
              <button
                key={`${entry.type}-${path}-${index}`}
                onClick={() => onOpenFile(path)}
              >
                <FileCode2 size={12} /> {label}
              </button>
            ) : (
              <span key={`${entry.type}-${index}`}>
                <Link size={12} /> {label}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function durationLabel(durationMs: number | null): string {
  if (!durationMs) return "Worked";
  if (durationMs < 1_000) return `Worked for ${durationMs}ms`;
  if (durationMs < 60_000)
    return `Worked for ${Math.round(durationMs / 1_000)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `Worked for ${minutes}m ${seconds}s`;
}

function ToolItem({
  item,
  onOpenFile,
}: {
  item: ThreadItem;
  onOpenFile(path: string): void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (item.type === "reasoning") {
    const text = [...item.summary, ...item.content]
      .filter(Boolean)
      .join("\n\n");
    return (
      <div className="activity-item reasoning-item">
        <button
          className="activity-summary"
          onClick={() => setExpanded((value) => !value)}
        >
          <span>Thought briefly</span>
        </button>
        {expanded ? (
          <pre className="activity-detail reasoning-detail">{text}</pre>
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
        </button>
        {expanded ? (
          <div className="activity-detail terminal-output">
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
                onClick={() => onOpenFile(change.path)}
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
  controller,
  onOpenFile,
  onOpenTerminal,
  onShowChanges,
  onToggleWorkspace,
}: ConversationViewProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [collapsedTurns, setCollapsedTurns] = useState<Set<string>>(
    () => new Set(),
  );
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (pinned.current) {
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: "smooth",
      });
    }
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
        <div className="header-actions">
          <button className="header-button" onClick={onToggleWorkspace}>
            IDE <ExternalLink size={12} />
          </button>
          <button
            aria-expanded={menuOpen}
            aria-label="Task actions"
            className="icon-button subtle"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && controller.activeThread ? (
            <div className="task-actions-menu">
              <button
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
                <Link size={13} /> Copy task link
              </button>
              <button
                onClick={() => {
                  const cwd = controller.activeThread?.cwd;
                  if (cwd) {
                    void window.codexDesktop
                      .revealPath(cwd)
                      .catch((error: unknown) =>
                        controller.addToast(
                          error instanceof Error
                            ? error.message
                            : String(error),
                          "danger",
                        ),
                      );
                  }
                  setMenuOpen(false);
                }}
              >
                <FolderOpen size={13} /> Reveal repository
              </button>
              <button
                className="danger"
                onClick={() => {
                  const thread = controller.activeThread;
                  if (thread) void controller.archiveThread(thread);
                  setMenuOpen(false);
                }}
              >
                <Archive size={13} /> Archive task
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div
        className="conversation-scroll"
        onScroll={(event) => {
          const node = event.currentTarget;
          pinned.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 100;
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
            <section
              className={`turn ${collapsedTurns.has(turn.id) ? "collapsed" : ""}`}
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
                  return (
                    <article className="agent-message markdown" key={item.id}>
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
                    <div className="agent-message markdown" key={item.id}>
                      <ReactMarkdown>{item.text}</ReactMarkdown>
                    </div>
                  );
                }
                return (
                  <ToolItem item={item} key={item.id} onOpenFile={onOpenFile} />
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
              <div className="turn-meta">
                {turn.status === "inProgress" ? (
                  <span>
                    <LoaderCircle className="spin" size={13} /> Working
                  </span>
                ) : turn.items.some((item) => item.type === "reasoning") ? (
                  <button
                    aria-label={`${collapsedTurns.has(turn.id) ? "Expand" : "Collapse"} turn`}
                    onClick={() =>
                      setCollapsedTurns((current) => {
                        const next = new Set(current);
                        if (next.has(turn.id)) next.delete(turn.id);
                        else next.add(turn.id);
                        return next;
                      })
                    }
                  >
                    {durationLabel(turn.durationMs)}
                    <ChevronDown
                      className={collapsedTurns.has(turn.id) ? "collapsed" : ""}
                      size={13}
                    />
                  </button>
                ) : (
                  <span>{durationLabel(turn.durationMs)}</span>
                )}
              </div>
            </section>
          ))}
          <Plan steps={controller.plan} />
          {controller.loadingThread ? (
            <div className="conversation-loading">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      </div>
      <div className="conversation-composer-wrap">
        <div className="change-actions">
          <button onClick={onShowChanges}>Changes</button>
          <button onClick={onOpenTerminal}>
            Commit &amp; Push <ChevronDown size={12} />
          </button>
          <button onClick={onToggleWorkspace}>Design Mode</button>
          <button
            aria-label="Scroll to latest message"
            className="scroll-to-latest"
            onClick={() => {
              pinned.current = true;
              scroll.current?.scrollTo({
                behavior: "smooth",
                top: scroll.current.scrollHeight,
              });
            }}
          >
            <ArrowDown size={14} />
          </button>
        </div>
        <Composer
          active={Boolean(controller.activeTurn)}
          compact
          disabled={controller.runtime.phase !== "ready"}
          models={controller.models}
          onInterrupt={controller.interrupt}
          onSubmit={controller.submitPrompt}
          onToast={(message) => controller.addToast(message)}
          preferences={controller.preferences}
          updatePreferences={controller.updatePreferences}
        />
        <div className="conversation-statusbar">
          <button>
            <GitBranch size={12} />
            {controller.activeThread?.gitInfo?.branch ?? "Current branch"}
            <ChevronDown size={11} />
          </button>
          <button>
            <Laptop size={12} /> {deviceLabel} <ChevronDown size={11} />
          </button>
          <span
            aria-label={`Context ${controller.tokenPercent}%`}
            className="context-ring"
            style={{
              background: `conic-gradient(var(--addition) ${controller.tokenPercent}%, var(--border-strong) 0)`,
            }}
            title={`Context ${controller.tokenPercent}%`}
          >
            <i />
          </span>
        </div>
      </div>
    </main>
  );
}
