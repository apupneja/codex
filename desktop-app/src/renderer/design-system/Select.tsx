import { Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

import { useDismissibleLayer } from "../ui/useDismissibleLayer";

export type SelectOption = { value: string; label: string };

export function Select({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissibleLayer(ref, () => setOpen(false), open);
  const selected =
    options.find((option) => option.value === value) ?? options[0];
  return (
    <div className="select-wrap" ref={ref}>
      <button
        className="select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {selected?.label}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="menu-surface select-menu" role="listbox">
          {options.map((option) => (
            <button
              className="menu-item"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.value === value ? (
                <Check size={14} />
              ) : (
                <span className="menu-spacer" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
