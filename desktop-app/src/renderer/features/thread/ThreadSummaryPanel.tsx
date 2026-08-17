import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Github,
  GitBranch,
  Globe2,
  HardDrive,
  Image,
  ListTodo,
  MoreHorizontal,
  PictureInPicture2,
  Play,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { Thread, ThreadItem } from "../../../shared/protocol";
import { useSession } from "../../state/session";

type Source = { id: string; kind: "image" | "web"; label: string };

function repositoryLabel(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  const userIndex = parts.indexOf("Users");
  if (userIndex >= 0 && parts[userIndex + 1] && parts.at(-1)) {
    return `${parts[userIndex + 1]}/${parts.at(-1)}`;
  }
  return parts.slice(-2).join("/") || "Local repository";
}

function changeTotals(thread: Thread): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;
  for (const item of thread.turns.flatMap((turn) => turn.items)) {
    if (item.type !== "fileChange" || !Array.isArray(item.changes)) continue;
    if (typeof item.additions === "number") additions += item.additions;
    if (typeof item.deletions === "number") deletions += item.deletions;
    for (const change of item.changes) {
      if (typeof change.diff !== "string") continue;
      for (const line of change.diff.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
        if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
      }
    }
  }
  return { additions, deletions };
}

function itemSources(item: ThreadItem): Source[] {
  const sources: Source[] = [];
  for (const [index, part] of (item.content ?? []).entries()) {
    if (typeof part === "string" || !part.path) continue;
    sources.push({
      id: `${item.id ?? "item"}-image-${index}`,
      kind: "image",
      label: part.path.split(/[\\/]/).at(-1) ?? "Image",
    });
  }
  if (item.type === "imageView" && typeof item.path === "string") {
    sources.push({
      id: `${item.id ?? item.path}-view`,
      kind: "image",
      label: item.path.split(/[\\/]/).at(-1) ?? "Image",
    });
  }
  if (item.type === "webSearch") {
    sources.push({
      id: `${item.id ?? "web-search"}-web`,
      kind: "web",
      label: "Web search",
    });
  }
  return sources;
}

function SummaryRow({
  children,
  icon: Icon,
  muted = false,
  trailing,
}: {
  children: ReactNode;
  icon: ComponentType<{ "aria-hidden"?: boolean }>;
  muted?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      className={`thread-summary-panel__row${muted ? " is-muted" : ""}`}
      type="button"
    >
      <Icon aria-hidden={true} />
      <span>{children}</span>
      {trailing && (
        <span className="thread-summary-panel__trailing">{trailing}</span>
      )}
    </button>
  );
}

export function ThreadSummaryPanel({ onOpenFiles }: { onOpenFiles(): void }) {
  const { current } = useSession();
  if (!current) return null;

  const totals = changeTotals(current);
  const items = current.turns.flatMap((turn) => turn.items);
  const processCount = items.filter(
    (item) => item.type === "commandExecution" && item.status === "inProgress",
  ).length;
  const sources = items
    .flatMap(itemSources)
    .filter(
      (source, index, all) =>
        all.findIndex((candidate) => candidate.id === source.id) === index,
    );

  return (
    <aside
      aria-label="Environment"
      className="thread-summary-panel"
      role="dialog"
    >
      <header className="thread-summary-panel__header">
        <span>Environment</span>
        <div>
          <button aria-label="Environment actions" type="button">
            <MoreHorizontal aria-hidden="true" />
          </button>
          <button aria-label="Run environment action" type="button">
            <Play aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="thread-summary-panel__section">
        <SummaryRow
          icon={ListTodo}
          trailing={
            <span className="thread-summary-panel__changes">
              <b>+{totals.additions.toLocaleString()}</b>{" "}
              <i>-{totals.deletions.toLocaleString()}</i>
            </span>
          }
        >
          Changes
        </SummaryRow>
        <SummaryRow icon={HardDrive} trailing={<ChevronDown />}>
          Local
        </SummaryRow>
        <SummaryRow icon={GitBranch} trailing={<ChevronDown />}>
          {repositoryLabel(current.cwd)}
        </SummaryRow>
        <SummaryRow icon={SlidersHorizontal}>Commit or push</SummaryRow>
        <SummaryRow icon={Github}>Create pull request</SummaryRow>
      </section>

      <section className="thread-summary-panel__section thread-summary-panel__section--single">
        <SummaryRow icon={CircleDot} muted trailing={<ChevronRight />}>
          Background processes{processCount ? ` ${processCount}` : ""}
        </SummaryRow>
      </section>

      <section className="thread-summary-panel__section">
        <h3>Computer Use</h3>
        <SummaryRow
          icon={PictureInPicture2}
          trailing={
            <span className="thread-summary-panel__text-action">Hide</span>
          }
        >
          Picture in Picture
        </SummaryRow>
      </section>

      <section className="thread-summary-panel__section thread-summary-panel__sources">
        <div className="thread-summary-panel__section-heading">
          <h3>Sources</h3>
          <button aria-label="Add source" onClick={onOpenFiles} type="button">
            <Plus aria-hidden="true" />
          </button>
        </div>
        {sources.slice(0, 2).map((source) => (
          <SummaryRow
            icon={source.kind === "image" ? Image : Globe2}
            key={source.id}
            muted
          >
            {source.label}
          </SummaryRow>
        ))}
        {sources.length === 0 && (
          <SummaryRow icon={Globe2} muted>
            Web search
          </SummaryRow>
        )}
        <SummaryRow icon={ChevronRight} muted>
          View all
        </SummaryRow>
      </section>
    </aside>
  );
}
