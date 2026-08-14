import {
  Bot,
  ChevronDown,
  Code2,
  Clock3,
  ExternalLink,
  FileCode2,
  Globe2,
  Search,
  Sparkles,
  TerminalSquare,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ThreadItem } from "../../shared/types";
import { localPathFromCode, localPathFromHref } from "../lib/conversationLinks";
import { reasoningText } from "../lib/threadItemVisibility";
import { McpToolCallItem } from "./McpToolCallItem";

type ToolItemProps = {
  cwd: string | null;
  item: ThreadItem;
  onOpenChange(path: string): void;
  onOpenFile(path: string): void;
  progressMessages?: string[];
};

export function ToolItem({
  cwd,
  item,
  onOpenChange,
  onOpenFile,
  progressMessages = [],
}: ToolItemProps) {
  const [expanded, setExpanded] = useState(item.type === "reasoning");
  if (item.type === "reasoning") {
    const text = reasoningText(item);
    if (!text) return null;
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
              <TerminalSquare size={14} />
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
              ) : running ? (
                <span>Processing</span>
              ) : null}
            </div>
            <pre>
              {item.aggregatedOutput ||
                (running ? "Waiting for command output…" : "No output")}
            </pre>
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
    return <McpToolCallItem item={item} progressMessages={progressMessages} />;
  }
  if (item.type === "dynamicToolCall") {
    return (
      <div className="activity-item">
        <button
          aria-expanded={expanded}
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
          aria-expanded={expanded}
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
