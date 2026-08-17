import type { Thread } from "../../../shared/protocol";
import { CircleHelp } from "lucide-react";
import { TurnView } from "./TurnView";
import { useThreadScroll } from "./useThreadScroll";

export function ThreadTimeline({
  askingQuestions,
  onContinue,
  onEditMessage,
  requestStatus,
  thread,
}: {
  askingQuestions?: boolean;
  onContinue(turnId: string): void;
  onEditMessage(text: string): Promise<void> | void;
  requestStatus?: string;
  thread: Thread;
}) {
  const streamRevision = thread.turns.reduce(
    (count, turn) =>
      count +
      turn.items.reduce(
        (itemTotal, item) =>
          itemTotal +
          1 +
          (item.text?.length ?? 0) +
          (item.aggregatedOutput?.length ?? 0) +
          (item.summary?.reduce(
            (summaryTotal, part) => summaryTotal + part.length,
            0,
          ) ?? 0) +
          (item.content?.reduce(
            (contentTotal, part) =>
              contentTotal +
              (typeof part === "string"
                ? part.length
                : (part.text?.length ?? 0)),
            0,
          ) ?? 0),
        0,
      ),
    0,
  );
  const latestTurn = thread.turns.at(-1);
  const latestUserMessage = latestTurn?.items
    .filter((item) => item.type === "userMessage")
    .at(-1);
  const latestUserAnchor = latestTurn
    ? `${latestTurn.id}:${latestUserMessage?.id ?? "user"}`
    : null;
  const scrollRef = useThreadScroll(streamRevision, latestUserAnchor);
  return (
    <div className="thread-scroll" ref={scrollRef}>
      <div className="thread-timeline">
        {thread.turns.map((turn, index) => (
          <TurnView
            key={turn.id}
            onContinue={onContinue}
            onEditMessage={
              index === thread.turns.length - 1 ? onEditMessage : undefined
            }
            turn={turn}
          />
        ))}
        {(askingQuestions || requestStatus) && (
          <div className="thread-request-status">
            {askingQuestions && <CircleHelp aria-hidden="true" />}
            <span>{askingQuestions ? "Asking questions" : requestStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}
