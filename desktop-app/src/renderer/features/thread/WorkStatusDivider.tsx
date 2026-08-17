import { useEffect, useState } from "react";

import type { Turn } from "../../../shared/protocol";

function timestampMs(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function formatElapsed(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60)
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function WorkStatusDivider({ turn }: { turn: Turn }) {
  const startedAt = timestampMs(turn.startedAt);
  const completedAt = timestampMs(turn.completedAt);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (turn.status !== "inProgress" || completedAt != null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [completedAt, turn.status]);

  if (startedAt == null) return null;
  const elapsed = Math.max(0, (completedAt ?? now) - startedAt);
  const duration = formatElapsed(elapsed);
  const label =
    turn.status === "inProgress"
      ? elapsed < 1000
        ? "Working"
        : `Working for ${duration}`
      : turn.status === "interrupted"
        ? `You stopped after ${duration}`
        : `Worked for ${duration}`;

  return (
    <div aria-live="polite" className="work-status-divider">
      <span>{label}</span>
    </div>
  );
}
