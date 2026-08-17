import { Check } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import type { LocalAttachment } from "../../../shared/bridge";
import type { Approval } from "../../state/session";
import { useSession } from "../../state/session";
import {
  CopyIcon,
  HandIcon,
  IdeContextIcon,
  ProjectClearIcon,
  SendIcon,
  SideChatIcon,
  StopIcon,
  SummaryAddIcon,
  WorkChevronRightIcon,
} from "../../ui/AppIcons";
import { ApprovalCard } from "../approvals/ApprovalCard";
import { McpRequestCard } from "../approvals/McpRequestCard";
import { OptionPickerCard } from "../approvals/OptionPickerCard";
import { PermissionRequestCard } from "../approvals/PermissionRequestCard";
import { SetupContextPickerCard } from "../approvals/SetupContextPickerCard";
import { UserInputCard } from "../approvals/UserInputCard";
import { ComposerPermissionsMenu } from "../composer/ComposerPermissionsMenu";

export function SideChatPanel({
  approval,
  busy,
  error,
  messages,
  onSend,
  onStop,
  onTextChange,
  text,
  title,
}: {
  approval?: Approval;
  busy?: boolean;
  error?: string;
  messages: Array<{
    id: string;
    role: "assistant" | "user";
    sentAt?: number;
    text: string;
  }>;
  onSend(message: string, attachments?: LocalAttachment[]): void;
  onStop(): void;
  onTextChange(text: string): void;
  text: string;
  title: string;
}) {
  const { permissionMode, setPermissionMode } = useSession();
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [effort, setEffort] = useState("Medium");
  const [ideContextEnabled, setIdeContextEnabled] = useState(true);
  const [menu, setMenu] = useState<
    "effort" | "model" | "modelChoice" | "permissions" | null
  >(null);
  const [model, setModel] = useState("GPT-5.2 Codex");
  const permissionsMenuId = useId();
  const send = () => {
    const message = text.trim();
    if (!message && attachments.length === 0) return;
    onSend(message, attachments);
    onTextChange("");
    setAttachments([]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    send();
  };

  return (
    <div
      aria-label={title}
      className={`side-chat-panel${messages.length > 0 ? " has-messages" : ""}`}
      role="tabpanel"
    >
      <div className="side-chat-panel__conversation">
        <div className="side-chat-panel__viewport">
          {messages.length === 0 ? (
            <div className="side-chat-panel__empty">
              <SideChatIcon aria-hidden="true" />
              <div>
                <strong>Side chat</strong>
                <span>
                  Side chats are temporary and disappear when you close the app.
                </span>
              </div>
            </div>
          ) : (
            <div className="side-chat-panel__messages">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div
                    className="side-chat-panel__user-message"
                    key={message.id}
                  >
                    <div className="side-chat-panel__message side-chat-panel__message--user">
                      {message.text}
                    </div>
                    <div className="side-chat-panel__message-actions">
                      <span>
                        {message.sentAt == null
                          ? ""
                          : new Intl.DateTimeFormat(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(message.sentAt)}
                      </span>
                      <button
                        aria-label="Copy message"
                        onClick={() =>
                          void navigator.clipboard?.writeText(message.text)
                        }
                        type="button"
                      >
                        <CopyIcon aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="side-chat-panel__message side-chat-panel__message--assistant"
                    key={message.id}
                  >
                    {message.text}
                  </div>
                ),
              )}
              {busy && (
                <div className="side-chat-panel__thinking">
                  <span>Thinking</span>
                </div>
              )}
              {error && <div className="side-chat-panel__error">{error}</div>}
            </div>
          )}
        </div>
      </div>
      {approval ? (
        approval.method === "item/tool/requestUserInput" ? (
          <UserInputCard request={approval} />
        ) : approval.method === "item/permissions/requestApproval" ? (
          <PermissionRequestCard request={approval} />
        ) : approval.method === "item/tool/requestOptionPicker" ? (
          <OptionPickerCard request={approval} />
        ) : approval.method === "item/tool/requestSetupCodexContextPicker" ? (
          <SetupContextPickerCard request={approval} />
        ) : approval.method === "mcpServer/elicitation/request" ? (
          <McpRequestCard request={approval} />
        ) : (
          <ApprovalCard approval={approval} />
        )
      ) : (
        <div className="thread-composer-region side-chat-panel__composer-region">
          <div className="composer composer--thread-dock">
            {attachments.length > 0 && (
              <div className="side-chat-panel__attachments">
                {attachments.map((attachment) => (
                  <button
                    aria-label={`Remove ${attachment.name}`}
                    key={attachment.path}
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.path !== attachment.path),
                      )
                    }
                    type="button"
                  >
                    <span>{attachment.name}</span>
                    <ProjectClearIcon aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <textarea
              aria-label="Do anything"
              onChange={(event) => onTextChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Do anything"
              rows={1}
              value={text}
            />
            <div className="codex-composer-footer">
              <div className="codex-composer-footer__left">
                <button
                  aria-label="Add files and more"
                  className="codex-composer-icon-button"
                  onClick={() =>
                    void window.chatgptDesktop
                      .selectFiles()
                      .then((items) =>
                        setAttachments((current) => [...current, ...items]),
                      )
                  }
                  type="button"
                >
                  <SummaryAddIcon aria-hidden="true" />
                </button>
                <button
                  aria-controls={
                    menu === "permissions" ? permissionsMenuId : undefined
                  }
                  aria-expanded={menu === "permissions"}
                  aria-haspopup="menu"
                  className="codex-composer-control"
                  onClick={() =>
                    setMenu((current) =>
                      current === "permissions" ? null : "permissions",
                    )
                  }
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="codex-composer-control__icon"
                  >
                    <HandIcon />
                  </span>
                  <span className="codex-composer-control__label">
                    {permissionMode === "full"
                      ? "Full access"
                      : permissionMode === "read"
                        ? "Read only"
                        : "Ask for approval"}
                  </span>
                </button>
              </div>
              <div className="codex-composer-footer__right">
                <div className="side-chat-panel__footer-controls">
                  <button
                    aria-expanded={menu === "model"}
                    aria-haspopup="menu"
                    className="codex-composer-model-trigger"
                    onClick={() =>
                      setMenu((current) =>
                        current === "model" ? null : "model",
                      )
                    }
                    type="button"
                  >
                    <span className="codex-composer-model-trigger__value">
                      <span>{model.replace("GPT-", "")}</span>
                      <span>{effort}</span>
                    </span>
                  </button>
                  {ideContextEnabled && (
                    <span className="thread-composer-context-group">
                      <span
                        aria-hidden="true"
                        className="thread-composer-context-divider"
                      />
                      <button
                        aria-label="Turn off IDE context"
                        className="thread-composer-context"
                        onClick={() => setIdeContextEnabled(false)}
                        type="button"
                      >
                        <IdeContextIcon aria-hidden="true" />
                        <span>IDE context</span>
                      </button>
                    </span>
                  )}
                </div>
                <button
                  aria-label={busy ? "Stop" : "Send"}
                  className={`composer-submit${busy ? " is-stopping" : ""}`}
                  disabled={!busy && !text.trim() && attachments.length === 0}
                  onClick={busy ? onStop : send}
                  type="button"
                >
                  {busy ? (
                    <StopIcon aria-hidden="true" />
                  ) : (
                    <SendIcon aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {menu === "permissions" && (
              <ComposerPermissionsMenu
                className="codex-permissions-menu--detailed"
                id={permissionsMenuId}
                onDismiss={() => setMenu(null)}
                onSelect={(nextMode) => {
                  setPermissionMode(nextMode);
                  setMenu(null);
                }}
                permissionMode={permissionMode}
              />
            )}
            {menu === "model" && (
              <div
                aria-label="Model and effort"
                className="codex-model-menu codex-model-menu--compact"
                role="menu"
              >
                <button
                  onClick={() => setMenu("modelChoice")}
                  role="menuitem"
                  type="button"
                >
                  <span>Model</span>
                  <small>{model}</small>
                  <WorkChevronRightIcon aria-hidden="true" />
                </button>
                <button
                  onClick={() => setMenu("effort")}
                  role="menuitem"
                  type="button"
                >
                  <span>Effort</span>
                  <small>{effort}</small>
                  <WorkChevronRightIcon aria-hidden="true" />
                </button>
              </div>
            )}
            {menu === "modelChoice" && (
              <div
                aria-label="Model"
                className="codex-model-menu codex-model-menu--choices"
                role="menu"
              >
                {["GPT-5.2 Codex", "GPT-5.1 Codex"].map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setModel(value);
                      setMenu(null);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span>{value}</span>
                    {model === value && <Check aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
            {menu === "effort" && (
              <div
                aria-label="Effort"
                className="codex-model-menu codex-model-menu--choices"
                role="menu"
              >
                {["Low", "Medium", "High"].map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setEffort(value);
                      setMenu(null);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span>{value}</span>
                    {effort === value && <Check aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
