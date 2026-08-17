import { useEffect, useRef, useState, type FormEvent } from "react";

import type {
  HostEvent,
  Thread,
  ThreadItem,
  Turn,
} from "../../../shared/protocol";
import type { LocalAttachment } from "../../../shared/bridge";
import {
  ActiveRightPanelIcon,
  AnnotateIcon,
  BackIcon,
  BrowserIcon,
  BottomPanelIcon,
  ExpandPlanIcon,
  ExternalBrowserIcon,
  FileTabIcon,
  FilesIcon,
  ForwardIcon,
  MoreIcon,
  ProjectClearIcon,
  ReloadIcon,
  SideChatIcon,
  SpinnerIcon,
  SummaryAddIcon,
  TerminalIcon,
} from "../../ui/AppIcons";
import { IconButton } from "../../ui/IconButton";
import { useSession } from "../../state/session";
import { SideChatPanel } from "./SideChatPanel";
import { TerminalPanel } from "../terminal/TerminalPanel";

type PanelTab = "chooser" | "files" | "sideChat" | "browser" | "terminal";
type OpenPanelTab = Exclude<PanelTab, "chooser">;

type PanelTabState = {
  id: string;
  kind: OpenPanelTab;
  title: string;
};

type SideChatMessage = {
  id: string;
  role: "assistant" | "user";
  sentAt?: number;
  text: string;
};
type SideChatContent = {
  busy?: boolean;
  error?: string;
  messages: SideChatMessage[];
  text: string;
  threadId?: string;
  turnId?: string;
};
type BrowserContent = { address: string; url: string | null };

export const sideChatBusyEvent = "chatgpt:side-chat-busy-changed";

const emptySideChat: SideChatContent = { messages: [], text: "" };
const emptyBrowser: BrowserContent = { address: "", url: null };

const choices = [
  { icon: FilesIcon, label: "Files", shortcut: "⌘P", tab: "files" },
  {
    icon: SideChatIcon,
    label: "Side chat",
    shortcut: "⌥⌘S",
    tab: "sideChat",
  },
  { icon: BrowserIcon, label: "Browser", shortcut: "⌘T", tab: "browser" },
  { icon: TerminalIcon, label: "Terminal", shortcut: "", tab: "terminal" },
] as const;

