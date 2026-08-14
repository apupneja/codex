import { ArrowDown } from "lucide-react";
import { useState } from "react";

import type { CodexController } from "../state/useCodexController";
import { ActiveTurnProgress } from "./ActiveTurnProgress";
import { AuthenticationNotice } from "./AuthenticationNotice";
import { Composer, type ComposerRestoreRequest } from "./Composer";
import { ConversationStatusBar } from "./ConversationStatusBar";
import { PromptQueue } from "./PromptQueue";

type ConversationComposerDockProps = {
  atBottom: boolean;
  changesOpen: boolean;
  controller: CodexController;
  deviceLabel: string;
  onScrollToLatest(): void;
  onShowChanges(): void;
};

export function ScrollToLatestButton({
  active,
  onScrollToLatest,
}: {
  active: boolean;
  onScrollToLatest(): void;
}) {
  return (
    <button
      aria-label={
        active ? "Agent working — scroll to latest" : "Scroll to latest message"
      }
      className={`scroll-to-latest ${active ? "is-working" : ""}`}
      onClick={onScrollToLatest}
    >
      {active ? (
        <span aria-hidden="true" className="scroll-working-dots">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <ArrowDown size={14} />
      )}
    </button>
  );
}

export function ConversationComposerDock({
  atBottom,
  changesOpen,
  controller,
  deviceLabel,
  onScrollToLatest,
  onShowChanges,
}: ConversationComposerDockProps) {
  const [restoreRequest, setRestoreRequest] = useState<
    (ComposerRestoreRequest & { queuedPromptId: string }) | null
  >(null);
  const active = Boolean(controller.activeTurn);

  return (
    <div className="conversation-composer-wrap">
      <div className="change-actions">
        {!changesOpen ? <button onClick={onShowChanges}>Changes</button> : null}
        {!atBottom ? (
          <ScrollToLatestButton
            active={active}
            onScrollToLatest={onScrollToLatest}
          />
        ) : null}
      </div>
      <ActiveTurnProgress
        active={active}
        items={controller.activeTurn?.items ?? []}
        steps={controller.plan}
      />
      <PromptQueue
        canSteer={Boolean(controller.activeTurn)}
        onEdit={(prompt) =>
          setRestoreRequest({
            queuedPromptId: prompt.id,
            requestId: crypto.randomUUID(),
            submission: prompt.submission,
          })
        }
        onRemove={controller.removeQueuedPrompt}
        onSteer={controller.steerQueuedPrompt}
        prompts={controller.queuedPrompts}
      />
      {controller.requiresAuth && !controller.account ? (
        <AuthenticationNotice
          onSignIn={() => void controller.startLogin()}
          pending={controller.authLoginPending}
        />
      ) : null}
      <Composer
        active={active}
        compact
        disabled={
          controller.runtime.phase !== "ready" ||
          !controller.bootstrapped ||
          (controller.requiresAuth && !controller.account)
        }
        models={controller.models}
        onInterrupt={controller.interrupt}
        onRestoreRequestHandled={(requestId, restored) => {
          if (restoreRequest?.requestId !== requestId) return;
          if (restored) {
            controller.removeQueuedPrompt(restoreRequest.queuedPromptId);
          }
          setRestoreRequest(null);
        }}
        onSubmit={controller.submitPrompt}
        onToast={(message) => controller.addToast(message)}
        preferences={controller.preferences}
        restoreRequest={restoreRequest}
        updatePreferences={controller.updatePreferences}
      />
      <ConversationStatusBar
        active={active}
        branchLabel={
          controller.activeThread?.gitInfo?.branch ?? "Current branch"
        }
        deviceLabel={deviceLabel}
        tokenPercent={controller.tokenPercent}
      />
    </div>
  );
}
