import { ArrowDown, ChevronDown } from "lucide-react";
import { useState } from "react";

import type { CodexController } from "../state/useCodexController";
import { Composer, type ComposerRestoreRequest } from "./Composer";
import { ConversationStatusBar } from "./ConversationStatusBar";
import { PromptQueue } from "./PromptQueue";

type ConversationComposerDockProps = {
  atBottom: boolean;
  changesOpen: boolean;
  controller: CodexController;
  deviceLabel: string;
  onOpenTerminal(): void;
  onScrollToLatest(): void;
  onShowChanges(): void;
};

export function ConversationComposerDock({
  atBottom,
  changesOpen,
  controller,
  deviceLabel,
  onOpenTerminal,
  onScrollToLatest,
  onShowChanges,
}: ConversationComposerDockProps) {
  const [restoreRequest, setRestoreRequest] = useState<
    (ComposerRestoreRequest & { queuedPromptId: string }) | null
  >(null);

  return (
    <div className="conversation-composer-wrap">
      <div className="change-actions">
        {!changesOpen ? <button onClick={onShowChanges}>Changes</button> : null}
        <button onClick={onOpenTerminal}>
          Commit &amp; Push <ChevronDown size={12} />
        </button>
        {!atBottom ? (
          <button
            aria-label="Scroll to latest message"
            className="scroll-to-latest"
            onClick={onScrollToLatest}
          >
            <ArrowDown size={14} />
          </button>
        ) : null}
      </div>
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
      <Composer
        active={Boolean(controller.activeTurn)}
        compact
        disabled={controller.runtime.phase !== "ready"}
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
        branchLabel={
          controller.activeThread?.gitInfo?.branch ?? "Current branch"
        }
        deviceLabel={deviceLabel}
        tokenPercent={controller.tokenPercent}
      />
    </div>
  );
}
