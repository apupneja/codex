import {
  CornerDownRight,
  FileText,
  Image,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";

import { MenuItem, MenuSurface, useDismissibleLayer } from "../design-system";
import type { QueuedPrompt } from "../state/usePromptQueue";

type PromptQueueProps = {
  canSteer: boolean;
  onEdit(prompt: QueuedPrompt): void;
  onRemove(promptId: string): void;
  onSteer(promptId: string): Promise<boolean>;
  prompts: QueuedPrompt[];
};

function promptLabel(prompt: QueuedPrompt): string {
  const text = prompt.submission.text.trim().replace(/\s+/g, " ");
  if (text) return text;
  const context = prompt.submission.contexts[0];
  if (context) return context.title;
  const attachment = prompt.submission.attachments[0];
  return attachment?.split(/[\\/]/).pop() ?? "Queued prompt";
}

function PromptKind({ prompt }: { prompt: QueuedPrompt }) {
  if (prompt.submission.contexts.length > 0) {
    return (
      <span
        aria-label={`${prompt.submission.contexts.length} context block${prompt.submission.contexts.length === 1 ? "" : "s"}`}
        className="queued-prompt-kind"
      >
        <FileText aria-hidden="true" size={13} />
      </span>
    );
  }
  if (prompt.submission.attachments.length > 0) {
    return (
      <span
        aria-label={`${prompt.submission.attachments.length} attachment${prompt.submission.attachments.length === 1 ? "" : "s"}`}
        className="queued-prompt-kind"
      >
        <Image aria-hidden="true" size={13} />
      </span>
    );
  }
  return null;
}

function PromptQueueRow({
  canSteer,
  onEdit,
  onRemove,
  onSteer,
  prompt,
}: Omit<PromptQueueProps, "prompts"> & { prompt: QueuedPrompt }) {
  const menu = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [steering, setSteering] = useState(false);
  useDismissibleLayer({
    active: menuOpen,
    layerRef: menu,
    onDismiss: () => setMenuOpen(false),
  });

  const label = promptLabel(prompt);
  const hasKind =
    prompt.submission.contexts.length > 0 ||
    prompt.submission.attachments.length > 0;
  return (
    <div className={`queued-prompt-row ${hasKind ? "has-kind" : ""}`}>
      <CornerDownRight
        aria-hidden="true"
        className="queued-prompt-branch"
        size={15}
      />
      <PromptKind prompt={prompt} />
      <span className="queued-prompt-label" title={label}>
        {label}
      </span>
      <button
        aria-label={`Steer now: ${label}`}
        className="queued-prompt-steer"
        disabled={!canSteer || steering}
        onClick={() => {
          setSteering(true);
          void onSteer(prompt.id).finally(() => setSteering(false));
        }}
        type="button"
      >
        <CornerDownRight aria-hidden="true" size={14} />
        <span>{steering ? "Steering" : "Steer"}</span>
      </button>
      <button
        aria-label={`Remove queued prompt: ${label}`}
        className="queued-prompt-icon"
        disabled={steering}
        onClick={() => onRemove(prompt.id)}
        type="button"
      >
        <Trash2 aria-hidden="true" size={14} />
      </button>
      <div className="queued-prompt-menu-wrap" ref={menu}>
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`More options for queued prompt: ${label}`}
          className="queued-prompt-icon"
          disabled={steering}
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={15} />
        </button>
        {menuOpen ? (
          <MenuSurface
            aria-label={`Queued prompt actions: ${label}`}
            className="queued-prompt-menu"
            role="menu"
          >
            <MenuItem
              onClick={() => {
                onEdit(prompt);
                setMenuOpen(false);
              }}
              role="menuitem"
            >
              <Pencil aria-hidden="true" size={13} />
              Edit prompt
            </MenuItem>
          </MenuSurface>
        ) : null}
      </div>
    </div>
  );
}

export function PromptQueue({
  canSteer,
  onEdit,
  onRemove,
  onSteer,
  prompts,
}: PromptQueueProps) {
  if (prompts.length === 0) return null;
  return (
    <section
      aria-label={`${prompts.length} queued prompt${prompts.length === 1 ? "" : "s"}`}
      className="prompt-queue"
    >
      <div className="prompt-queue-list">
        {prompts.map((prompt) => (
          <PromptQueueRow
            canSteer={canSteer}
            key={prompt.id}
            onEdit={onEdit}
            onRemove={onRemove}
            onSteer={onSteer}
            prompt={prompt}
          />
        ))}
      </div>
    </section>
  );
}