export function SidePanel({
  browserRequest,
  initialTab = "chooser",
  onClose,
  onToggleBottom,
  thread,
}: {
  browserRequest?: { id: number; url: string };
  initialTab?: PanelTab;
  onClose(): void;
  onToggleBottom(): void;
  thread: Thread | null;
}) {
  const { approvals, permissionMode } = useSession();
  const projectName =
    thread?.cwd.split(/[\\/]/).filter(Boolean).pop() || "project";
  const initialTabs =
    initialTab === "chooser"
      ? []
      : [
          {
            id: `initial-${initialTab}`,
            kind: initialTab,
            title: tabTitle(initialTab, projectName),
          },
        ];
  const [tabs, setTabs] = useState<PanelTabState[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialTabs[0]?.id ?? null,
  );
  const [expanded, setExpanded] = useState(false);
  const [sideChatDirty, setSideChatDirty] = useState<Record<string, boolean>>(
    {},
  );
  const [sideChatContent, setSideChatContent] = useState<
    Record<string, SideChatContent>
  >({});
  const [browserContent, setBrowserContent] = useState<
    Record<string, BrowserContent>
  >((): Record<string, BrowserContent> => {
    if (initialTab === "browser" && browserRequest) {
      return {
        "initial-browser": {
          address: browserRequest.url,
          url: browserRequest.url,
        },
      };
    }
    return {};
  });
  const browserRequestSeen = useRef<number | null>(null);
  const [newTabMenuOpen, setNewTabMenuOpen] = useState(false);
  const [filesRetry, setFilesRetry] = useState(0);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [skipFutureCloseConfirmation, setSkipFutureCloseConfirmation] =
    useState(false);
  const tabSequence = useRef(initialTabs.length);
  const sideChatSequence = useRef(initialTab === "sideChat" ? 1 : 0);
  const sideChatTabsByThread = useRef(new Map<string, string>());
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const sideChatBusy = Object.values(sideChatContent).some(
    (content) => content.busy,
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(sideChatBusyEvent, { detail: sideChatBusy }),
    );
  }, [sideChatBusy]);

  useEffect(
    () => () => {
      window.dispatchEvent(
        new CustomEvent(sideChatBusyEvent, { detail: false }),
      );
    },
    [],
  );

  useEffect(() => {
    if (!browserRequest || browserRequestSeen.current === browserRequest.id) {
      return;
    }
    browserRequestSeen.current = browserRequest.id;
    const existing = [...tabs].reverse().find((tab) => tab.kind === "browser");
    if (existing) {
      setActiveTabId(existing.id);
      setBrowserContent((current) => ({
        ...current,
        [existing.id]: {
          address: browserRequest.url,
          url: browserRequest.url,
        },
      }));
      return;
    }
    tabSequence.current += 1;
    const id = `panel-tab-${tabSequence.current}`;
    setTabs((current) => [
      ...current,
      { id, kind: "browser", title: "New tab" },
    ]);
    setActiveTabId(id);
    setBrowserContent((current) => ({
      ...current,
      [id]: { address: browserRequest.url, url: browserRequest.url },
    }));
  }, [browserRequest, tabs]);

  useEffect(() => {
    const receive = (event: HostEvent) => {
      if (event.kind !== "notification") return;
      const threadId = String(event.params.threadId ?? "");
      const tabId = sideChatTabsByThread.current.get(threadId);
      if (!tabId) return;
      const turnId = String(event.params.turnId ?? "");
      if (event.method === "item/agentMessage/delta") {
        const itemId = String(event.params.itemId);
        const delta = String(event.params.delta ?? "");
        setSideChatContent((current) => {
          const content = current[tabId] ?? emptySideChat;
          const existing = content.messages.find(
            (message) => message.id === itemId,
          );
          return {
            ...current,
            [tabId]: {
              ...content,
              busy: true,
              messages: existing
                ? content.messages.map((message) =>
                    message.id === itemId
                      ? { ...message, text: `${message.text}${delta}` }
                      : message,
                  )
                : [
                    ...content.messages,
                    { id: itemId, role: "assistant", text: delta },
                  ],
            },
          };
        });
      } else if (event.method === "item/completed") {
        const item = event.params.item as ThreadItem;
        if (item.type !== "agentMessage") return;
        const itemId = String(item.id ?? `${turnId}-assistant`);
        const text = String(item.text ?? "");
        setSideChatContent((current) => {
          const content = current[tabId] ?? emptySideChat;
          const exists = content.messages.some(
            (message) => message.id === itemId,
          );
          return {
            ...current,
            [tabId]: {
              ...content,
              messages: exists
                ? content.messages.map((message) =>
                    message.id === itemId ? { ...message, text } : message,
                  )
                : [
                    ...content.messages,
                    { id: itemId, role: "assistant", text },
                  ],
            },
          };
        });
      } else if (event.method === "turn/completed") {
        setSideChatContent((current) => {
          const content = current[tabId] ?? emptySideChat;
          return {
            ...current,
            [tabId]: { ...content, busy: false },
          };
        });
      }
    };
    return window.chatgptDesktop.subscribe(receive);
  }, []);

  useEffect(() => {
    if (!newTabMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNewTabMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [newTabMenuOpen]);

  const openTab = (kind: OpenPanelTab) => {
    tabSequence.current += 1;
    let title = tabTitle(kind, projectName);
    if (kind === "sideChat") {
      sideChatSequence.current += 1;
      title =
        sideChatSequence.current === 1
          ? "Side chat"
          : `Side chat ${sideChatSequence.current}`;
    }
    const next = { id: `panel-tab-${tabSequence.current}`, kind, title };
    setTabs((current) => [...current, next]);
    setActiveTabId(next.id);
    setNewTabMenuOpen(false);
  };

  const closeTab = (id: string) => {
    const sideThreadId = sideChatContent[id]?.threadId;
    if (sideThreadId) {
      sideChatTabsByThread.current.delete(sideThreadId);
      void window.chatgptDesktop
        .request("thread/archive", { threadId: sideThreadId })
        .catch(() => undefined);
    }
    setTabs((current) => {
      const closingIndex = current.findIndex((tab) => tab.id === id);
      const remaining = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) {
        setActiveTabId(
          remaining[Math.min(closingIndex, remaining.length - 1)]?.id ?? null,
        );
      }
      return remaining;
    });
    setSideChatDirty((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSideChatContent((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setBrowserContent((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const sendSideChat = async (
    tabId: string,
    message: string,
    attachments: LocalAttachment[] = [],
  ) => {
    const userMessage: SideChatMessage = {
      id: `side-user-${Date.now()}`,
      role: "user",
      sentAt: Date.now(),
      text:
        message || attachments.map((attachment) => attachment.name).join(", "),
    };
    setSideChatContent((current) => {
      const content = current[tabId] ?? emptySideChat;
      return {
        ...current,
        [tabId]: {
          ...content,
          busy: true,
          error: undefined,
          messages: [...content.messages, userMessage],
          text: "",
        },
      };
    });
    setSideChatDirty((current) => ({ ...current, [tabId]: true }));
    setTabs((current) =>
      current.map((tab) =>
        tab.id === tabId ? { ...tab, title: userMessage.text } : tab,
      ),
    );

    try {
      if (!thread) throw new Error("Open a chat before starting a side chat");
      let sideThreadId = sideChatContent[tabId]?.threadId;
      if (!sideThreadId) {
        const fork = await window.chatgptDesktop.request<{ thread: Thread }>(
          "thread/fork",
          {
            cwd: thread.cwd,
            ephemeral: true,
            excludeTurns: true,
            threadId: thread.id,
          },
        );
        sideThreadId = fork.thread.id;
        sideChatTabsByThread.current.set(sideThreadId, tabId);
        setSideChatContent((current) => ({
          ...current,
          [tabId]: {
            ...(current[tabId] ?? emptySideChat),
            threadId: sideThreadId,
          },
        }));
        await window.chatgptDesktop.request("thread/inject_items", {
          items: [
            {
              content: [
                {
                  text: [
                    "This is a separate, temporary side conversation.",
                    "Treat inherited messages as reference context only and act only on requests made after this boundary.",
                    "Keep exploration lightweight and do not alter the main thread unless the user explicitly requests a scoped change here.",
                  ].join("\n\n"),
                  type: "input_text",
                },
              ],
              role: "user",
              type: "message",
            },
          ],
          threadId: sideThreadId,
        });
      }
      const result = await window.chatgptDesktop.request<{ turn: Turn }>(
        "turn/start",
        {
          approvalPolicy: permissionMode === "full" ? "never" : "on-request",
          cwd: thread.cwd,
          effort: "medium",
          input: [
            ...(message ? [{ text: message, type: "text" }] : []),
            ...attachments.map((attachment) => ({
              path: attachment.path,
              type: attachment.kind === "audio" ? "localAudio" : "localImage",
            })),
          ],
          sandboxPolicy:
            permissionMode === "full"
              ? { type: "dangerFullAccess" }
              : permissionMode === "read"
                ? { networkAccess: false, type: "readOnly" }
                : {
                    excludeSlashTmp: false,
                    excludeTmpdirEnvVar: false,
                    networkAccess: false,
                    type: "workspaceWrite",
                    writableRoots: [thread.cwd],
                  },
          threadId: sideThreadId,
        },
      );
      const completedAssistantItems = result.turn.items.filter(
        (item) => item.type === "agentMessage",
      );
      setSideChatContent((current) => {
        const content = current[tabId] ?? emptySideChat;
        const additions = completedAssistantItems.map((item, index) => ({
          id: String(item.id ?? `${result.turn.id}-assistant-${index}`),
          role: "assistant" as const,
          text: String(item.text ?? ""),
        }));
        return {
          ...current,
          [tabId]: {
            ...content,
            busy: result.turn.status === "inProgress",
            messages: [...content.messages, ...additions],
            turnId: result.turn.id,
          },
        };
      });
    } catch (reason) {
      setSideChatContent((current) => {
        const content = current[tabId] ?? emptySideChat;
        return {
          ...current,
          [tabId]: {
            ...content,
            busy: false,
            error: reason instanceof Error ? reason.message : String(reason),
          },
        };
      });
    }
  };

  const stopSideChat = (tabId: string) => {
    const content = sideChatContent[tabId] ?? emptySideChat;
    setSideChatContent((current) => ({
      ...current,
      [tabId]: { ...(current[tabId] ?? emptySideChat), busy: false },
    }));
    if (content.threadId && content.turnId) {
      void window.chatgptDesktop
        .request("turn/interrupt", {
          threadId: content.threadId,
          turnId: content.turnId,
        })
        .catch(() => undefined);
    }
  };

  const requestCloseTab = (tab: PanelTabState) => {
    if (
      tab.kind === "sideChat" &&
      sideChatDirty[tab.id] &&
      !shouldSkipSideChatCloseConfirmation()
    ) {
      setPendingCloseId(tab.id);
      return;
    }
    closeTab(tab.id);
  };

  return (
    <aside className={`side-panel${expanded ? " is-expanded" : ""}`}>
      <header className="side-panel__header">
        {tabs.length > 0 ? (
          <div
            aria-label="Side panel tabs"
            className="side-panel__tab-strip"
            role="tablist"
          >
            {tabs.map((tab) => (
              <div
                className={`side-panel__tab-item${activeTabId === tab.id ? " is-active" : ""}`}
                key={tab.id}
              >
                <button
                  aria-selected={activeTabId === tab.id}
                  className="side-panel__tab"
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setNewTabMenuOpen(false);
                  }}
                  role="tab"
                  type="button"
                >
                  {tab.kind === "files" && <FileTabIcon aria-hidden="true" />}
                  {tab.kind === "sideChat" &&
                    ((sideChatContent[tab.id] ?? emptySideChat).busy ? (
                      <span className="side-panel__tab-spinner">
                        <span>
                          <SpinnerIcon aria-hidden="true" />
                        </span>
                      </span>
                    ) : (
                      <SideChatIcon aria-hidden="true" />
                    ))}
                  {tab.kind === "browser" && <BrowserIcon aria-hidden="true" />}
                  {tab.kind === "terminal" && (
                    <TerminalIcon aria-hidden="true" />
                  )}
                  <span>{tab.title}</span>
                </button>
                <IconButton
                  icon={ProjectClearIcon}
                  label={`Close ${tab.title} tab`}
                  onClick={() => requestCloseTab(tab)}
                />
              </div>
            ))}
            <div className="side-panel__new-tab">
              <button
                aria-expanded={newTabMenuOpen}
                aria-haspopup="menu"
                className="icon-button"
                onClick={() => setNewTabMenuOpen((value) => !value)}
                title="Open side panel tab"
                type="button"
              >
                <SummaryAddIcon aria-hidden="true" />
              </button>
              {newTabMenuOpen && <PanelTabMenu onChoose={openTab} />}
            </div>
          </div>
        ) : (
          <span />
        )}
        <div className="side-panel__header-actions">
          <IconButton
            icon={ExpandPlanIcon}
            label={expanded ? "Restore panel" : "Expand panel"}
            onClick={() => setExpanded((value) => !value)}
          />
          <IconButton
            icon={BottomPanelIcon}
            label="Toggle bottom panel"
            onClick={onToggleBottom}
            shortcut="⌘J"
          />
          <IconButton
            className="is-active"
            icon={ActiveRightPanelIcon}
            label="Toggle side panel"
            onClick={onClose}
            shortcut="⌥⌘B"
          />
        </div>
      </header>
      <div className="side-panel__body">
        {tabs.length === 0 && (
          <ul className="side-panel-chooser">
            {choices.map(({ icon: Icon, label, shortcut, tab: choice }) => (
              <li key={choice}>
                <button onClick={() => openTab(choice)} type="button">
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {shortcut && <kbd>{shortcut}</kbd>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {activeTab?.kind === "files" && (
          <div
            aria-label="Open file"
            className="panel-render-error"
            key={filesRetry}
            role="tabpanel"
          >
            <strong>Tab content couldn't render</strong>
            <button
              onClick={() => setFilesRetry((value) => value + 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        )}
        {activeTab?.kind === "sideChat" && (
          <SideChatPanel
            approval={approvals.find(
              (approval) =>
                String(approval.params.threadId ?? "") ===
                (sideChatContent[activeTab.id] ?? emptySideChat).threadId,
            )}
            busy={(sideChatContent[activeTab.id] ?? emptySideChat).busy}
            error={(sideChatContent[activeTab.id] ?? emptySideChat).error}
            messages={(sideChatContent[activeTab.id] ?? emptySideChat).messages}
            onSend={(message, attachments) =>
              void sendSideChat(activeTab.id, message, attachments)
            }
            onStop={() => stopSideChat(activeTab.id)}
            onTextChange={(text) =>
              setSideChatContent((current) => ({
                ...current,
                [activeTab.id]: {
                  ...(current[activeTab.id] ?? emptySideChat),
                  text,
                },
              }))
            }
            text={(sideChatContent[activeTab.id] ?? emptySideChat).text}
            title={activeTab.title}
          />
        )}
        {activeTab?.kind === "browser" && (
          <BrowserPanel
            content={browserContent[activeTab.id] ?? emptyBrowser}
            onChange={(content) =>
              setBrowserContent((current) => ({
                ...current,
                [activeTab.id]: content,
              }))
            }
          />
        )}
        {activeTab?.kind === "terminal" && <TerminalPanel thread={thread} />}
      </div>
      {pendingCloseId && (
        <div className="side-chat-close-backdrop" role="presentation">
          <div
            aria-labelledby="side-chat-close-title"
            aria-modal="true"
            className="side-chat-close-dialog"
            role="dialog"
          >
            <h2 id="side-chat-close-title">Close side chat?</h2>
            <p>
              This side chat will be gone and can’t be recovered. Are you sure?
            </p>
            <label>
              <input
                checked={skipFutureCloseConfirmation}
                onChange={(event) =>
                  setSkipFutureCloseConfirmation(event.target.checked)
                }
                type="checkbox"
              />
              <span>Don’t ask again</span>
            </label>
            <div className="side-chat-close-dialog__actions">
              <button onClick={() => setPendingCloseId(null)} type="button">
                Cancel
              </button>
              <button
                className="is-danger"
                onClick={() => {
                  if (skipFutureCloseConfirmation) {
                    window.localStorage.setItem(
                      "skip-side-chat-close-confirmation",
                      "true",
                    );
                  }
                  closeTab(pendingCloseId);
                  setPendingCloseId(null);
                  setSkipFutureCloseConfirmation(false);
                }}
                type="button"
              >
                Close side chat
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function PanelTabMenu({ onChoose }: { onChoose(tab: OpenPanelTab): void }) {
  return (
    <div className="side-panel-tab-menu" role="menu">
      {choices.map(({ icon: Icon, label, shortcut, tab }) => (
        <button
          key={tab}
          onClick={() => onChoose(tab)}
          role="menuitem"
          type="button"
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
          {shortcut && <kbd>{shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}

function tabTitle(tab: OpenPanelTab, projectName: string) {
  if (tab === "browser") return "New tab";
  if (tab === "terminal") return projectName;
  if (tab === "sideChat") return "Side chat";
  return "Open file";
}

function shouldSkipSideChatCloseConfirmation() {
  return (
    window.localStorage.getItem("skip-side-chat-close-confirmation") === "true"
  );
}

function BrowserPanel({
  content,
  onChange,
}: {
  content: BrowserContent;
  onChange(content: BrowserContent): void;
}) {
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    const updateNavigation = () => {
      setCanGoBack(webview.canGoBack?.() ?? false);
      setCanGoForward(webview.canGoForward?.() ?? false);
    };
    const updateAddress = (event: Event) => {
      const url = "url" in event ? String(event.url) : webview.getURL?.();
      if (url && url !== "about:blank") onChange({ address: url, url });
      updateNavigation();
    };
    webview.addEventListener("dom-ready", updateNavigation);
    webview.addEventListener("did-navigate", updateAddress);
    webview.addEventListener("did-navigate-in-page", updateAddress);
    return () => {
      webview.removeEventListener("dom-ready", updateNavigation);
      webview.removeEventListener("did-navigate", updateAddress);
      webview.removeEventListener("did-navigate-in-page", updateAddress);
    };
  }, [onChange]);

  const navigate = (event: FormEvent) => {
    event.preventDefault();
    const value = content.address.trim();
    if (!value) return;
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    onChange({ address: normalized, url: normalized });
  };

  return (
    <div className="browser-panel" role="tabpanel" aria-label="New tab">
      <div className="browser-panel__toolbar">
        <IconButton
          disabled={!canGoBack}
          icon={BackIcon}
          label="Back"
          onClick={() => webviewRef.current?.goBack()}
        />
        <IconButton
          disabled={!canGoForward}
          icon={ForwardIcon}
          label="Next"
          onClick={() => webviewRef.current?.goForward()}
        />
        <IconButton
          disabled={!content.url}
          icon={ReloadIcon}
          label="Reload"
          onClick={() => webviewRef.current?.reload()}
        />
        <form className="browser-panel__address" onSubmit={navigate}>
          <input
            onChange={(event) =>
              onChange({ ...content, address: event.target.value })
            }
            placeholder="Enter a URL"
            value={content.address}
          />
          <button
            aria-label="Open in external browser"
            disabled={!content.url}
            onClick={() => {
              if (content.url) {
                void window.chatgptDesktop.openExternal(content.url);
              }
            }}
            type="button"
          >
            <ExternalBrowserIcon aria-hidden="true" />
          </button>
        </form>
        <IconButton icon={AnnotateIcon} label="Annotate" />
        <IconButton icon={MoreIcon} label="Browser options" />
      </div>
      {content.url ? (
        <webview
          className="browser-panel__frame"
          partition="persist:chatgpt-browser"
          ref={webviewRef}
          src={content.url}
        />
      ) : (
        <div className="browser-panel__empty">
          <BrowserIcon aria-hidden="true" />
          <strong>Start browsing</strong>
          <span>Enter a URL to open a page</span>
        </div>
      )}
    </div>
  );
}

export function BottomPanel({
  onClose,
  thread,
}: {
  onClose(): void;
  thread: Thread | null;
}) {
  const projectName =
    thread?.cwd.split(/[\\/]/).filter(Boolean).pop() || "project";
  const [tabs, setTabs] = useState(["terminal-1"]);
  const [activeTab, setActiveTab] = useState("terminal-1");
  const nextTerminal = useRef(1);

  const closeTerminal = (id: string) => {
    const remaining = tabs.filter((tab) => tab !== id);
    if (remaining.length === 0) {
      onClose();
      return;
    }
    setTabs(remaining);
    if (activeTab === id) setActiveTab(remaining.at(-1) ?? "");
  };

  return (
    <section className="bottom-panel">
      <header className="bottom-panel__header">
        {tabs.map((tab, index) => (
          <div className="bottom-panel__tabset" key={tab}>
            <button
              aria-selected={activeTab === tab}
              className="bottom-panel__tab"
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              <TerminalIcon aria-hidden="true" />
              <span>
                {index === 0 ? projectName : `${projectName} ${index + 1}`}
              </span>
            </button>
            <IconButton
              icon={ProjectClearIcon}
              label={`Close ${index === 0 ? projectName : `${projectName} ${index + 1}`} tab`}
              onClick={() => closeTerminal(tab)}
            />
          </div>
        ))}
        <IconButton
          icon={SummaryAddIcon}
          label="New terminal tab"
          onClick={() => {
            const id = `terminal-${++nextTerminal.current}`;
            setTabs((current) => [...current, id]);
            setActiveTab(id);
          }}
        />
        <IconButton
          icon={ProjectClearIcon}
          label="Close bottom panel"
          onClick={onClose}
        />
      </header>
      <div className="bottom-panel__body">
        <TerminalPanel key={activeTab} thread={thread} />
      </div>
    </section>
  );
}
