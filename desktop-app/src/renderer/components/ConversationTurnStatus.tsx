import { ChevronDown } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { ThreadItem, Turn } from "../../shared/types";
import { isVisibleThreadItem } from "../lib/threadItemVisibility";

type ConversationTurnStatusProps = {
  actions?: ReactNode;
  children?: ReactNode;
  turn: Pick<Turn, "durationMs" | "items" | "status"> &
    Partial<Pick<Turn, "startedAt">>;
  writingSettled?: boolean;
};

function durationValue(durationMs: number | null): string | null {
  if (!durationMs) return null;
  if (durationMs < 1_000) return `${durationMs}ms`;
  const totalSeconds = Math.round(durationMs / 1_000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function isTraceItem(item: ThreadItem): boolean {
  return (
    item.type !== "userMessage" &&
    (item.type !== "agentMessage" || item.phase === "commentary")
  );
}

function isRunningActivity(item: ThreadItem): boolean {
  switch (item.type) {
    case "collabAgentToolCall":
    case "commandExecution":
    case "dynamicToolCall":
    case "fileChange":
    case "mcpToolCall":
      return item.status === "inProgress";
    case "imageGeneration":
      return item.status === "inProgress";
    case "contextCompaction":
    case "enteredReviewMode":
    case "exitedReviewMode":
    case "hookPrompt":
    case "imageView":
    case "plan":
    case "reasoning":
    case "sleep":
    case "subAgentActivity":
    case "webSearch":
    case "agentMessage":
    case "userMessage":
      return false;
  }
}

function compactActivityText(value: string): string {
  return (
    value
      .replace(/[*_`#>]/g, "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function fileActivityLabel(
  verb: string,
  paths: string[],
  fallback: string,
): string {
  const path = paths[0];
  if (!path) return fallback;
  const extra = paths.length > 1 ? ` +${paths.length - 1} files` : "";
  return `${verb} ${path}${extra}`;
}

function commandActivityLabel(
  item: Extract<ThreadItem, { type: "commandExecution" }>,
): string {
  const search = item.commandActions.find((action) => action.type === "search");
  if (search?.type === "search") {
    const target = search.query ? `“${search.query}”` : "files";
    return search.path
      ? `Searching ${target} in ${search.path}`
      : `Searching ${target}`;
  }
  const reads = item.commandActions.flatMap((action) =>
    action.type === "read" ? [action.path] : [],
  );
  if (reads.length) return fileActivityLabel("Reading", reads, "Reading files");
  const listing = item.commandActions.find(
    (action) => action.type === "listFiles",
  );
  if (listing?.type === "listFiles") {
    return listing.path ? `Listing files in ${listing.path}` : "Listing files";
  }
  return `Running ${item.command}`;
}

function workingLabel(items: ThreadItem[]): string {
  const active = [...items].reverse().find(isRunningActivity);
  switch (active?.type) {
    case "commandExecution":
      return commandActivityLabel(active);
    case "mcpToolCall":
      return `Using ${active.server} · ${active.tool}`;
    case "dynamicToolCall":
      return `Using ${active.namespace ? `${active.namespace} · ` : ""}${active.tool}`;
    case "fileChange":
      return fileActivityLabel(
        "Editing",
        active.changes.map((change) => change.path),
        "Editing files",
      );
    case "collabAgentToolCall":
      return "Coordinating agents";
    case "imageGeneration":
      return "Generating image";
  }

  const latest = items.at(-1);
  switch (latest?.type) {
    case "reasoning":
      return (
        compactActivityText(
          [...latest.summary, ...latest.content].reverse().find(Boolean) ?? "",
        ) || "Thinking"
      );
    case "plan":
      return compactActivityText(latest.text) || "Planning";
    case "sleep":
      return "Waiting";
    case "webSearch":
      return latest.query
        ? `Searching the web for “${latest.query}”`
        : "Searching the web";
    case "imageView":
      return `Viewing ${latest.path}`;
    case "agentMessage":
      return latest.phase === "commentary" ? "Working" : "Writing response";
    case undefined:
      return "Planning next moves";
    default:
      return "Working";
  }
}

function useLiveDuration(
  startedAt: number | null | undefined,
  active: boolean,
) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || !startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  if (!active || !startedAt) return null;
  return durationValue(Math.max(0, now - startedAt * 1_000));
}

export function ConversationTurnStatus({
  actions,
  children,
  turn,
  writingSettled = true,
}: ConversationTurnStatusProps) {
  const active = turn.status === "inProgress" || !writingSettled;
  const traceItems = turn.items.filter(
    (item) => isTraceItem(item) && isVisibleThreadItem(item),
  );
  const responseVisible = turn.items.some(
    (item) =>
      item.type === "agentMessage" &&
      item.phase !== "commentary" &&
      isVisibleThreadItem(item),
  );
  const runningActivity = traceItems.some(isRunningActivity);
  const label = active
    ? responseVisible && !runningActivity
      ? "Writing response"
      : workingLabel(traceItems)
    : turn.status === "failed"
      ? turn.durationMs
        ? `Failed after ${durationValue(turn.durationMs)}`
        : "Failed"
      : turn.status === "interrupted"
        ? turn.durationMs
          ? `Stopped after ${durationValue(turn.durationMs)}`
          : "Stopped"
        : turn.durationMs
          ? `Worked for ${durationValue(turn.durationMs)}`
          : "Worked";
  const liveDuration = useLiveDuration(turn.startedAt, active);
  const hasTrace = traceItems.length > 0 && children !== undefined;
  const [expanded, setExpanded] = useState(false);
  const wasActive = useRef(active);
  const regionId = useId();

  useLayoutEffect(() => {
    if (active !== wasActive.current) setExpanded(false);
    wasActive.current = active;
  }, [active]);

  const summary = (
    <>
      <span className="turn-status-label" title={label}>
        {label}
      </span>
      {liveDuration ? (
        <span className="turn-live-duration">{liveDuration}</span>
      ) : null}
      {hasTrace ? (
        <ChevronDown className={expanded ? "expanded" : ""} size={14} />
      ) : null}
    </>
  );

  return (
    <section
      aria-live="polite"
      className={`turn-activity ${active ? "is-active" : ""} ${expanded ? "is-expanded" : ""} ${turn.status === "failed" && !active ? "turn-failed" : ""}`}
    >
      <div className="turn-activity-header">
        {hasTrace ? (
          <button
            aria-controls={regionId}
            aria-expanded={expanded}
            className="turn-activity-summary"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {summary}
          </button>
        ) : (
          <div className="turn-activity-summary" role="status">
            {summary}
          </div>
        )}
        {actions}
      </div>
      {hasTrace && expanded ? (
        <div className="turn-activity-detail" id={regionId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
