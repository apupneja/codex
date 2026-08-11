import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { useDismissibleLayer } from "./useDismissibleLayer";

export type SelectOption = {
  description?: string;
  label: string;
  value: string;
};

type SelectProps = {
  "aria-invalid"?: boolean;
  "aria-label": string;
  "className"?: string;
  "disabled"?: boolean;
  onChange(value: string): void;
  "options": SelectOption[];
  "value": string;
};

export function Select({
  "aria-invalid": ariaInvalid = false,
  "aria-label": ariaLabel,
  className = "",
  disabled = false,
  onChange,
  options,
  value,
}: SelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    setHighlightedIndex(selectedIndex);
  }, [selectedIndex]);

  useDismissibleLayer({
    active: open,
    layerRef: root,
    onDismiss: () => setOpen(false),
  });

  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [highlightedIndex, open]);

  function choose(option: SelectOption): void {
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }

  function moveHighlight(nextIndex: number): void {
    if (options.length === 0) return;
    setHighlightedIndex((nextIndex + options.length) % options.length);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled || options.length === 0) return;
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        const option = options[highlightedIndex];
        if (option) choose(option);
      } else {
        setOpen(true);
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveHighlight(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    moveHighlight(highlightedIndex + (event.key === "ArrowDown" ? 1 : -1));
  }

  return (
    <div
      className={`ui-select ${open ? "open" : ""} ${ariaInvalid ? "invalid" : ""} ${className}`.trim()}
      ref={root}
    >
      <button
        aria-activedescendant={
          open ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        className="ui-select-trigger"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        ref={trigger}
        role="combobox"
        type="button"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown aria-hidden="true" size={12} />
      </button>
      {open ? (
        <div
          aria-label={ariaLabel}
          className="ui-menu ui-select-menu"
          id={listboxId}
          role="listbox"
        >
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={`ui-menu-item ui-select-option ${index === highlightedIndex ? "highlighted" : ""}`.trim()}
              data-option-index={index}
              id={`${listboxId}-option-${index}`}
              key={option.value}
              onClick={() => choose(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              tabIndex={-1}
              type="button"
            >
              <span>
                {option.label}
                {option.description ? (
                  <small>{option.description}</small>
                ) : null}
              </span>
              <Check
                aria-hidden="true"
                className={option.value === value ? "selected" : undefined}
                size={12}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
