import { useCallback, useEffect, useMemo, useState } from "react";

import { type Approval, useSession } from "../../state/session";

type Option = { label: string };

function pickerOptions(request: Approval): Option[] {
  return Array.isArray(request.params.options)
    ? request.params.options.flatMap((value) => {
        if (typeof value === "string") return [{ label: value }];
        if (
          value != null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof (value as Record<string, unknown>).label === "string"
        ) {
          return [{ label: String((value as Record<string, unknown>).label) }];
        }
        return [];
      })
    : [];
}

function DismissIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 21 21">
      <path
        d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function OptionPickerCard({ request }: { request: Approval }) {
  const { resolveOptionPicker } = useSession();
  const [freeform, setFreeform] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const options = useMemo(() => pickerOptions(request), [request]);
  const allowMultiple = request.params.allowMultiple === true;
  const question = String(request.params.question ?? "");
  const submitLabel =
    typeof request.params.submitLabel === "string"
      ? request.params.submitLabel
      : "Submit";
  const skipLabel =
    typeof request.params.skipLabel === "string"
      ? request.params.skipLabel
      : "Skip";
  const trimmedFreeform = freeform.trim();
  const canSubmit = selected.length > 0 || trimmedFreeform.length > 0;

  const answer = useCallback(
    (action: "dismiss" | "skip" | "submit") => {
      resolveOptionPicker(request, {
        action,
        freeformAnswer: trimmedFreeform || null,
        selectedOptions: action === "dismiss" ? [] : selected,
      });
    },
    [request, resolveOptionPicker, selected, trimmedFreeform],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      answer("dismiss");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer]);

  const toggle = (label: string) => {
    setSelected((current) =>
      current.includes(label)
        ? current.filter((value) => value !== label)
        : allowMultiple
          ? [...current, label]
          : [label],
    );
  };

  return (
    <div className="approval-request-region">
      <section className="option-picker-card">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) answer("submit");
          }}
        >
          <header className="option-picker-card__header">
            <h2>{question}</h2>
            <button
              aria-label="Dismiss"
              onClick={() => answer("dismiss")}
              type="button"
            >
              <DismissIcon />
            </button>
          </header>
          <div className="option-picker-card__options">
            {options.map((option) => {
              const checked = selected.includes(option.label);
              return (
                <button
                  aria-checked={checked}
                  className={checked ? "is-selected" : ""}
                  key={option.label}
                  onClick={() => toggle(option.label)}
                  role={allowMultiple ? "checkbox" : "radio"}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
            <input
              onChange={(event) => setFreeform(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (canSubmit) answer("submit");
                }
              }}
              placeholder="Something else"
              value={freeform}
            />
          </div>
          <footer className="option-picker-card__actions">
            <button
              className="option-picker-card__skip"
              onClick={() => answer("skip")}
              type="button"
            >
              {skipLabel}
            </button>
            <button
              className="option-picker-card__submit"
              disabled={!canSubmit}
              type="submit"
            >
              <span>{submitLabel}</span>
              <kbd aria-hidden="true">⏎</kbd>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
