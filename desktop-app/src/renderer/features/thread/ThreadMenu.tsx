import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";

import { useSession } from "../../state/session";
import { isThreadPinned, setThreadPinned } from "../../state/thread-pins";
import {
  ArchiveIcon,
  CopyIcon,
  GitBranchIcon,
  MoreIcon,
  PinIcon,
  ProjectClearIcon,
  RenameIcon,
  ScheduledIcon,
  SideChatIcon,
  UnpinIcon,
  WorkChevronRightIcon,
  WorkRunIcon,
} from "../../ui/AppIcons";
import { IconButton } from "../../ui/IconButton";
import { Menu } from "../../ui/Menu";

type Submenu = "copy" | "continue" | null;

function ActionItem({
  accelerator,
  icon: Icon,
  label,
  onHover,
  onSelect,
  submenu = false,
}: {
  accelerator?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean }>;
  label: string;
  onHover?(): void;
  onSelect?(): void;
  submenu?: boolean;
}) {
  return (
    <button
      className="thread-action-menu__item"
      onClick={onSelect}
      onFocus={onHover}
      onMouseEnter={onHover}
      role="menuitem"
      type="button"
    >
      <Icon aria-hidden={true} />
      <span>{label}</span>
      {accelerator && (
        <kbd className="thread-action-menu__accelerator">{accelerator}</kbd>
      )}
      {submenu && (
        <WorkChevronRightIcon aria-hidden={true} className="is-chevron" />
      )}
    </button>
  );
}

function threadMarkdown(
  thread: NonNullable<ReturnType<typeof useSession>["current"]>,
) {
  return thread.turns
    .flatMap((turn) => turn.items)
    .flatMap((item) => {
      if (item.type === "userMessage") {
        const text = item.content
          ?.map((content) =>
            typeof content === "string" ? content : (content.text ?? ""),
          )
          .join("\n");
        return text ? [`## You\n\n${text}`] : [];
      }
      if (item.type === "agentMessage" && item.text) {
        return [`## ChatGPT\n\n${item.text}`];
      }
      return [];
    })
    .join("\n\n");
}

