import { Cable, ChevronDown, Info } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { type Approval, useSession } from "../../state/session";
import { GitHubIcon } from "../../ui/AppIcons";
import { McpFormElicitationCard, McpUrlActionCard } from "./McpElicitationCard";
import { OpenAIFormCard } from "./OpenAIFormCard";

type Metadata = Record<string, unknown>;
type PersistMode = "always" | "session";

function asRecord(value: unknown): Metadata | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Metadata)
    : null;
}

function titleCase(value: string): string {
  return value
    .replace(/^connector[_-]/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function persistModes(metadata: Metadata): PersistMode[] {
  const persist = metadata.persist;
  const values = Array.isArray(persist) ? persist : [persist];
  return values.filter(
    (value): value is PersistMode => value === "always" || value === "session",
  );
}

function ConnectorGlyph({ name }: { name?: string }) {
  return name?.toLocaleLowerCase() === "github" ? (
    <GitHubIcon aria-hidden="true" />
  ) : (
    <Cable aria-hidden="true" />
  );
}

function McpShortcut({ children }: { children: string }) {
  return <kbd aria-hidden="true">{children}</kbd>;
}

function useEscape(handler: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handler]);
}

function SuggestionSurface({
  connectorName,
  description,
  leadingAction,
  onDecline,
  onSubmit,
  primaryLabel,
  title,
}: {
  connectorName?: string;
  description?: string;
  leadingAction?: ReactNode;
  onDecline(): void;
  onSubmit(): void;
  primaryLabel: string;
  title: string;
}) {
  useEscape(onDecline);
  return (
    <div className="approval-request-region">
      <section
        className="mcp-suggestion-card"
        data-codex-approval-surface="true"
      >
        <div className="mcp-suggestion-card__body">
          <div className="mcp-suggestion-card__title">
            <ConnectorGlyph name={connectorName} />
            <span>{title}</span>
          </div>
          {description && (
            <div className="mcp-suggestion-card__description">
              {description}
            </div>
          )}
        </div>
        <form
          className={`mcp-suggestion-card__footer${leadingAction ? " has-leading-action" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {leadingAction && (
            <div className="mcp-suggestion-card__leading">{leadingAction}</div>
          )}
          <div className="mcp-suggestion-card__actions">
            <button
              className="mcp-suggestion-card__decline"
              onClick={onDecline}
              type="button"
            >
              <span>Not now</span>
              <kbd>Escape</kbd>
            </button>
            <button className="mcp-suggestion-card__submit" type="submit">
              <span>{primaryLabel}</span>
              <kbd>⏎</kbd>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ConnectorAuthCard({ request }: { request: Approval }) {
  const { resolveMcpElicitation } = useSession();
  const metadata = asRecord(request.params._meta) ?? {};
  const codexApps = asRecord(metadata._codex_apps);
  const failure = asRecord(codexApps?.connector_auth_failure) ?? {};
  const connectorName =
    typeof failure.connector_name === "string"
      ? failure.connector_name
      : "Connector";
  const reason = failure.auth_reason;
  const [opened, setOpened] = useState(false);
  const url = String(failure.install_url ?? request.params.url ?? "");
  const title =
    reason === "missing_link"
      ? `Connect ${connectorName}`
      : reason === "oauth_upgrade_required"
        ? `ChatGPT needs more ${connectorName} access`
        : `Reconnect ${connectorName}`;
  const description =
    reason === "missing_link"
      ? `ChatGPT needs access to ${connectorName} to help with this request`
      : reason === "oauth_upgrade_required"
        ? "Your current connection doesn't include the permissions needed for this request."
        : `Your ${connectorName} connection has expired. Reconnect it before ChatGPT can use it for this request.`;
  const initialLabel =
    reason === "missing_link"
      ? "Connect"
      : reason === "oauth_upgrade_required"
        ? "Update access"
        : "Reconnect";
  const decline = useCallback(
    () => resolveMcpElicitation(request, "decline", null),
    [request, resolveMcpElicitation],
  );
  return (
    <SuggestionSurface
      connectorName={connectorName}
      description={description}
      onDecline={decline}
      onSubmit={() => {
        if (opened) {
          resolveMcpElicitation(request, "accept", {});
          return;
        }
        setOpened(true);
        void window.chatgptDesktop.openExternal(url);
      }}
      primaryLabel={opened ? "Continue" : initialLabel}
      title={title}
    />
  );
}

function ToolSuggestionCard({ request }: { request: Approval }) {
  const { resolveMcpElicitation } = useSession();
  const metadata = asRecord(request.params._meta) ?? {};
  const toolName =
    typeof metadata.tool_name === "string" ? metadata.tool_name : "tool";
  const suggestionType = metadata.suggest_type;
  const installUrl =
    typeof metadata.install_url === "string" ? metadata.install_url : "";
  const [opened, setOpened] = useState(false);
  const [persist, setPersist] = useState(false);
  const isInstall = suggestionType === "install";
  const title = isInstall ? `Install ${toolName}?` : toolName;
  const description =
    typeof metadata.description === "string" ? metadata.description : undefined;
  const decline = useCallback(
    () => resolveMcpElicitation(request, "decline", null),
    [request, resolveMcpElicitation],
  );
  const accept = () =>
    resolveMcpElicitation(
      request,
      "accept",
      {},
      persist && metadata.persist === "always" ? { persist: "always" } : null,
    );
  const leadingAction =
    metadata.persist === "always" ? (
      <label className="mcp-suggestion-card__persist">
        <input
          checked={persist}
          onChange={(event) => setPersist(event.currentTarget.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" />
        Don't show again
      </label>
    ) : undefined;
  return (
    <SuggestionSurface
      connectorName={toolName}
      description={description}
      leadingAction={leadingAction}
      onDecline={decline}
      onSubmit={() => {
        if (!isInstall || opened || !installUrl) {
          accept();
          return;
        }
        setOpened(true);
        void window.chatgptDesktop.openExternal(installUrl);
      }}
      primaryLabel={opened ? "Continue" : isInstall ? "Install" : "Enable"}
      title={
        opened && isInstall
          ? `Click Continue when you're done ${metadata.tool_type === "plugin" ? `installing the ${toolName} plugin` : `connecting ${toolName}`}`
          : title
      }
    />
  );
}

