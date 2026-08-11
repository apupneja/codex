import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { Select } from "../../design-system";

export function useStoredSetting<T extends boolean | number | string>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(`cursor-setting:${key}`);
      return stored === null ? initialValue : (JSON.parse(stored) as T);
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    window.localStorage.setItem(`cursor-setting:${key}`, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

export function SettingsRow({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SettingsToggle({
  checked = false,
  disabled = false,
  label,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const [value, setValue] = useStoredSetting(`toggle:${label}`, checked);
  return (
    <input
      aria-label={label}
      checked={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.checked)}
      role="switch"
      type="checkbox"
    />
  );
}

export function SettingsSelect({
  label,
  options,
  value,
}: {
  label: string;
  options: string[];
  value: string;
}) {
  const [selected, setSelected] = useStoredSetting(`select:${label}`, value);
  return (
    <Select
      aria-label={label}
      onChange={setSelected}
      options={options.map((option) => ({ label: option, value: option }))}
      value={selected}
    />
  );
}

export function SettingsRange({
  defaultValue,
  label,
  max,
  min,
  outputSuffix,
}: {
  defaultValue: number;
  label: string;
  max: number;
  min: number;
  outputSuffix?: string;
}) {
  const [value, setValue] = useStoredSetting(`range:${label}`, defaultValue);
  return (
    <>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => setValue(Number(event.target.value))}
        type="range"
        value={value}
      />
      {label === "Tint hue" ? (
        <i aria-hidden="true" className="settings-hue-swatch" />
      ) : null}
      {outputSuffix === undefined ? null : (
        <output>
          {value}
          {outputSuffix}
        </output>
      )}
    </>
  );
}

export function Stepper({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange?(value: number): void;
  value: number;
}) {
  const [storedValue, setStoredValue] = useStoredSetting(
    `stepper:${label}`,
    value,
  );
  const current = onChange ? value : storedValue;
  const update = (nextValue: number) => {
    if (onChange) onChange(nextValue);
    else setStoredValue(nextValue);
  };
  return (
    <div className="settings-stepper">
      <button aria-label="Decrease" onClick={() => update(current - 1)}>
        −
      </button>
      <input
        aria-label={label}
        onChange={(event) => update(Number(event.target.value))}
        type="number"
        value={current}
      />
      <button aria-label="Increase" onClick={() => update(current + 1)}>
        +
      </button>
    </div>
  );
}
