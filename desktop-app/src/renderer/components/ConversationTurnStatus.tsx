import type { Turn } from "../../shared/types";

type ConversationTurnStatusProps = {
  turn: Pick<Turn, "durationMs" | "items" | "status">;
};

function durationLabel(durationMs: number | null): string {
  if (!durationMs) return "Worked";
  if (durationMs < 1_000) return `Worked for ${durationMs}ms`;
  if (durationMs < 60_000) {
    return `Worked for ${Math.round(durationMs / 1_000)}s`;
  }
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `Worked for ${minutes}m ${seconds}s`;
}

export function ConversationTurnStatus({ turn }: ConversationTurnStatusProps) {
  if (turn.status === "inProgress") {
    const hasVisibleProgress = turn.items.some(
      (item) => item.type !== "userMessage",
    );
    if (hasVisibleProgress) return null;
    return (
      <div aria-live="polite" className="turn-meta turn-progress" role="status">
        <span className="turn-working">Planning next moves</span>
      </div>
    );
  }

  return (
    <div className="turn-meta">
      <span>{durationLabel(turn.durationMs)}</span>
    </div>
  );
}
