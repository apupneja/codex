import { ChevronDown, Wrench } from "lucide-react";
import { useState } from "react";

import type { ThreadItem } from "../../shared/types";

type McpToolCallItemProps = {
  item: Extract<ThreadItem, { type: "mcpToolCall" }>;
  progressMessages: string[];
};

export function McpToolCallItem({
  item,
  progressMessages,
}: McpToolCallItemProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="activity-item">
      <button
        aria-expanded={expanded}
        className="activity-summary"
        onClick={() => setExpanded((value) => !value)}
      >
        <Wrench size={14} />
        <span>{item.status === "inProgress" ? "Calling" : "Called"}</span>
        <code>
          {item.server} · {item.tool}
        </code>
        <ChevronDown className={expanded ? "expanded" : ""} size={13} />
      </button>
      {expanded ? (
        <pre className="activity-detail">
          {JSON.stringify(
            {
              arguments: item.arguments,
              ...(progressMessages.length
                ? { progress: progressMessages }
                : {}),
              ...(item.result ? { result: item.result } : {}),
              ...(item.error ? { error: item.error.message } : {}),
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </div>
  );
}
