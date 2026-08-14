import type { ThreadItem } from "../../shared/types";

export function reasoningText(
  item: Extract<ThreadItem, { type: "reasoning" }>,
): string {
  const seen = new Set<string>();
  return [...item.summary, ...item.content]
    .flatMap((entry) => entry.split(/\n{2,}/))
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry) return false;
      const normalized = entry.replace(/\s+/g, " ");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n\n");
}

export function isVisibleThreadItem(item: ThreadItem): boolean {
  if (item.type === "reasoning") {
    return reasoningText(item).length > 0;
  }
  if (item.type === "agentMessage" || item.type === "plan") {
    return item.text.trim().length > 0;
  }
  return true;
}
