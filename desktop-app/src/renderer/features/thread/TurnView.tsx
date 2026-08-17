import {
  Check,
  ChevronDown,
  Clock3,
  Code2,
  ImageIcon,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ThreadItem, Turn } from "../../../shared/protocol";
import { UserMessage } from "../../components/UserMessage";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { WorkStatusDivider } from "./WorkStatusDivider";
import {
  CompactionIcon,
  ContinueIcon,
  CopyIcon,
  DiffSummaryIcon,
  DownloadIcon,
  EditActivityIcon,
  ExpandPlanIcon,
  FeedbackDownIcon,
  FeedbackUpIcon,
  GitHubIcon,
  PlanBulbIcon,
  TerminalIcon,
  UndoIcon,
} from "../../ui/AppIcons";

type ItemRecord = Record<string, unknown>;

function asRecord(value: unknown): ItemRecord {
  return typeof value === "object" && value !== null
    ? (value as ItemRecord)
    : {};
}

function itemText(item: ThreadItem): string {
  return (
    item.text ??
    item.content
      ?.map((part) => (typeof part === "string" ? part : (part.text ?? "")))
      .filter(Boolean)
      .join("\n") ??
    ""
  );
}

function titleCase(value: string): string {
  return value
    .replaceAll(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(value: unknown): string | null {
  if (typeof value !== "number" || value < 1000) return null;
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function activityLabel(item: ThreadItem, leading = true): string | null {
  const value = item as ItemRecord;
  if (item.type === "commandExecution") {
    const duration = formatDuration(value.durationMs);
    const verb = item.status === "inProgress" ? "Running" : "Ran";
    return `${verb} ${item.command || "command"}${duration ? ` in ${duration}` : ""}`;
  }
  if (item.type === "fileChange") return "Edited files";
  if (item.type === "mcpToolCall") {
    const context = asRecord(value.appContext);
    const server = String(context.appName ?? value.server ?? "integration");
    return `${leading ? "Used" : "used"} ${server}${
      /integration$/i.test(server) ? "" : " integration"
    }`;
  }
  if (item.type === "dynamicToolCall") {
    return String(value.tool ?? "tool").replaceAll(/[_-]+/g, " ");
  }
  if (item.type === "webSearch") {
    return leading ? "Searched the web" : "searched the web";
  }
  if (item.type === "contextCompaction") {
    return "Context automatically compacted";
  }
  if (item.type === "imageView") return "Viewed an image";
  if (item.type === "collabAgentToolCall") {
    const receivers = Array.isArray(value.receiverThreadIds)
      ? value.receiverThreadIds.length
      : 0;
    switch (value.tool) {
      case "spawnAgent":
        return receivers === 1
          ? "Started a subagent"
          : `Started ${receivers} subagents`;
      case "sendInput":
        return "Sent input to a subagent";
      case "resumeAgent":
        return "Resumed a subagent";
      case "wait":
        return "Waited for subagents";
      case "closeAgent":
        return "Closed a subagent";
      default:
        return "Used a subagent";
    }
  }
  if (item.type === "subAgentActivity") {
    const path =
      typeof value.agentPath === "string" ? value.agentPath : "subagent";
    return `${titleCase(String(value.kind ?? "updated"))} ${path}`;
  }
  if (item.type === "hookPrompt") return "Ran a hook";
  return null;
}

function isIntegrationActivity(item: ThreadItem): boolean {
  return ["mcpToolCall", "dynamicToolCall", "webSearch"].includes(item.type);
}

function ActivityIcon({ item }: { item: ThreadItem }) {
  const value = item as ItemRecord;
  if (item.type === "mcpToolCall") {
    const context = asRecord(value.appContext);
    const name = String(context.appName ?? value.server ?? "").toLowerCase();
    return name === "github" ? (
      <GitHubIcon aria-hidden="true" />
    ) : (
      <Wrench aria-hidden="true" />
    );
  }
  if (item.type === "webSearch") return <Search aria-hidden="true" />;
  if (item.type === "fileChange")
    return <EditActivityIcon aria-hidden="true" />;
  if (item.type === "contextCompaction")
    return <CompactionIcon aria-hidden="true" />;
  if (item.type === "imageView") return <ImageIcon aria-hidden="true" />;
  if (item.type === "dynamicToolCall") return <Sparkles aria-hidden="true" />;
  if (item.type === "collabAgentToolCall" || item.type === "subAgentActivity") {
    return <Code2 aria-hidden="true" />;
  }
  if (item.type === "hookPrompt") return <Wrench aria-hidden="true" />;
  return <TerminalIcon aria-hidden="true" />;
}

function readableJson(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function activityDetail(item: ThreadItem): ReactNode {
  const value = item as ItemRecord;
  if (item.type === "commandExecution") {
    return item.aggregatedOutput ? <pre>{item.aggregatedOutput}</pre> : null;
  }
  if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
    const argumentsText = readableJson(value.arguments);
    const result =
      item.type === "mcpToolCall"
        ? readableJson(value.result ?? value.error)
        : readableJson(value.contentItems);
    return (
      <div className="activity-detail__stack">
        {argumentsText && (
          <div>
            <strong>Input</strong>
            <pre>{argumentsText}</pre>
          </div>
        )}
        {result && (
          <div>
            <strong>Output</strong>
            <pre>{result}</pre>
          </div>
        )}
      </div>
    );
  }
  if (item.type === "webSearch") {
    return <div>{String(value.query ?? "")}</div>;
  }
  if (item.type === "imageView") return <div>{String(value.path ?? "")}</div>;
  if (item.type === "hookPrompt") {
    const fragments = Array.isArray(value.fragments) ? value.fragments : [];
    return fragments.map((fragment, index) => (
      <div key={index}>{String(asRecord(fragment).text ?? "")}</div>
    ));
  }
  return null;
}

function ActivityGroup({ items }: { items: ThreadItem[] }) {
  const [open, setOpen] = useState(false);
  const labelItems = items.filter((item, index) => {
    const label = activityLabel(item);
    if (!label) return false;
    return (
      items.findIndex(
        (candidate) =>
          activityLabel(candidate)?.toLowerCase() === label.toLowerCase(),
      ) === index
    );
  });
  const labels = labelItems.flatMap((item, index) => {
    const label = activityLabel(item, index === 0);
    return label ? [label] : [];
  });
  if (!labels.length) return null;
  const hasDetails = items.some((item) => activityDetail(item) != null);
  return (
    <div className={`activity-group${open ? " is-open" : ""}`}>
      <button
        aria-expanded={hasDetails ? open : undefined}
        className="activity-group__trigger"
        onClick={() => {
          if (hasDetails) setOpen((value) => !value);
        }}
        type="button"
      >
        <ActivityIcon item={items[0]} />
        <span>
          {new Intl.ListFormat("en", {
            style: "long",
            type: "conjunction",
          }).format(labels)}
        </span>
        {hasDetails && (
          <ChevronDown aria-hidden="true" className="activity-group__chevron" />
        )}
      </button>
      {open && hasDetails && (
        <div className="activity-group__details">
          {items.map((item, index) => {
            const detail = activityDetail(item);
            if (detail == null) return null;
            return (
              <div className="activity-detail" key={item.id ?? index}>
                {items.length > 1 && <strong>{activityLabel(item)}</strong>}
                {detail}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type DiffCounts = { additions: number; deletions: number };

function diffCounts(diff: unknown): DiffCounts {
  if (typeof diff !== "string") return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

function FileChangeCard({ items }: { items: ThreadItem[] }) {
  const [reviewing, setReviewing] = useState(false);
  const changes = items.flatMap((item) =>
    Array.isArray(item.changes) ? item.changes : [],
  );
  const rows = changes.map((change) => {
    const value = asRecord(change);
    return {
      counts: diffCounts(value.diff),
      diff: typeof value.diff === "string" ? value.diff : "",
      path: String(value.path ?? "Changed file"),
    };
  });
  const totals = rows.reduce(
    (total, row) => ({
      additions: total.additions + row.counts.additions,
      deletions: total.deletions + row.counts.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
  const splitPath = (path: string) => {
    const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return {
      directory: separator < 0 ? "" : path.slice(0, separator + 1),
      filename: path.slice(separator + 1),
    };
  };
  return (
    <section className="diff-summary-card">
      <header>
        <span className="diff-summary-card__mark">
          <DiffSummaryIcon aria-hidden="true" />
        </span>
        <span className="diff-summary-card__heading">
          <strong>
            Edited {rows.length} {rows.length === 1 ? "file" : "files"}
          </strong>
          <span>
            <b>+{totals.additions}</b> <i>-{totals.deletions}</i>
          </span>
        </span>
        <span className="diff-summary-card__actions">
          <button type="button">
            Undo <UndoIcon aria-hidden="true" />
          </button>
          <button onClick={() => setReviewing((value) => !value)} type="button">
            Review
          </button>
        </span>
      </header>
      <div className="diff-summary-card__files">
        {rows.map((row, index) => {
          const { directory, filename } = splitPath(row.path);
          return (
            <div
              className="diff-summary-card__file"
              key={`${row.path}-${index}`}
            >
              <button
                aria-label={row.path}
                onClick={() => setReviewing((value) => !value)}
                type="button"
              >
                <span className="diff-summary-card__path" aria-hidden="true">
                  <span>{directory}</span>
                  <span>{filename}</span>
                </span>
                <span className="diff-summary-card__counts">
                  <b>+{row.counts.additions}</b>
                  <i>-{row.counts.deletions}</i>
                </span>
              </button>
              {reviewing && row.diff && <pre>{row.diff}</pre>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlanCard({ item }: { item: ThreadItem }) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const text = itemText(item);
  const copy = () => void navigator.clipboard?.writeText(text);
  const download = () => {
    const link = document.createElement("a");
    link.download = "plan.md";
    link.href = URL.createObjectURL(
      new Blob([text], { type: "text/markdown" }),
    );
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <section className={`plan-card${expanded ? " is-expanded" : ""}`}>
      <header>
        <span>
          <PlanBulbIcon aria-hidden="true" />
          Plan
        </span>
        <span className="plan-card__actions">
          <button aria-label="Download plan" onClick={download} type="button">
            <DownloadIcon aria-hidden="true" />
          </button>
          <button aria-label="Copy plan" onClick={copy} type="button">
            <CopyIcon aria-hidden="true" />
          </button>
          <button
            aria-label="Good response"
            className={feedback === "up" ? "is-active" : ""}
            onClick={() => setFeedback(feedback === "up" ? null : "up")}
            type="button"
          >
            <FeedbackUpIcon aria-hidden="true" />
          </button>
          <button
            aria-label="Bad response"
            className={feedback === "down" ? "is-active" : ""}
            onClick={() => setFeedback(feedback === "down" ? null : "down")}
            type="button"
          >
            <FeedbackDownIcon aria-hidden="true" />
          </button>
          <button
            aria-label={expanded ? "Collapse plan" : "Expand plan"}
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <ExpandPlanIcon aria-hidden="true" />
          </button>
        </span>
      </header>
      <div className="plan-card__content">
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      </div>
    </section>
  );
}

function GeneratedImageCard({ item }: { item: ThreadItem }) {
  const value = item as ItemRecord;
  const src = typeof value.result === "string" ? value.result : null;
  if (!src) return null;
  return (
    <figure className="generated-image-card">
      <img alt={String(value.revisedPrompt ?? "Generated image")} src={src} />
    </figure>
  );
}

function lastAgentIndex(items: ThreadItem[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.type === "agentMessage") return index;
  }
  return -1;
}

function AgentMessage({
  afterActionsContent,
  beforeActionsContent,
  complete,
  phase,
  showActions,
  onContinue,
  text,
}: {
  afterActionsContent?: ReactNode;
  beforeActionsContent?: ReactNode;
  complete: boolean;
  phase?: unknown;
  showActions: boolean;
  onContinue(): void;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const actions = (
    <div className="agent-message-actions">
      <button
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
      </button>
      <button
        aria-label="Continue in new chat from here"
        onClick={onContinue}
        type="button"
      >
        <ContinueIcon aria-hidden="true" />
      </button>
    </div>
  );
  const phaseName = typeof phase === "string" ? phase : "";
  const commentary = phaseName === "commentary" || !showActions;
  return (
    <div
      className={`agent-message-group${commentary ? " is-commentary" : ""}${
        complete ? "" : " is-streaming"
      }`}
    >
      <article
        aria-busy={!complete}
        aria-live="polite"
        className="agent-message assistant-message"
      >
        <AssistantMarkdown text={text} />
      </article>
      {beforeActionsContent}
      {complete && showActions && actions}
      {afterActionsContent}
    </div>
  );
}

function FallbackItem({ item }: { item: ThreadItem }) {
  const text = itemText(item);
  return text ? (
    <div className="agent-message assistant-message">{text}</div>
  ) : null;
}

export function TurnView({
  onContinue,
  onEditMessage,
  turn,
}: {
  onContinue(turnId: string): void;
  onEditMessage?(text: string): Promise<void> | void;
  turn: Turn;
}) {
  const integrationItems = useMemo(
    () => turn.items.filter(isIntegrationActivity),
    [turn.items],
  );
  const firstIntegration = integrationItems[0];
  const fileItems = turn.items.filter((item) => item.type === "fileChange");
  const planItem = turn.items.find((item) => item.type === "plan");
  const generatedImages = turn.items.filter(
    (item) => item.type === "imageGeneration",
  );
  const finalAgentIndex = lastAgentIndex(turn.items);
  const lastUserIndex = turn.items
    .map((item) => item.type)
    .lastIndexOf("userMessage");
  const showWorkStatus = turn.startedAt != null;
  const reasoningLabel = turn.items
    .filter((item) => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .filter((summary) => summary.trim())
    .at(-1)
    ?.replace(/^\*\*(.*?)\*\*[\s\S]*$/, "$1");
  const hasVisibleProgress = turn.items.some((item) => {
    if (item.type === "userMessage" || item.type === "reasoning") return false;
    return Boolean(itemText(item).trim() || activityLabel(item));
  });
  const beforeActionsContent = (
    <>
      {fileItems.length > 0 && <FileChangeCard items={fileItems} />}
      {generatedImages.map((item, index) => (
        <GeneratedImageCard item={item} key={item.id ?? index} />
      ))}
    </>
  );
  const afterActionsContent = planItem ? <PlanCard item={planItem} /> : null;
  const postContent = (
    <>
      {beforeActionsContent}
      {afterActionsContent}
    </>
  );
  const hasPostContent =
    fileItems.length > 0 || planItem != null || generatedImages.length > 0;

  return (
    <section className="turn turn-view" data-turn-status={turn.status}>
      {turn.items.map((item, index) => {
        if (item.type === "userMessage") {
          return (
            <Fragment key={item.id ?? index}>
              <UserMessage onEdit={onEditMessage} text={itemText(item)} />
              {showWorkStatus &&
                turn.status === "inProgress" &&
                index === lastUserIndex && <WorkStatusDivider turn={turn} />}
            </Fragment>
          );
        }
        if (item.type === "agentMessage") {
          const text = itemText(item);
          if (!text) return null;
          return (
            <Fragment key={item.id ?? index}>
              {showWorkStatus &&
                turn.status !== "inProgress" &&
                index === finalAgentIndex && <WorkStatusDivider turn={turn} />}
              <AgentMessage
                afterActionsContent={
                  index === finalAgentIndex ? afterActionsContent : null
                }
                beforeActionsContent={
                  index === finalAgentIndex ? beforeActionsContent : null
                }
                complete={turn.status !== "inProgress"}
                onContinue={() => onContinue(turn.id)}
                phase={(item as ItemRecord).phase}
                showActions={index === finalAgentIndex}
                text={text}
              />
            </Fragment>
          );
        }
        if (item.type === "reasoning") return null;
        if (isIntegrationActivity(item)) {
          return item === firstIntegration ? (
            <ActivityGroup items={integrationItems} key={item.id ?? index} />
          ) : null;
        }
        if (item.type === "fileChange") {
          return <ActivityGroup items={[item]} key={item.id ?? index} />;
        }
        if (
          item.type === "plan" ||
          item.type === "imageGeneration" ||
          item.type === "sleep" ||
          item.type === "enteredReviewMode" ||
          item.type === "exitedReviewMode"
        ) {
          return null;
        }
        const label = activityLabel(item);
        if (label)
          return <ActivityGroup items={[item]} key={item.id ?? index} />;
        return (
          <FallbackItem item={item} key={item.id ?? `${item.type}-${index}`} />
        );
      })}
      {showWorkStatus && turn.status === "inProgress" && lastUserIndex < 0 && (
        <WorkStatusDivider turn={turn} />
      )}
      {finalAgentIndex < 0 && hasPostContent && postContent}
      {turn.status === "inProgress" && !hasVisibleProgress && (
        <div
          className="thinking-placeholder"
          aria-label={reasoningLabel || "Planning next moves"}
        >
          <Clock3 aria-hidden="true" />
          <span>{reasoningLabel || "Planning next moves"}</span>
        </div>
      )}
      {turn.error?.message && (
        <div className="turn-error">{turn.error.message}</div>
      )}
    </section>
  );
}
