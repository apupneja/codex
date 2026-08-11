import { FileCode2 } from "lucide-react";
import { useMemo } from "react";

import type { ThreadItem } from "../../shared/types";

type FileChange = Extract<
  ThreadItem,
  { type: "fileChange" }
>["changes"][number];

type ThreadChangesProps = {
  items: ThreadItem[];
  onOpenChange(path: string): void;
  onReview(): void;
};

type ChangeSummary = FileChange & {
  additions: number;
  deletions: number;
};

function changedLineCount(diff: string): number {
  const lines = diff.split("\n");
  return lines.at(-1) === "" ? Math.max(0, lines.length - 1) : lines.length;
}

function summarizeChange(change: FileChange): ChangeSummary {
  const additions = change.diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const deletions = change.diff
    .split("\n")
    .filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  const fallbackCount = changedLineCount(change.diff);

  return {
    ...change,
    additions:
      additions || deletions || change.kind.type !== "add"
        ? additions
        : fallbackCount,
    deletions:
      additions || deletions || change.kind.type !== "delete"
        ? deletions
        : fallbackCount,
  };
}

export function summarizeThreadChanges(items: ThreadItem[]): ChangeSummary[] {
  const byPath = new Map<string, ChangeSummary>();
  for (const item of items) {
    if (item.type !== "fileChange") continue;
    for (const change of item.changes) {
      byPath.set(change.path, summarizeChange(change));
    }
  }
  return [...byPath.values()];
}

export function ThreadChanges({
  items,
  onOpenChange,
  onReview,
}: ThreadChangesProps) {
  const changes = useMemo(() => summarizeThreadChanges(items), [items]);
  if (!changes.length) return null;

  return (
    <section className="thread-changes" aria-label="Files changed">
      <div className="thread-changes-header">
        <span>
          {changes.length} {changes.length === 1 ? "File" : "Files"} Changed
        </span>
        <button onClick={onReview}>Review</button>
      </div>
      <div className="thread-change-list">
        {changes.map((change) => (
          <button
            className="thread-change-row"
            key={change.path}
            onClick={() => onOpenChange(change.path)}
            title={change.path}
          >
            <FileCode2 size={14} />
            <span>{change.path.split(/[\\/]/).pop()}</span>
            {change.additions ? (
              <b className="addition">+{change.additions}</b>
            ) : null}
            {change.deletions ? (
              <b className="deletion">−{change.deletions}</b>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}
