import type { Thread } from "../../shared/protocol";
import type { Route } from "../state/navigation";
import { isThreadPinned, setThreadPinned } from "../state/thread-pins";
import { ArchiveIcon, PinIcon, SpinnerIcon, UnpinIcon } from "../ui/AppIcons";

export function threadTitle(thread: Thread): string {
  return thread.name?.trim() || thread.preview?.trim() || "New chat";
}

export function SidebarThreadRow({
  activeRoute,
  busy,
  onOpenThread,
  thread,
}: {
  activeRoute: Route;
  busy: boolean;
  onOpenThread(thread: Thread): void;
  thread: Thread;
}) {
  const pinned = isThreadPinned(thread.id);

  return (
    <div
      className={`thread-row${activeRoute.kind === "thread" && activeRoute.threadId === thread.id ? " is-active" : ""}`}
      data-thread-id={thread.id}
      onClick={() => onOpenThread(thread)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenThread(thread);
        }
      }}
      role="button"
      tabIndex={0}
      title={threadTitle(thread)}
    >
      <span className="thread-row__title">{threadTitle(thread)}</span>
      <span className="thread-row__actions">
        <button
          aria-label={pinned ? "Unpin chat" : "Pin chat"}
          onClick={(event) => {
            event.stopPropagation();
            setThreadPinned(thread.id, !pinned);
          }}
          type="button"
        >
          {pinned ? (
            <UnpinIcon aria-hidden="true" />
          ) : (
            <PinIcon aria-hidden="true" />
          )}
        </button>
        <button
          aria-label="Archive chat"
          onClick={(event) => {
            event.stopPropagation();
            void window.chatgptDesktop.request("thread/archive", {
              threadId: thread.id,
            });
          }}
          type="button"
        >
          <ArchiveIcon aria-hidden="true" />
        </button>
      </span>
      {busy && (
        <span aria-label="Chat in progress" className="thread-row__busy">
          <SpinnerIcon aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
