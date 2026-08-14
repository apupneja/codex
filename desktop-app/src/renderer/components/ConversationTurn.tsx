import {
  Clipboard,
  ExternalLink,
  GitFork,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ThreadItem, Turn } from "../../shared/types";
import { localPathFromHref } from "../lib/conversationLinks";
import { isVisibleThreadItem } from "../lib/threadItemVisibility";
import type { CodexController } from "../state/useCodexController";
import { ConversationTurnStatus } from "./ConversationTurnStatus";
import { ToolItem } from "./ToolItem";
import { UserMessage } from "./UserMessage";
import { useSmoothStreamingText } from "./useSmoothStreamingText";

type AgentMessage = Extract<ThreadItem, { type: "agentMessage" }>;
type TurnController = Pick<
  CodexController,
  "activeThread" | "addToast" | "itemProgress"
>;

type ConversationTurnProps = {
  controller: TurnController;
  onOpenChange(path: string): void;
  onOpenFile(path: string): void;
  turn: Turn;
};

function isAnswer(item: ThreadItem): item is AgentMessage {
  return item.type === "agentMessage" && item.phase !== "commentary";
}

function isTrace(item: ThreadItem): boolean {
  return (
    item.type !== "userMessage" &&
    (item.type !== "agentMessage" || item.phase === "commentary")
  );
}

function MessageActions({
  controller,
  text,
}: {
  controller: TurnController;
  text: string;
}) {
  return (
    <div className="message-actions">
      <button
        aria-label="Helpful response"
        onClick={() => controller.addToast("Feedback recorded", "success")}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        aria-label="Unhelpful response"
        onClick={() => controller.addToast("Feedback recorded")}
      >
        <ThumbsDown size={13} />
      </button>
      <button
        aria-label="Branch from response"
        onClick={() =>
          controller.addToast("Start a new chat to branch from this response")
        }
      >
        <GitFork size={13} />
      </button>
      <button
        aria-label="Copy response"
        onClick={() =>
          void navigator.clipboard
            .writeText(text)
            .then(() => controller.addToast("Response copied", "success"))
            .catch((error: unknown) =>
              controller.addToast(
                error instanceof Error ? error.message : String(error),
                "danger",
              ),
            )
        }
      >
        <Clipboard size={13} />
      </button>
    </div>
  );
}

export function ConversationTurn({
  controller,
  onOpenChange,
  onOpenFile,
  turn,
}: ConversationTurnProps) {
  const items = turn.items.filter(isVisibleThreadItem);
  const response = [...items].reverse().find(isAnswer);
  const { displayedText, settled } = useSmoothStreamingText(
    response?.text ?? "",
    response?.id ?? turn.id,
  );
  const writingSettled = !response || settled;
  const visuallyActive = turn.status === "inProgress" || !writingSettled;
  const traceItems = items.filter(isTrace);
  const cwd = controller.activeThread?.cwd ?? null;

  const markdownComponents = {
    a: ({ href, children }: { children?: React.ReactNode; href?: string }) => (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (!href) return;
          const localPath = localPathFromHref(href, cwd);
          if (localPath) {
            onOpenFile(localPath);
          } else if (!href.startsWith("#")) {
            void window.codexDesktop
              .openExternal(href)
              .catch((error: unknown) =>
                controller.addToast(
                  error instanceof Error ? error.message : String(error),
                  "danger",
                ),
              );
          }
        }}
      >
        {children}
        <ExternalLink size={11} />
      </a>
    ),
    code: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => <code className={className}>{children}</code>,
  };

  return (
    <section
      aria-busy={visuallyActive}
      className={`turn ${visuallyActive ? "is-streaming" : ""}`}
    >
      {items.map((item) => {
        if (item.type === "userMessage") {
          return (
            <UserMessage item={item} key={item.id} onOpenFile={onOpenFile} />
          );
        }
        if (!isAnswer(item)) return null;
        return (
          <article
            className={`agent-message markdown turn-answer ${item.id === response?.id && !writingSettled ? "is-streaming" : ""}`}
            key={item.id}
          >
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {item.id === response?.id ? displayedText : item.text}
            </ReactMarkdown>
          </article>
        );
      })}
      <ConversationTurnStatus
        actions={
          response && turn.status !== "inProgress" && writingSettled ? (
            <MessageActions controller={controller} text={response.text} />
          ) : undefined
        }
        turn={turn}
        writingSettled={writingSettled}
      >
        {traceItems.map((item) => {
          if (item.type === "agentMessage") {
            return (
              <article
                className="agent-message markdown turn-trace agent-commentary"
                key={item.id}
              >
                <ReactMarkdown
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {item.text}
                </ReactMarkdown>
              </article>
            );
          }
          if (item.type === "plan") {
            return (
              <div className="agent-message markdown turn-trace" key={item.id}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {item.text}
                </ReactMarkdown>
              </div>
            );
          }
          return (
            <div className="turn-trace turn-trace-item" key={item.id}>
              <ToolItem
                cwd={cwd}
                item={item}
                onOpenChange={onOpenChange}
                onOpenFile={onOpenFile}
                progressMessages={controller.itemProgress[item.id]}
              />
            </div>
          );
        })}
      </ConversationTurnStatus>
    </section>
  );
}