function formatToolTitle(message: string, connectorName: string) {
  const match = /^Allow\s+.+?\s+to\s+run\s+tool\s+"([^"]+)"\?$/.exec(message);
  return match ? (
    <>
      Allow {connectorName} to run <strong>{match[1]}</strong> tool?
    </>
  ) : (
    message
  );
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

function toolParameterEntries(metadata: Metadata) {
  const params = asRecord(metadata.tool_params);
  const display = Array.isArray(metadata.tool_params_display)
    ? metadata.tool_params_display
    : null;
  if (display) {
    return display.flatMap((value) => {
      const entry = asRecord(value);
      return typeof entry?.name === "string" && "value" in entry
        ? [
            {
              label:
                typeof entry.display_name === "string"
                  ? entry.display_name
                  : typeof entry.displayName === "string"
                    ? entry.displayName
                    : titleCase(entry.name),
              name: entry.name,
              value: displayValue(entry.value),
            },
          ]
        : [];
    });
  }
  return Object.entries(params ?? {}).map(([name, value]) => ({
    label: titleCase(name),
    name,
    value: displayValue(value),
  }));
}

function McpToolApprovalCard({
  generic = false,
  request,
}: {
  generic?: boolean;
  request: Approval;
}) {
  const { resolveMcpElicitation } = useSession();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const metadata = asRecord(request.params._meta) ?? {};
  const modes = persistModes(metadata);
  const serverName = String(request.params.serverName ?? "");
  const connectorName = generic
    ? titleCase(serverName) || "Server"
    : typeof metadata.connector_name === "string"
      ? metadata.connector_name
      : titleCase(String(metadata.connector_id ?? "Connector"));
  const rawMessage = String(request.params.message ?? "").trim();
  const reason =
    typeof metadata.reason === "string" ? metadata.reason.trim() : "";
  const reasonSuffix = reason ? `Reason: ${reason}` : "";
  const cleanMessage =
    reasonSuffix && rawMessage.endsWith(reasonSuffix)
      ? rawMessage.slice(0, -reasonSuffix.length).trim()
      : rawMessage;
  const genericTitle =
    reason && /^tool call needs your approval\.?$/i.test(cleanMessage)
      ? reason
      : cleanMessage;
  const genericReason = genericTitle === reason ? "" : reason;
  const entries = useMemo(() => toolParameterEntries(metadata), [metadata]);
  const answer = useCallback(
    (action: "accept" | "decline", persist: PersistMode | null = null) => {
      setOptionsOpen(false);
      resolveMcpElicitation(
        request,
        action,
        {},
        action === "accept" && persist ? { persist } : null,
      );
    },
    [request, resolveMcpElicitation],
  );
  useEscape(() => answer("decline"));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || optionsOpen) return;
      event.preventDefault();
      answer("accept");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, optionsOpen]);

  return (
    <div className="approval-request-region">
      <section
        className="approval-request-card mcp-tool-approval-card"
        data-codex-approval-surface="true"
      >
        <header className="approval-request-card__header">
          <div className="approval-request-card__identity">
            <ConnectorGlyph name={connectorName} />
            <span>{connectorName}</span>
          </div>
          <h2>
            {generic
              ? genericTitle
              : formatToolTitle(rawMessage, connectorName)}
          </h2>
          {genericReason && <p>{genericReason}</p>}
        </header>
        {entries.length > 0 && (
          <dl className="mcp-tool-approval-card__details">
            {entries.slice(0, 4).map((entry) => (
              <div key={entry.name}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <form
          className="approval-request-card__actions mcp-tool-approval-card__actions"
          onSubmit={(event) => {
            event.preventDefault();
            answer("accept");
          }}
        >
          {modes.includes("always") && (
            <button
              className="approval-request-button approval-request-button--deny mcp-tool-approval-card__always"
              onClick={() => answer("accept", "always")}
              type="button"
            >
              Always allow
            </button>
          )}
          <div className="approval-request-card__action-group">
            <button
              className="approval-request-button approval-request-button--deny"
              onClick={() => answer("decline")}
              type="button"
            >
              Deny <McpShortcut>Escape</McpShortcut>
            </button>
            <div className="approval-request-split">
              <button
                autoFocus
                className="approval-request-button approval-request-button--approve"
                type="submit"
              >
                Allow once <McpShortcut>⏎</McpShortcut>
              </button>
              {modes.includes("session") && (
                <button
                  aria-expanded={optionsOpen}
                  aria-haspopup="menu"
                  aria-label="Approval options"
                  className="approval-request-button approval-request-button--options"
                  onClick={() => setOptionsOpen((open) => !open)}
                  type="button"
                >
                  <ChevronDown aria-hidden="true" />
                </button>
              )}
              {optionsOpen && (
                <div
                  aria-label="Approval options"
                  className="approval-request-options"
                  role="menu"
                >
                  <button
                    onClick={() => answer("accept")}
                    role="menuitem"
                    type="button"
                  >
                    Allow once
                  </button>
                  <button
                    onClick={() => answer("accept", "session")}
                    role="menuitem"
                    type="button"
                  >
                    <span>Allow in this chat</span>
                    <Info aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function isConnectorAuth(request: Approval): boolean {
  const metadata = asRecord(request.params._meta);
  const codexApps = asRecord(metadata?._codex_apps);
  const failure = asRecord(codexApps?.connector_auth_failure);
  return (
    request.params.serverName === "codex_apps" &&
    failure?.is_auth_failure === true
  );
}

function isGenericToolApproval(request: Approval, metadata: Metadata): boolean {
  const schema = asRecord(request.params.requestedSchema);
  const properties = asRecord(schema?.properties);
  const server = String(request.params.serverName ?? "");
  return (
    (server === "browser" || server === "browser-use") &&
    Object.keys(properties ?? {}).length === 0 &&
    persistModes(metadata).length > 0 &&
    typeof metadata.origin === "string" &&
    metadata.origin.trim().length > 0
  );
}

export function McpRequestCard({ request }: { request: Approval }) {
  const metadata = asRecord(request.params._meta) ?? {};
  if (request.params.mode === "openai/form") {
    return <OpenAIFormCard request={request} />;
  }
  if (request.params.mode === "url") {
    return isConnectorAuth(request) ? (
      <ConnectorAuthCard request={request} />
    ) : (
      <McpUrlActionCard request={request} />
    );
  }
  if (request.params.mode === "form") {
    if (metadata.codex_approval_kind === "tool_suggestion") {
      return <ToolSuggestionCard request={request} />;
    }
    if (metadata.codex_approval_kind === "mcp_tool_call") {
      return <McpToolApprovalCard request={request} />;
    }
    if (isGenericToolApproval(request, metadata)) {
      return <McpToolApprovalCard generic request={request} />;
    }
  }
  return <McpFormElicitationCard request={request} />;
}
