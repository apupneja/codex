import { ChevronDown, Copy, FileDiff, GitBranch } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ThreadItem } from "../../shared/types";
import { summarizeThreadChanges } from "./ThreadChanges";

type ChangeReviewPanelProps = {
  branch: string;
  diff: string;
  items: ThreadItem[];
  selectedPath: string | null;
};

function diffLineKind(line: string): string {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+") && !line.startsWith("+++")) return "addition";
  if (line.startsWith("-") && !line.startsWith("---")) return "deletion";
  if (line.startsWith("diff ") || line.startsWith("index ")) return "meta";
  return "context";
}

function changeLabel(kind: string | undefined): string {
  if (kind === "add") return "added";
  if (kind === "delete") return "deleted";
  return "modified";
}

export function ChangeReviewPanel({
  branch,
  diff,
  items,
  selectedPath,
}: ChangeReviewPanelProps) {
  const changes = useMemo(() => summarizeThreadChanges(items), [items]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const cards = useRef(new Map<string, HTMLElement>());
  const additions = changes.reduce(
    (count, change) => count + change.additions,
    0,
  );
  const deletions = changes.reduce(
    (count, change) => count + change.deletions,
    0,
  );

  useEffect(() => {
    if (!selectedPath) return;
    setCollapsed((current) => {
      if (!current.has(selectedPath)) return current;
      const next = new Set(current);
      next.delete(selectedPath);
      return next;
    });
    const frame = window.requestAnimationFrame(() => {
      cards.current.get(selectedPath)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedPath]);

  return (
    <section className="change-review-panel">
      <header className="change-review-header">
        <div className="change-review-status">
          <span>Last Agent Turn</span>
          {additions ? <b className="addition">+{additions}</b> : null}
          {deletions ? <b className="deletion">−{deletions}</b> : null}
          <span className="change-review-branch" title={branch}>
            <GitBranch size={12} /> {branch}
          </span>
        </div>
        <h2>
          {changes.length ? `${changes.length} Files Changed` : "Changes"}
        </h2>
        <nav aria-label="Change review sections">
          <span className="active">Changes</span>
          <span>Summary</span>
        </nav>
      </header>
      {changes.length ? (
        <div className="change-review-list">
          {changes.map((change) => {
            const isCollapsed = collapsed.has(change.path);
            const basename = change.path.split(/[\\/]/).pop() ?? change.path;
            return (
              <article
                className={`change-review-card ${selectedPath === change.path ? "selected" : ""}`}
                key={change.path}
                ref={(node) => {
                  if (node) cards.current.set(change.path, node);
                  else cards.current.delete(change.path);
                }}
              >
                <div className="change-review-card-header">
                  <button
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${basename}`}
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(change.path)) next.delete(change.path);
                        else next.add(change.path);
                        return next;
                      })
                    }
                  >
                    <ChevronDown
                      className={isCollapsed ? "collapsed" : ""}
                      size={13}
                    />
                    <span title={change.path}>{change.path}</span>
                  </button>
                  <button
                    aria-label={`Copy path ${change.path}`}
                    className="copy-change-path"
                    onClick={() =>
                      void navigator.clipboard.writeText(change.path)
                    }
                  >
                    <Copy size={12} />
                  </button>
                  {change.additions ? (
                    <b className="addition">+{change.additions}</b>
                  ) : null}
                  {change.deletions ? (
                    <b className="deletion">−{change.deletions}</b>
                  ) : null}
                  <small>{changeLabel(change.kind.type)}</small>
                </div>
                {!isCollapsed ? (
                  <pre className="change-review-diff">
                    {change.diff.split("\n").map((line, index) => (
                      <span
                        className={`diff-line diff-${diffLineKind(line)}`}
                        key={`${change.path}-${index}`}
                      >
                        {line || " "}
                      </span>
                    ))}
                  </pre>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : diff ? (
        <pre className="unified-diff">{diff}</pre>
      ) : (
        <div className="panel-empty">
          <FileDiff size={24} /> No changes in this task yet.
        </div>
      )}
    </section>
  );
}