export function ThreadMenu({
  onOpenScheduledTask,
  onOpenSideChat,
  renameRequestId,
}: {
  onOpenScheduledTask(): void;
  onOpenSideChat(): void;
  renameRequestId: number;
}) {
  const { archiveCurrent, current, forkCurrent, renameCurrent } = useSession();
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const [pinned, setPinned] = useState(false);
  const renameDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!current) return;
    setPinned(isThreadPinned(current.id));
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey) return;
      if (event.altKey && event.code === "KeyP") {
        event.preventDefault();
        setPinned((value) => {
          const next = !value;
          setThreadPinned(current.id, next);
          return next;
        });
        return;
      }
      if (event.altKey && event.code === "KeyR") {
        event.preventDefault();
        setRenameValue(current.name || current.preview || "");
        setOpen(false);
        setRenameOpen(true);
        return;
      }
      if (event.shiftKey && event.code === "KeyA") {
        event.preventDefault();
        void archiveCurrent();
        return;
      }
      if (event.altKey && event.code === "KeyS") {
        event.preventDefault();
        onOpenSideChat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [archiveCurrent, current, onOpenSideChat]);

  useEffect(() => {
    if (!current || renameRequestId === 0) return;
    setRenameValue(current.name || current.preview || "");
    setOpen(false);
    setRenameOpen(true);
  }, [renameRequestId]);

  useEffect(() => {
    if (renameOpen) renameDialogRef.current?.focus();
  }, [renameOpen]);

  if (!current) return null;

  const dismiss = () => {
    setOpen(false);
    setSubmenu(null);
  };
  const copyText = (value: string) => {
    void navigator.clipboard?.writeText(value).catch(() => undefined);
    dismiss();
  };
  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    setThreadPinned(current.id, next);
    dismiss();
  };
  const submitRename = (event: FormEvent) => {
    event.preventDefault();
    if (!renameValue.trim()) return;
    void renameCurrent(renameValue);
    setRenameOpen(false);
  };

  return (
    <div className="thread-menu">
      <IconButton
        icon={MoreIcon}
        label="Chat actions"
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <Menu label="Chat actions" onDismiss={dismiss}>
          <ActionItem
            accelerator="⌥⌘P"
            icon={pinned ? UnpinIcon : PinIcon}
            label={pinned ? "Unpin chat" : "Pin chat"}
            onHover={() => setSubmenu(null)}
            onSelect={togglePinned}
          />
          <ActionItem
            accelerator="⌥⌘R"
            icon={RenameIcon}
            label="Rename chat"
            onHover={() => setSubmenu(null)}
            onSelect={() => {
              setRenameValue(current.name || current.preview || "");
              dismiss();
              setRenameOpen(true);
            }}
          />
          <ActionItem
            accelerator="⇧⌘A"
            icon={ArchiveIcon}
            label="Archive chat"
            onHover={() => setSubmenu(null)}
            onSelect={() => {
              dismiss();
              void archiveCurrent();
            }}
          />
          <div className="thread-action-menu__separator" role="separator" />
          <ActionItem
            accelerator="⌥⌘S"
            icon={SideChatIcon}
            label="Open side chat"
            onHover={() => setSubmenu(null)}
            onSelect={() => {
              dismiss();
              onOpenSideChat();
            }}
          />
          <ActionItem
            icon={CopyIcon}
            label="Copy"
            onHover={() => setSubmenu("copy")}
            submenu
          />
          <ActionItem
            icon={GitBranchIcon}
            label="Continue in…"
            onHover={() => setSubmenu("continue")}
            submenu
          />
          <ActionItem
            icon={ScheduledIcon}
            label="Add scheduled task…"
            onHover={() => setSubmenu(null)}
            onSelect={() => {
              dismiss();
              onOpenScheduledTask();
            }}
          />
          {submenu === "copy" && (
            <div
              aria-label="Copy"
              className="thread-action-submenu thread-action-submenu--copy"
              onMouseEnter={() => setSubmenu("copy")}
              role="menu"
            >
              <ActionItem
                accelerator="⇧⌘C"
                icon={CopyIcon}
                label="Copy working directory"
                onSelect={() => copyText(current.cwd)}
              />
              <ActionItem
                accelerator="⌥⌘C"
                icon={CopyIcon}
                label="Copy session ID"
                onSelect={() => copyText(current.id)}
              />
              <ActionItem
                accelerator="⌥⌘L"
                icon={CopyIcon}
                label="Copy deeplink"
                onSelect={() => copyText(`codex://thread/${current.id}`)}
              />
              <ActionItem
                icon={CopyIcon}
                label="Copy as Markdown"
                onSelect={() => copyText(threadMarkdown(current))}
              />
            </div>
          )}
          {submenu === "continue" && (
            <div
              aria-label="Continue in"
              className="thread-action-submenu thread-action-submenu--continue"
              onMouseEnter={() => setSubmenu("continue")}
              role="menu"
            >
              <ActionItem
                icon={WorkRunIcon}
                label="Continue in new chat"
                onSelect={() => {
                  dismiss();
                  void forkCurrent();
                }}
              />
            </div>
          )}
        </Menu>
      )}
      {renameOpen && (
        <div className="thread-rename-backdrop">
          <div
            aria-describedby="thread-rename-description"
            aria-labelledby="thread-rename-title"
            className="thread-rename-dialog"
            ref={renameDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <form onSubmit={submitRename}>
              <div className="thread-rename-dialog__copy">
                <div id="thread-rename-title">Rename chat</div>
                <div id="thread-rename-description">
                  Keep it short and recognizable
                </div>
              </div>
              <input
                aria-label="Chat title"
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="Add a title…"
                value={renameValue}
              />
              <div className="thread-rename-dialog__actions">
                <button onClick={() => setRenameOpen(false)} type="button">
                  Cancel
                </button>
                <button disabled={!renameValue.trim()} type="submit">
                  Save
                </button>
              </div>
            </form>
            <button
              className="thread-rename-dialog__close"
              onClick={() => setRenameOpen(false)}
              type="button"
            >
              <ProjectClearIcon aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
