import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { ThreadItem } from "../../shared/types";
import { MenuSurface, useDismissibleLayer } from "../design-system";
import type { PlanStep } from "../state/useCodexController";
import { summarizeThreadChanges } from "./ThreadChanges";

type ActiveTurnProgressProps = {
  active: boolean;
  items: ThreadItem[];
  steps: PlanStep[];
};

function currentStepNumber(steps: PlanStep[]): number {
  const current = steps.findIndex((step) => step.status === "inProgress");
  if (current >= 0) return current + 1;
  const completed = steps.filter((step) => step.status === "completed").length;
  return Math.min(Math.max(completed + 1, 1), steps.length);
}

export function ActiveTurnProgress({
  active,
  items,
  steps,
}: ActiveTurnProgressProps) {
  const [expanded, setExpanded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const detailsId = useId();
  const visible = active && steps.length > 0;
  useDismissibleLayer({
    active: visible && expanded,
    layerRef: container,
    onDismiss: () => setExpanded(false),
  });
  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  if (!visible) return null;

  const changes = summarizeThreadChanges(items);
  const additions = changes.reduce(
    (total, change) => total + change.additions,
    0,
  );
  const deletions = changes.reduce(
    (total, change) => total + change.deletions,
    0,
  );
  const stepNumber = currentStepNumber(steps);
  const filesLabel = `${changes.length} ${changes.length === 1 ? "file" : "files"} changed`;
  const accessibleLabel = [
    `Step ${stepNumber} of ${steps.length}`,
    changes.length ? filesLabel : null,
    changes.length ? `${additions} additions` : null,
    changes.length ? `${deletions} deletions` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="active-turn-progress"
      ref={container}
    >
      {expanded ? (
        <MenuSurface
          aria-label="Task progress details"
          className="active-turn-progress-popover"
          id={detailsId}
          role="region"
        >
          <ol className="active-turn-progress-steps">
            {steps.map((step) => (
              <li
                className={`active-turn-progress-step is-${step.status}`}
                key={step.step}
              >
                {step.status === "completed" ? (
                  <CheckCircle2 aria-hidden="true" size={15} />
                ) : step.status === "inProgress" ? (
                  <LoaderCircle aria-hidden="true" className="spin" size={15} />
                ) : (
                  <Circle aria-hidden="true" size={14} />
                )}
                <span>{step.step}</span>
              </li>
            ))}
          </ol>
        </MenuSurface>
      ) : null}
      <button
        aria-controls={detailsId}
        aria-expanded={expanded}
        aria-label={accessibleLabel}
        className="active-turn-progress-trigger"
        onClick={() => setExpanded((current) => !current)}
        title={steps[stepNumber - 1]?.step}
        type="button"
      >
        <LoaderCircle
          aria-hidden="true"
          className="active-turn-progress-spinner spin"
          size={16}
        />
        <span className="active-turn-progress-label">
          Step {stepNumber} / {steps.length}
        </span>
        {changes.length ? (
          <>
            <span aria-hidden="true" className="active-turn-progress-divider">
              ·
            </span>
            <span className="active-turn-progress-files">{filesLabel}</span>
            <b className="addition">+{additions}</b>
            <b className="deletion">−{deletions}</b>
          </>
        ) : null}
      </button>
    </div>
  );
}
