import type { Thread, ThreadItem, Turn } from "../../shared/protocol";

export function mergeThreadCatalog(
  preferred: Thread[],
  fallback: Thread[],
): Thread[] {
  const byId = new Map(fallback.map((thread) => [thread.id, thread]));
  for (const thread of preferred) {
    const previous = byId.get(thread.id);
    byId.set(thread.id, {
      ...previous,
      ...thread,
      turns: thread.turns.length ? thread.turns : (previous?.turns ?? []),
    });
  }
  return [...byId.values()].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

export function replaceTurn(thread: Thread, turn: Turn): Thread {
  const turns = [...thread.turns];
  const index = turns.findIndex((candidate) => candidate.id === turn.id);
  if (index === -1) turns.push(turn);
  else turns[index] = turn;
  return { ...thread, turns };
}

export function replaceItem(
  thread: Thread,
  turnId: string,
  item: ThreadItem,
): Thread {
  const turn = thread.turns.find((candidate) => candidate.id === turnId) ?? {
    id: turnId,
    items: [],
    status: "inProgress" as const,
  };
  const items = [...turn.items];
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) items.push(item);
  else items[index] = item;
  return replaceTurn(thread, { ...turn, items });
}

function findItem(
  thread: Thread,
  turnId: string,
  itemId: string,
): ThreadItem | undefined {
  return thread.turns
    .find((turn) => turn.id === turnId)
    ?.items.find((item) => item.id === itemId);
}

function normalizedIndex(index: number): number {
  return Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
}

export function appendItemText(
  thread: Thread,
  turnId: string,
  itemId: string,
  type: string,
  field: "aggregatedOutput" | "text",
  delta: string,
): Thread {
  const item = findItem(thread, turnId, itemId);
  const previous = field === "text" ? item?.text : item?.aggregatedOutput;
  return replaceItem(thread, turnId, {
    ...item,
    [field]: `${previous ?? ""}${delta}`,
    id: itemId,
    type,
  });
}

export function appendReasoningSummary(
  thread: Thread,
  turnId: string,
  itemId: string,
  summaryIndex: number,
  delta: string,
): Thread {
  const item = findItem(thread, turnId, itemId);
  const summary = [...(item?.summary ?? [])];
  const index = normalizedIndex(summaryIndex);
  while (summary.length <= index) summary.push("");
  summary[index] = `${summary[index] ?? ""}${delta}`;
  return replaceItem(thread, turnId, {
    ...item,
    id: itemId,
    summary,
    type: "reasoning",
  });
}

export function appendReasoningText(
  thread: Thread,
  turnId: string,
  itemId: string,
  contentIndex: number,
  delta: string,
): Thread {
  const item = findItem(thread, turnId, itemId);
  const content = [...(item?.content ?? [])];
  const index = normalizedIndex(contentIndex);
  while (content.length <= index) content.push("");
  const part = content[index];
  const previous = typeof part === "string" ? part : (part?.text ?? "");
  content[index] = `${previous}${delta}`;
  return replaceItem(thread, turnId, {
    ...item,
    content,
    id: itemId,
    type: "reasoning",
  });
}

export function mergeCompletedTurn(thread: Thread, turn: Turn): Thread {
  const existing = thread.turns.find((candidate) => candidate.id === turn.id);
  if (!existing) return replaceTurn(thread, turn);
  const items = [...existing.items];
  for (const item of turn.items) {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index === -1) items.push(item);
    else items[index] = item;
  }
  return replaceTurn(thread, { ...existing, ...turn, items });
}
