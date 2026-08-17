import { ChevronDown, Files, Globe2, Info, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";

import type { JsonValue } from "../../../shared/protocol";
import {
  type Approval,
  type ApprovalDecision,
  useSession,
} from "../../state/session";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function commandText(approval: Approval): string {
  const command = approval.params.command ?? approval.params.cmd;
  return Array.isArray(command)
    ? command.map(String).join(" ")
    : typeof command === "string"
      ? command
      : "";
}

function amendmentFor(approval: Approval): string[] | null {
  const amendment = approval.params.proposedExecpolicyAmendment;
  return Array.isArray(amendment) &&
    amendment.every((part) => typeof part === "string")
    ? amendment
    : null;
}

function approvalCopy(approval: Approval) {
  if (approval.method === "item/fileChange/requestApproval") {
    const changes = asRecord(approval.params.changes);
    const count =
      changes == null ? 1 : Math.max(1, Object.keys(changes).length);
    return {
      Icon: Files,
      identity: "Edit files",
      title: `Allow ChatGPT to edit ${count === 1 ? "the following file" : "the following files"}?`,
    };
  }

  const network = asRecord(approval.params.networkApprovalContext);
  if (network != null && typeof network.host === "string") {
    const destination =
      network.protocol === "http" || network.protocol === "https"
        ? `${network.protocol}://${network.host}`
        : network.host;
    return {
      Icon: Globe2,
      identity: "Internet access",
      title: `Allow ChatGPT to connect to ${destination}?`,
    };
  }

  const reason =
    typeof approval.params.reason === "string"
      ? approval.params.reason.trim()
      : "";
  return {
    Icon: SquareTerminal,
    identity: "Terminal",
    title: reason || "Allow ChatGPT to run this command?",
  };
}

export function ApprovalCard({ approval }: { approval: Approval }) {
  const { resolveApproval } = useSession();
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resolveApproval(approval, "decline");
      } else if (event.key === "Enter" && !optionsOpen) {
        event.preventDefault();
        resolveApproval(approval, "accept");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [approval, optionsOpen, resolveApproval]);

  const { Icon, identity, title } = approvalCopy(approval);
  const command = commandText(approval);
  const amendment = amendmentFor(approval);
  const isFileChange = approval.method === "item/fileChange/requestApproval";
  const scopedLabel = isFileChange
    ? "Allow all edits"
    : "Allow similar commands";
  const scopedDecision: ApprovalDecision = isFileChange
    ? "acceptForSession"
    : amendment == null
      ? "acceptForSession"
      : {
          acceptWithExecpolicyAmendment: {
            execpolicy_amendment: amendment,
          },
        };
  const scopeDescription = isFileChange
    ? "Allow this and future file edits in this conversation without asking again"
    : `Allow commands that start with ${amendment?.join(" ") ?? command} for this conversation`;

  const answer = (decision: ApprovalDecision) => {
    setOptionsOpen(false);
    resolveApproval(approval, decision);
  };

  return (
    <div className="approval-request-region">
      <section
        className="approval-request-card"
        data-codex-approval-surface="true"
      >
        <header className="approval-request-card__header">
          <div className="approval-request-card__identity">
            <Icon aria-hidden="true" />
            <span>{identity}</span>
          </div>
          <h2>{title}</h2>
        </header>
        {command && (
          <div className="approval-request-card__command-wrap">
            <div className="approval-request-card__command">
              <span>{command}</span>
            </div>
          </div>
        )}
        <form
          className="approval-request-card__actions"
          onSubmit={(event) => {
            event.preventDefault();
            answer("accept");
          }}
        >
          <div className="approval-request-card__action-group">
            <button
              className="approval-request-button approval-request-button--deny"
              onClick={() => answer("decline")}
              type="button"
            >
              Deny <kbd aria-hidden="true">Escape</kbd>
            </button>
            <div className="approval-request-split">
              <button
                autoFocus
                className="approval-request-button approval-request-button--approve"
                type="submit"
              >
                Allow once <kbd aria-hidden="true">⏎</kbd>
              </button>
              {(amendment != null || isFileChange) && (
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
                    onClick={() => answer(scopedDecision)}
                    role="menuitem"
                    title={scopeDescription}
                    type="button"
                  >
                    <span>{scopedLabel}</span>
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
