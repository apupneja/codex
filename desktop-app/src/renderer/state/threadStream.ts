import type {
  JsonObject,
  JsonValue,
  Thread,
  ThreadItem,
  Turn,
} from "../../shared/types";

const OPTIMISTIC_TURN_PREFIX = "desktop-pending-turn-";
const MAX_STREAMED_TEXT_LENGTH = 2_000_000;
const MAX_REASONING_PARTS = 100;

type ReasoningItem = Extract<ThreadItem, { type: "reasoning" }>;

function appendStreamedText(current: string, delta: string): string {
  if (current.length >= MAX_STREAMED_TEXT_LENGTH) return current;
  return `${current}${delta}`.slice(0, MAX_STREAMED_TEXT_LENGTH);
}

function isOptimisticItem(item: ThreadItem): boolean {
  return item.id.startsWith(OPTIMISTIC_TURN_PREFIX);
}

export function isOptimisticTurn(turn: Turn): boolean {
  return turn.id.startsWith(OPTIMISTIC_TURN_PREFIX);
}

export function createOptimisticTurn(input: JsonValue[]): Turn {
  const id = `${OPTIMISTIC_TURN_PREFIX}${crypto.randomUUID()}`;
  return {
    completedAt: null,
    durationMs: null,
    error: null,
    id,
    items: [
      {
        clientId: id,
        content: input as unknown as Extract<
          ThreadItem,
          { type: "userMessage" }
        >["content"],
        id: `${id}-message`,
        type: "userMessage",
      },
    ],
    itemsView: "full",
    startedAt: Math.floor(Date.now() / 1_000),
    status: "inProgress",
  };
}

export function mergeItems(
  current: ThreadItem[],
  incoming: ThreadItem[],
): ThreadItem[] {
  const merged = [...current];
  for (const item of incoming) {
    let index = merged.findIndex((candidate) => candidate.id === item.id);
    if (index < 0 && item.type === "userMessage") {
      index = merged.findIndex(
        (candidate) =>
          candidate.type === "userMessage" && isOptimisticItem(candidate),
      );
    }
    if (index >= 0) {
      merged[index] = item;
    } else {
      merged.push(item);
    }
  }
  return merged;
}

export function mergeTurns(current: Turn[], incoming: Turn): Turn[] {
  let index = current.findIndex((turn) => turn.id === incoming.id);
  if (index < 0 && !isOptimisticTurn(incoming)) {
    index = current.findIndex(isOptimisticTurn);
  }
  if (index < 0) {
    return [...current, incoming];
  }
  const existing = current[index];
  if (!existing) return current;
  const merged = [...current];
  const mergedTurn = {
    ...existing,
    ...incoming,
    items: mergeItems(existing.items, incoming.items),
  };
  if (existing.status !== "inProgress" && incoming.status === "inProgress") {
    mergedTurn.completedAt = existing.completedAt;
    mergedTurn.durationMs = existing.durationMs;
    mergedTurn.error = existing.error;
    mergedTurn.status = existing.status;
  }
  merged[index] = mergedTurn;
  return merged;
}

export function failOptimisticTurn(
  thread: Thread,
  turnId: string,
  message: string,
): Thread {
  return {
    ...thread,
    status: { type: "idle" },
    turns: thread.turns.map((turn) =>
      turn.id === turnId
        ? {
            ...turn,
            completedAt: Math.floor(Date.now() / 1_000),
            error: {
              additionalDetails: null,
              codexErrorInfo: null,
              message,
            },
            status: "failed",
          }
        : turn,
    ),
  };
}

export function updateTurnItem(
  thread: Thread,
  turnId: string,
  updater: (items: ThreadItem[]) => ThreadItem[],
): Thread {
  return {
    ...thread,
    turns: thread.turns.map((turn) =>
      turn.id === turnId ? { ...turn, items: updater(turn.items) } : turn,
    ),
  };
}

function reasoningPartIndex(params: JsonObject, key: string): number | null {
  const value = Number(params[key] ?? 0);
  return Number.isInteger(value) && value >= 0 && value < MAX_REASONING_PARTS
    ? value
    : null;
}

function updateReasoningItem(
  items: ThreadItem[],
  itemId: string,
  updater: (item: ReasoningItem) => ReasoningItem,
): ThreadItem[] {
  const next = [...items];
  const index = next.findIndex((item) => item.id === itemId);
  if (index >= 0) {
    const item = next[index];
    if (item?.type === "reasoning") next[index] = updater(item);
  } else {
    next.push(
      updater({ content: [], id: itemId, summary: [], type: "reasoning" }),
    );
  }
  return next;
}

