import { ChevronRight, FileText, X } from "lucide-react";
import { useState } from "react";

import type { ComposerContextBlock } from "../../shared/types";

export function ComposerContextCard({
  context,
  onRemove,
  onReveal,
}: {
  context: ComposerContextBlock;
  onRemove(): void;
  onReveal(): void;
}) {
  return (
    <div className="context-block-card">
      <span className="context-block-icon">
        <FileText aria-hidden="true" size={18} />
      </span>
      <span className="context-block-copy">
        <strong title={context.title}>{context.title}</strong>
        <button onClick={onReveal} type="button">
          Show in text field <ChevronRight aria-hidden="true" size={13} />
        </button>
      </span>
      <button
        aria-label={`Remove context ${context.title}`}
        className="context-block-remove"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" size={14} />
      </button>
    </div>
  );
}

export function SubmittedContextBlock({
  context,
}: {
  context: ComposerContextBlock;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="submitted-context">
      <button
        aria-expanded={expanded}
        className="submitted-context-chip"
        onClick={() => setExpanded((current) => !current)}
        title={context.title}
        type="button"
      >
        <FileText aria-hidden="true" size={12} />
        <span>{context.title}</span>
        <ChevronRight
          aria-hidden="true"
          className={expanded ? "expanded" : undefined}
          size={12}
        />
      </button>
      {expanded ? (
        <div className="submitted-context-detail">{context.text}</div>
      ) : null}
    </div>
  );
}
