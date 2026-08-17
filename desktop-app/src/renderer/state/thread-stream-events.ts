import type { Thread, ThreadItem } from "../../shared/protocol";
import {
  appendItemText,
  appendReasoningSummary,
  appendReasoningText,
  replaceItem,
} from "./thread-store";

export function applyThreadItemStreamEvent(
  thread: Thread,
  method: string,
  params: Record<string, unknown>,
  turnId: string,
): Thread {
  const itemId = String(params.itemId ?? "");
  const delta = String(params.delta ?? "");
  switch (method) {
    case "item/started":
    case "item/completed":
      return replaceItem(thread, turnId, params.item as ThreadItem);
    case "item/agentMessage/delta":
      return appendItemText(
        thread,
        turnId,
        itemId,
        "agentMessage",
        "text",
        delta,
      );
    case "item/plan/delta":
      return appendItemText(thread, turnId, itemId, "plan", "text", delta);
    case "item/reasoning/summaryPartAdded":
      return appendReasoningSummary(
        thread,
        turnId,
        itemId,
        Number(params.summaryIndex ?? 0),
        "",
      );
    case "item/reasoning/summaryTextDelta":
      return appendReasoningSummary(
        thread,
        turnId,
        itemId,
        Number(params.summaryIndex ?? 0),
        delta,
      );
    case "item/reasoning/textDelta":
      return appendReasoningText(
        thread,
        turnId,
        itemId,
        Number(params.contentIndex ?? 0),
        delta,
      );
    case "item/commandExecution/outputDelta":
      return appendItemText(
        thread,
        turnId,
        itemId,
        "commandExecution",
        "aggregatedOutput",
        delta,
      );
    default:
      return thread;
  }
}