export type TurnStreamDeltaMethod =
  | "item/agentMessage/delta"
  | "item/commandExecution/outputDelta"
  | "item/commandExecution/terminalInteraction"
  | "item/fileChange/patchUpdated"
  | "item/plan/delta"
  | "item/reasoning/summaryPartAdded"
  | "item/reasoning/summaryTextDelta"
  | "item/reasoning/textDelta";

const TURN_STREAM_DELTA_METHODS: ReadonlySet<string> = new Set([
  "item/agentMessage/delta",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/fileChange/patchUpdated",
  "item/plan/delta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/textDelta",
]);

export function isTurnStreamDeltaMethod(
  method: string,
): method is TurnStreamDeltaMethod {
  return TURN_STREAM_DELTA_METHODS.has(method);
}

export function applyTurnStreamDelta(
  thread: Thread,
  turnId: string,
  method: TurnStreamDeltaMethod,
  params: JsonObject,
): Thread {
  const itemId = typeof params.itemId === "string" ? params.itemId : null;
  if (!itemId) return thread;

  if (method === "item/fileChange/patchUpdated") {
    if (!Array.isArray(params.changes)) return thread;
    const changes = params.changes as unknown as Extract<
      ThreadItem,
      { type: "fileChange" }
    >["changes"];
    return updateTurnItem(thread, turnId, (items) =>
      items.map((item) =>
        item.id === itemId && item.type === "fileChange"
          ? { ...item, changes }
          : item,
      ),
    );
  }

  if (method === "item/reasoning/summaryPartAdded") {
    const partIndex = reasoningPartIndex(params, "summaryIndex");
    if (partIndex === null) return thread;
    return updateTurnItem(thread, turnId, (items) =>
      updateReasoningItem(items, itemId, (item) => {
        const summary = [...item.summary];
        summary[partIndex] ??= "";
        return { ...item, summary };
      }),
    );
  }

  const deltaValue =
    method === "item/commandExecution/terminalInteraction"
      ? params.stdin
      : params.delta;
  const delta = typeof deltaValue === "string" ? deltaValue : null;
  if (delta === null) return thread;

  if (method === "item/agentMessage/delta") {
    return updateTurnItem(thread, turnId, (items) => {
      const next = [...items];
      const index = next.findIndex((item) => item.id === itemId);
      if (index >= 0) {
        const item = next[index];
        if (item?.type === "agentMessage") {
          next[index] = {
            ...item,
            text: appendStreamedText(item.text, delta),
          };
        }
      } else {
        next.push({
          id: itemId,
          memoryCitation: null,
          phase: null,
          text: delta.slice(0, MAX_STREAMED_TEXT_LENGTH),
          type: "agentMessage",
        });
      }
      return next;
    });
  }

  if (
    method === "item/reasoning/summaryTextDelta" ||
    method === "item/reasoning/textDelta"
  ) {
    const summary = method === "item/reasoning/summaryTextDelta";
    const partIndex = reasoningPartIndex(
      params,
      summary ? "summaryIndex" : "contentIndex",
    );
    if (partIndex === null) return thread;
    return updateTurnItem(thread, turnId, (items) =>
      updateReasoningItem(items, itemId, (item) => {
        const field = summary ? [...item.summary] : [...item.content];
        field[partIndex] = appendStreamedText(field[partIndex] ?? "", delta);
        return summary
          ? { ...item, summary: field }
          : { ...item, content: field };
      }),
    );
  }

  if (method === "item/plan/delta") {
    return updateTurnItem(thread, turnId, (items) => {
      const next = [...items];
      const index = next.findIndex((item) => item.id === itemId);
      if (index >= 0) {
        const item = next[index];
        if (item?.type === "plan") {
          next[index] = {
            ...item,
            text: appendStreamedText(item.text, delta),
          };
        }
      } else {
        next.push({ id: itemId, text: delta, type: "plan" });
      }
      return next;
    });
  }

  return updateTurnItem(thread, turnId, (items) =>
    items.map((item) => {
      if (item.id !== itemId || item.type !== "commandExecution") return item;
      const outputDelta =
        method === "item/commandExecution/terminalInteraction"
          ? `${item.aggregatedOutput?.endsWith("\n") || !item.aggregatedOutput ? "" : "\n"}> ${delta}`
          : delta;
      return {
        ...item,
        aggregatedOutput: appendStreamedText(
          item.aggregatedOutput ?? "",
          outputDelta,
        ),
      };
    }),
  );
}
