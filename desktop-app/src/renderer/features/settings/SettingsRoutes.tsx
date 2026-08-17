import {
  Check,
  CircleAlert,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileCode2,
  Folder,
  Info,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import chromeLogo from "../../assets/chrome-logo.svg";
import {
  applyFontSmoothing,
  applyPointerCursorPreference,
  applyReducedMotionPreference,
  applyUiFontSize,
} from "../../state/appearance";
import { useSession } from "../../state/session";
import { ModeCheckIcon, SearchIcon } from "../../ui/AppIcons";
import { MarketplaceDialog } from "../skills/SkillsPage";
import {
  SettingsChevronDownIcon,
  SettingsExternalIcon,
  SettingsKeyboardIcon,
  SettingsLoadingIcon,
  SettingsCableIcon,
  SettingsPluginCreateIcon,
  SettingsPlusIcon,
  SettingsRefreshIcon,
  SettingsShortcutEditIcon,
  SettingsShortcutTrashIcon,
} from "./SettingsNavIcons";
import type { SettingsSection } from "./SettingsPage";
import { shortcutDefinitions } from "./shortcut-data";

function RouteHeader({
  actions,
  children,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  title: string;
}) {
  return (
    <header className="settings-route-header">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && (
        <div className="settings-route-header__actions">{actions}</div>
      )}
    </header>
  );
}

function RouteButton({
  ariaLabel,
  children,
  disabled = false,
  onClick,
  primary = false,
}: {
  ariaLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  onClick?(): void;
  primary?: boolean;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`settings-route-button${primary ? " is-primary" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function RoutePill({
  ariaLabel,
  buttonRef,
  children,
  onClick,
}: {
  ariaLabel?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
  onClick?(): void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="settings-route-pill"
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      {children}
    </button>
  );
}

function RouteSwitch({
  checked = false,
  disabled = false,
  label,
  onCheckedChange,
}: {
  checked?: boolean;
  disabled?: boolean;
  label?: string;
  onCheckedChange?(checked: boolean): void;
}) {
  const [active, setActive] = useState(checked);
  useEffect(() => setActive(checked), [checked]);
  return (
    <button
      aria-checked={active}
      aria-label={label}
      className="settings-route-switch"
      disabled={disabled}
      onClick={() => {
        const next = !active;
        setActive(next);
        onCheckedChange?.(next);
      }}
      role="switch"
      type="button"
    >
      <span />
    </button>
  );
}

function RouteSection({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <section className="settings-route-section">
      <div className="settings-route-section__header">
        <div>
          <strong>{title}</strong>
          {description && <span>{description}</span>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function RouteCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`settings-route-card ${className}`}>{children}</div>;
}

function RouteRow({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div className="settings-route-row">
      {icon && <div className="settings-route-row__icon">{icon}</div>}
      <div className="settings-route-row__copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      {action && <div className="settings-route-row__action">{action}</div>}
    </div>
  );
}

function ThemePreview({
  label,
  mode,
  onSelect,
  selected,
}: {
  label: string;
  mode: "dark" | "light" | "system";
  onSelect(): void;
  selected: boolean;
}) {
  return (
    <label
      className={`theme-preview theme-preview--${mode}${selected ? " is-selected" : ""}`}
    >
      <input
        aria-label={label}
        checked={selected}
        name="appearance-theme"
        onChange={onSelect}
        type="radio"
      />
      <span className="theme-preview__window">
        <ThemePreviewGraphic mode={mode} />
      </span>
      <span className="theme-preview__label">{label}</span>
    </label>
  );
}

function ThemePreviewGraphic({ mode }: { mode: "dark" | "light" | "system" }) {
  if (mode === "system") {
    return (
      <svg aria-hidden="true" viewBox="0 0 170 120">
        <defs>
          <clipPath id="theme-system-preview-sheet">
            <path d="M7 42a8 8 0 0 1 8-8h140a8 8 0 0 1 8 8v78H7V42Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#theme-system-preview-sheet)">
          <path d="M7 34h78v86H7z" fill="#f3f3f3" />
          <path d="M85 34h78v86H85z" fill="#393939" />
          <path d="M73 59h12v6H73a3 3 0 0 1 0-6Z" fill="#cdcdcd" />
          <path d="M85 59h9a3 3 0 0 1 0 6h-9Z" fill="#767676" />
          <path d="M53 68h32v3H53z" fill="#dfdfdf" />
          <path d="M85 68h32v3H85z" fill="#8f8f8f" />
          <path d="M26 84a7 7 0 0 1 7-7h52v43H26V84Z" fill="#fff" />
          <path d="M85 77h52a7 7 0 0 1 7 7v36H85V77Z" fill="#4f4f4f" />
          <path
            d="M32 88a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6H35a3 3 0 0 1-3-3Z"
            fill="#dfdfdf"
          />
          <path
            d="M103 88a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6h-29a3 3 0 0 1-3-3Z"
            fill="#767676"
          />
          <path d="M32 96h53v2H32zM26 105h59v1H26z" fill="#f3f3f3" />
          <path d="M85 96h53v2H85zM85 105h59v1H85z" fill="#767676" />
          <path
            d="M32 114a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6H35a3 3 0 0 1-3-3Z"
            fill="#dfdfdf"
          />
          <path
            d="M103 114a3 3 0 0 1 3-3h29a3 3 0 0 1 0 6h-29a3 3 0 0 1-3-3Z"
            fill="#767676"
          />
        </g>
      </svg>
    );
  }

  const topBar = mode === "light" ? "#cdcdcd" : "#9f9f9f";
  const secondBar = mode === "light" ? "#dfdfdf" : "#8f8f8f";
  return (
    <svg aria-hidden="true" viewBox="0 0 170 120">
      <path d="M49 26h72a3 3 0 0 1 0 6H49a3 3 0 0 1 0-6Z" fill={topBar} />
      <path d="M28 35h114a2 2 0 0 1 0 4H28a2 2 0 0 1 0-4Z" fill={secondBar} />
      <path d="M15 52a8 8 0 0 1 8-8h124a8 8 0 0 1 8 8v68H15V52Z" fill="#fff" />
      <path
        d="M22 59a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z"
        fill="#dfdfdf"
      />
      <path d="M22 67h65v2H22zM15 76h140v1H15z" fill="#f3f3f3" />
      <path
        d="M22 83a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z"
        fill="#dfdfdf"
      />
      <path d="M22 91h65v2H22zM15 100h140v1H15z" fill="#f3f3f3" />
      <path
        d="M22 107a3 3 0 0 1 3-3h39a3 3 0 0 1 0 6H25a3 3 0 0 1-3-3Z"
        fill="#dfdfdf"
      />
      <path d="M22 115h65v2H22z" fill="#f3f3f3" />
    </svg>
  );
}

const lightThemeRows = [
  ["Accent", "#339CFF", "accent"],
  ["Background", "#FFFFFF", "background"],
  ["Foreground", "#1A1C1F", "foreground"],
  ["UI font", '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', ""],
] as const;

const darkThemeRows = [
  ["Accent", "#339CFF", "accent"],
  ["Background", "#181818", "dark-background"],
  ["Foreground", "#FFFFFF", "dark-foreground"],
  ["UI font", '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', ""],
] as const;

const codeThemeNames = [
  "Absolutely",
  "Catppuccin",
  "Codex",
  "Everforest",
  "GitHub",
  "Gruvbox",
  "Linear",
  "Notion",
  "One",
  "Proof",
  "Raycast",
  "Rose Pine",
  "Solarized",
  "Vercel",
  "VS Code Plus",
  "Xcode",
] as const;

const dropdownBackground = "oklab(0.297161 0.0000135154 0.00000594556 / 0.9)";

function snapToDevicePixel(value: number) {
  return Math.round(value * 2) / 2;
}

function CodeThemeChoice({ mode }: { mode: "Dark" | "Light" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [value, setValue] = useState(
    () =>
      localStorage.getItem(`appearance-${mode.toLowerCase()}-code-theme`) ??
      "Codex",
  );

  const toggle = () => {
    if (!open && triggerRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect();
      const height = 328;
      const top =
        trigger.bottom + height + 2 <= window.innerHeight
          ? trigger.bottom + 2
          : Math.max(8, trigger.top - height - 2);
      setPosition({
        left: snapToDevicePixel(trigger.right - 241),
        top: snapToDevicePixel(top),
      });
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="code-theme-choice" ref={rootRef}>
      <button
        aria-label={`${mode} code theme`}
        className="settings-route-pill"
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        <b>Aa</b> {value} <SettingsChevronDownIcon />
      </button>
      {open &&
        createPortal(
          <div
            className={`code-theme-choice__menu is-${mode.toLowerCase()}`}
            ref={menuRef}
            role="menu"
            style={{ ...position, background: dropdownBackground }}
          >
            {codeThemeNames.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setValue(name);
                  localStorage.setItem(
                    `appearance-${mode.toLowerCase()}-code-theme`,
                    name,
                  );
                  setOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                <span
                  className={`code-theme-choice__preview is-${name.toLowerCase().replaceAll(" ", "-")}`}
                >
                  Aa
                </span>
                <span>{name}</span>
                {name === value && <ModeCheckIcon aria-hidden="true" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ThemeEditor({
  contrast,
  mode,
}: {
  contrast: number;
  mode: "Dark" | "Light";
}) {
  const rows = mode === "Light" ? lightThemeRows : darkThemeRows;
  const storageKey = `appearance-${mode.toLocaleLowerCase()}-theme`;
  const savedTheme = (() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "null") as {
        contrast?: number;
        fonts?: Record<string, string>;
        colors?: Record<string, string>;
        translucentSidebar?: boolean;
      } | null;
    } catch {
      return null;
    }
  })();
  const [contrastValue, setContrastValue] = useState(
    savedTheme?.contrast ?? contrast,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [translucentSidebar, setTranslucentSidebar] = useState(
    savedTheme?.translucentSidebar ?? true,
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map(([label, value, swatch]) => [
        label,
        savedTheme?.colors?.[label] ??
          savedTheme?.fonts?.[label] ??
          (swatch ? value : ""),
      ]),
    ),
  );
  const exportedTheme = JSON.stringify({
    colors: Object.fromEntries(
      rows.slice(0, 3).map(([label]) => [label, values[label]]),
    ),
    contrast: contrastValue,
    fonts: Object.fromEntries(
      rows
        .slice(3)
        .map(([label, placeholder]) => [label, values[label] || placeholder]),
    ),
    mode,
    translucentSidebar,
  });

  useEffect(() => {
    localStorage.setItem(storageKey, exportedTheme);
  }, [exportedTheme, storageKey]);

  const importIsValid = (() => {
    try {
      const parsed = JSON.parse(importValue) as Record<string, unknown>;
      return Boolean(parsed && typeof parsed === "object");
    } catch {
      return false;
    }
  })();

  const importTheme = () => {
    try {
      const parsed = JSON.parse(importValue) as {
        colors?: Record<string, string>;
        contrast?: number;
        fonts?: Record<string, string>;
        translucentSidebar?: boolean;
      };
      setValues((current) => ({
        ...current,
        ...parsed.colors,
        ...parsed.fonts,
      }));
      if (typeof parsed.contrast === "number")
        setContrastValue(Math.min(100, Math.max(0, parsed.contrast)));
      if (typeof parsed.translucentSidebar === "boolean")
        setTranslucentSidebar(parsed.translucentSidebar);
      setImportOpen(false);
      setImportValue("");
    } catch {
      // Validation keeps the import action disabled for invalid values.
    }
  };
  return (
    <>
      <RouteCard className="theme-editor">
        <div className="theme-editor__header">
          <strong>{mode} theme</strong>
          <div>
            <button
              aria-label={`Import ${mode} theme`}
              onClick={() => setImportOpen(true)}
              type="button"
            >
              Import
            </button>
            <button
              aria-label={`Copy ${mode} theme`}
              onClick={() => {
                void navigator.clipboard?.writeText(exportedTheme);
              }}
              type="button"
            >
              Copy theme
            </button>
            <CodeThemeChoice mode={mode} />
          </div>
        </div>
        {rows.map(([label, value, swatch]) => (
          <div className="theme-editor__row" key={label}>
            <strong>{label}</strong>
            <div
              className={
                swatch
                  ? `theme-editor__value is-${swatch}`
                  : "theme-editor__value"
              }
              style={swatch ? { backgroundColor: values[label] } : undefined}
            >
              {swatch && (
                <button
                  aria-label={`Choose ${mode.toLocaleLowerCase()} ${label.toLocaleLowerCase()} color`}
                  onClick={(event) => {
                    (
                      event.currentTarget
                        .nextElementSibling as HTMLElement | null
                    )?.focus();
                  }}
                  style={{ backgroundColor: values[label] }}
                  type="button"
                />
              )}
              <input
                aria-label={`${mode} ${
                  label === "Foreground"
                    ? "ink color"
                    : label === "Accent" || label === "Background"
                      ? `${label.toLocaleLowerCase()} color`
                      : label
                }`}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [label]: event.target.value,
                  }))
                }
                placeholder={swatch ? undefined : value}
                value={values[label]}
              />
            </div>
          </div>
        ))}
        <div className="theme-editor__row">
          <strong>Translucent sidebar</strong>
          <RouteSwitch
            checked={translucentSidebar}
            label={`${mode} translucent sidebar`}
            onCheckedChange={setTranslucentSidebar}
          />
        </div>
        <div className="theme-editor__row theme-editor__contrast">
          <strong>Contrast</strong>
          <div>
            <input
              aria-label={`${mode} contrast`}
              max="100"
              min="0"
              onChange={(event) => setContrastValue(event.target.valueAsNumber)}
              type="range"
              value={contrastValue}
            />
            <span>{contrastValue}</span>
          </div>
        </div>
      </RouteCard>
      {importOpen && (
        <div className="theme-import-backdrop" role="presentation">
          <section
            aria-label="Import theme"
            aria-modal="true"
            className="theme-import-dialog"
            role="dialog"
          >
            <h2>Import theme</h2>
            <input
              aria-label={`${mode} theme share string`}
              autoFocus
              onChange={(event) => setImportValue(event.target.value)}
              placeholder={exportedTheme}
              spellCheck={false}
              value={importValue}
            />
            <div>
              <RouteButton onClick={() => setImportOpen(false)}>
                Cancel
              </RouteButton>
              <RouteButton
                disabled={!importIsValid}
                onClick={importTheme}
                primary
              >
                Import theme
              </RouteButton>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ThemeDiffColumn({ kind }: { kind: "added" | "removed" }) {
  const changed: Array<[string, string]> =
    kind === "added"
      ? [
          ["surface", '"sidebar-elevated"'],
          ["accent", '"#0ea5e9"'],
          ["contrast", "68"],
        ]
      : [
          ["surface", '"sidebar"'],
          ["accent", '"#2563eb"'],
          ["contrast", "42"],
        ];
  return (
    <div className="theme-diff__column">
      <div>
        <span>1</span>
        <code>
          <b className="syntax-keyword">const</b>{" "}
          <b className="syntax-variable">themePreview</b>
          <b className="syntax-punctuation">: </b>
          <b className="syntax-type">ThemeConfig</b>{" "}
          <b className="syntax-operator">=</b>{" "}
          <b className="syntax-punctuation">{"{"}</b>
        </code>
      </div>
      {changed.map(([property, value], index) => (
        <div className={`is-${kind}`} key={property}>
          <span>{index + 2}</span>
          <code>
            {"  "}
            <b className="syntax-property">{property}</b>
            <b className="syntax-punctuation">: </b>
            <b
              className={
                value.startsWith('"') ? "syntax-string" : "syntax-number"
              }
            >
              {value}
            </b>
            <b className="syntax-punctuation">,</b>
          </code>
        </div>
      ))}
      <div>
        <span>5</span>
        <code className="syntax-punctuation">{"};"}</code>
      </div>
    </div>
  );
}

function PreferenceSegment({
  active,
  ariaLabels,
  labels,
  onChange,
}: {
  active: string;
  ariaLabels?: Record<string, string>;
  labels: string[];
  onChange(label: string): void;
}) {
  return (
    <div className="preference-segment">
      {labels.map((label) => (
        <button
          aria-label={ariaLabels?.[label] ?? label}
          className={label === active ? "is-active" : ""}
          key={label}
          onClick={() => onChange(label)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    const saved = localStorage.getItem("appearance-theme");
    return saved === "dark" || saved === "light" ? saved : "system";
  });
  const [pointerCursors, setPointerCursors] = useState(
    () => localStorage.getItem("appearance-use-pointer-cursors") === "true",
  );
  const [reduceMotion, setReduceMotion] = useState(
    () => localStorage.getItem("appearance-reduce-motion") ?? "System",
  );
  const [uiFontSize, setUiFontSize] = useState(
    () => localStorage.getItem("appearance-ui-font-size") ?? "14",
  );
  const [diffMarkers, setDiffMarkers] = useState(
    () => localStorage.getItem("appearance-diff-markers") ?? "Color",
  );
  const [fontSmoothing, setFontSmoothing] = useState(
    () => localStorage.getItem("appearance-font-smoothing") !== "false",
  );

  useEffect(() => {
    applyPointerCursorPreference(pointerCursors);
    localStorage.setItem(
      "appearance-use-pointer-cursors",
      String(pointerCursors),
    );
  }, [pointerCursors]);

  useEffect(() => {
    applyReducedMotionPreference(reduceMotion);
    localStorage.setItem("appearance-reduce-motion", reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    applyFontSmoothing(fontSmoothing);
    localStorage.setItem("appearance-font-smoothing", String(fontSmoothing));
  }, [fontSmoothing]);

  useEffect(() => {
    const parsed = Number.parseFloat(uiFontSize);
    if (!Number.isNaN(parsed)) applyUiFontSize(parsed);
  }, [uiFontSize]);

  const saveNumber = (
    value: string,
    minimum: number,
    maximum: number,
    setValue: (value: string) => void,
    key: string,
  ) => {
    const parsed = Number.parseFloat(value);
    const next = Number.isNaN(parsed)
      ? minimum
      : Math.min(maximum, Math.max(minimum, parsed));
    const serialized = String(next);
    setValue(serialized);
    localStorage.setItem(key, serialized);
  };

  return (
    <div className="settings-content settings-content--route appearance-settings">
      <RouteHeader title="Appearance" />
      <RouteSection title="Theme">
        <div className="theme-previews">
          {(["system", "light", "dark"] as const).map((mode) => (
            <ThemePreview
              key={mode}
              label={mode[0].toUpperCase() + mode.slice(1)}
              mode={mode}
              onSelect={() => {
                setTheme(mode);
                localStorage.setItem("appearance-theme", mode);
                void window.chatgptDesktop.setTheme(mode);
              }}
              selected={theme === mode}
            />
          ))}
        </div>
        <div className="theme-diff" aria-label="Code diff preview">
          <ThemeDiffColumn kind="removed" />
          <ThemeDiffColumn kind="added" />
        </div>
        <div className="theme-editors">
          <ThemeEditor contrast={45} mode="Light" />
          <ThemeEditor contrast={60} mode="Dark" />
        </div>
      </RouteSection>
      <RouteSection title="Preferences">
        <RouteCard className="appearance-preferences">
          <RouteRow
            action={
              <RouteSwitch
                checked={pointerCursors}
                label="Use pointer cursors"
                onCheckedChange={setPointerCursors}
              />
            }
            description="Change cursor to a pointer when hovering over interactive elements"
            title="Use pointer cursors"
          />
          <RouteRow
            action={
              <PreferenceSegment
                active={reduceMotion}
                labels={["System", "On", "Off"]}
                onChange={setReduceMotion}
              />
            }
            description="Reduce animations or match your system"
            title="Reduce motion"
          />
          <RouteRow
            action={
              <label className="preference-number">
                <input
                  aria-label="Sans font size"
                  max="16"
                  min="11"
                  onBlur={() =>
                    saveNumber(
                      uiFontSize,
                      11,
                      16,
                      setUiFontSize,
                      "appearance-ui-font-size",
                    )
                  }
                  onChange={(event) => setUiFontSize(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  type="number"
                  value={uiFontSize}
                />{" "}
                px
              </label>
            }
            description="Adjust the base size used for the ChatGPT UI"
            title="UI font size"
          />
          <RouteRow
            action={
              <PreferenceSegment
                active={diffMarkers}
                ariaLabels={{
                  "+/-": "Plus / minus diff markers",
                  "Color": "Color diff markers",
                }}
                labels={["Color", "+/-"]}
                onChange={(value) => {
                  setDiffMarkers(value);
                  localStorage.setItem("appearance-diff-markers", value);
                }}
              />
            }
            description="Show changes using colors or +/− markers"
            title="Diff markers"
          />
          <RouteRow
            action={
              <RouteSwitch
                checked={fontSmoothing}
                label="Font smoothing"
                onCheckedChange={setFontSmoothing}
              />
            }
            description="Use native macOS font anti-aliasing"
            title="Font smoothing"
          />
        </RouteCard>
      </RouteSection>
    </div>
  );
}

type ConfigurationValue = string | null;
type ConfigurationOption = {
  description?: string;
  label: string;
  value: ConfigurationValue;
};

const configurationFields = [
  {
    description: "Choose when ChatGPT asks for approval",
    keyPath: "approval_policy",
    options: [
      {
        description: "Always ask before taking action",
        label: "Untrusted",
        value: "untrusted",
      },
      {
        description: "Ask when escalation is requested",
        label: "On request",
        value: "on-request",
      },
      {
        description: "Blocked actions fail instead of requesting approval",
        label: "Never ask for approval",
        value: "never",
      },
    ],
    title: "Approval policy",
  },
  {
    description: "Choose how much ChatGPT can do when running commands",
    keyPath: "sandbox_mode",
    options: [
      {
        description: "Can read files, but cannot edit them",
        label: "Read only",
        value: "read-only",
      },
      {
        description: "Can edit files, but only in this workspace",
        label: "Workspace write",
        value: "workspace-write",
      },
      {
        description: "Can edit files outside this workspace",
        label: "Full access",
        value: "danger-full-access",
      },
    ],
    title: "Sandbox settings",
  },
  {
    description: "Choose how ChatGPT accesses the web",
    keyPath: "web_search",
    options: [
      {
        description: "Don't allow web search",
        label: "Disabled",
        value: "disabled",
      },
      {
        description: "Use OpenAI's maintained search index",
        label: "Cached",
        value: "cached",
      },
      {
        description: "Allow unrestricted, current web access",
        label: "Live",
        value: "live",
      },
    ],
    title: "Web search",
  },
  {
    description: "Choose how much detail ChatGPT includes in responses",
    keyPath: "model_verbosity",
    options: [
      { label: "Model default", value: null },
      {
        description: "Keep responses concise",
        label: "Low",
        value: "low",
      },
      {
        description: "Balance detail and brevity",
        label: "Medium",
        value: "medium",
      },
      {
        description: "Include more detail in responses",
        label: "High",
        value: "high",
      },
    ],
    title: "Output detail",
  },
  {
    description: "Choose how ChatGPT summarizes its reasoning",
    keyPath: "model_reasoning_summary",
    options: [
      {
        description: "Let the model choose the summary detail",
        label: "Auto",
        value: "auto",
      },
      {
        description: "Show a brief reasoning summary",
        label: "Concise",
        value: "concise",
      },
      {
        description: "Show a more detailed reasoning summary",
        label: "Detailed",
        value: "detailed",
      },
      {
        description: "Don't show reasoning summaries",
        label: "None",
        value: "none",
      },
    ],
    title: "Reasoning summary",
  },
] as const;

function ConfigurationChoice({
  ariaLabel,
  disabled,
  onChange,
  options,
  scope = false,
  value,
}: {
  ariaLabel?: string;
  disabled?: boolean;
  onChange(value: ConfigurationValue): void;
  options: readonly ConfigurationOption[];
  scope?: boolean;
  value: ConfigurationValue;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      className={`configuration-choice${scope ? " configuration-choice--scope" : ""}`}
      ref={rootRef}
    >
      <RoutePill
        ariaLabel={ariaLabel}
        onClick={() => {
          if (disabled) return;
          if (!open && triggerRef.current) {
            const trigger = triggerRef.current.getBoundingClientRect();
            const width = scope ? 240 : 360;
            setPosition({
              left: snapToDevicePixel(
                scope ? trigger.left + 1 : trigger.right - width - 1,
              ),
              top: snapToDevicePixel(trigger.bottom + 2),
            });
          }
          setOpen((current) => !current);
        }}
        buttonRef={triggerRef}
      >
        {selected?.label} <SettingsChevronDownIcon />
      </RoutePill>
      {open &&
        createPortal(
          <div
            className={`configuration-choice__menu${scope ? " configuration-choice__menu--scope" : ""}`}
            ref={menuRef}
            role="menu"
            style={{ ...position, background: dropdownBackground }}
          >
            {scope && (
              <div className="configuration-choice__section">Global config</div>
            )}
            {options.map((option) => (
              <button
                key={String(option.value)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                {option.value === value && <ModeCheckIcon aria-hidden="true" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ConfigurationSettings() {
  const [values, setValues] = useState<Record<string, ConfigurationValue>>({
    approval_policy: "on-request",
    model_reasoning_summary: "auto",
    model_verbosity: null,
    sandbox_mode: "read-only",
    web_search: "cached",
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    void window.chatgptDesktop
      .request<{ config?: Record<string, unknown> }>("config/read", {
        cwd: null,
        includeLayers: true,
      })
      .then((response) => {
        if (!current || !response.config) return;
        setValues((existing) => {
          const next = { ...existing };
          for (const field of configurationFields) {
            const value = response.config?.[field.keyPath];
            if (typeof value === "string" || value === null)
              next[field.keyPath] = value;
          }
          return next;
        });
      });
    return () => {
      current = false;
    };
  }, []);

  const save = async (keyPath: string, value: ConfigurationValue) => {
    const previous = values[keyPath];
    setValues((current) => ({ ...current, [keyPath]: value }));
    setSaving(keyPath);
    setError(undefined);
    try {
      await window.chatgptDesktop.request("config/value/write", {
        cwd: null,
        keyPath,
        mergeStrategy: "replace",
        value,
      });
    } catch {
      setValues((current) => ({ ...current, [keyPath]: previous }));
      setError(
        "Couldn't update this setting. Check config.toml for errors and try again",
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="settings-content settings-content--route settings-content--described configuration-settings">
      <RouteHeader title="Configuration">
        Configure permissions, web access, and agent responses for new chats{" "}
        <a
          href="https://developers.openai.com/codex/config-basic"
          onClick={(event) => {
            event.preventDefault();
            void window.chatgptDesktop.openExternal(event.currentTarget.href);
          }}
          rel="noreferrer"
          target="_blank"
        >
          Learn more
        </a>
      </RouteHeader>
      <RouteSection title="Agent defaults">
        <div className="configuration-toolbar">
          <ConfigurationChoice
            onChange={() => undefined}
            options={[{ label: "User config", value: "user" }]}
            scope
            value="user"
          />
          <button
            className="settings-text-action"
            onClick={() => void window.chatgptDesktop.openConfigFile()}
            type="button"
          >
            Open config.toml <SettingsExternalIcon />
          </button>
        </div>
        <RouteCard className="configuration-card">
          {configurationFields.map(
            ({ description, keyPath, options, title }) => (
              <RouteRow
                action={
                  <ConfigurationChoice
                    ariaLabel={title === "Sandbox settings" ? undefined : title}
                    disabled={saving === keyPath}
                    onChange={(value) => void save(keyPath, value)}
                    options={options}
                    value={values[keyPath]}
                  />
                }
                description={description}
                key={title}
                title={title}
              />
            ),
          )}
        </RouteCard>
        {error && (
          <p className="configuration-error" role="alert">
            {error}
          </p>
        )}
      </RouteSection>
    </div>
  );
}

function PersonalizationSettings() {
  const [customInstructions, setCustomInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { kind: "error" | "success"; text: string } | undefined
  >();
  const hasUnsavedInstructions =
    loaded && customInstructions !== savedInstructions;

  const load = async () => {
    setLoadError(false);
    setLoaded(false);
    try {
      const file = await window.chatgptDesktop.readAgentsFile();
      setCustomInstructions(file.contents);
      setSavedInstructions(file.contents);
      setLoaded(true);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!hasUnsavedInstructions || saving) return;
    setSaving(true);
    setStatus(undefined);
    try {
      await window.chatgptDesktop.writeAgentsFile(customInstructions);
      setSavedInstructions(customInstructions);
      setStatus({ kind: "success", text: "Saved agents.md" });
    } catch {
      setStatus({ kind: "error", text: "Unable to save agents.md" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s" &&
        hasUnsavedInstructions &&
        !saving
      ) {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [customInstructions, hasUnsavedInstructions, saving]);

  return (
    <div className="settings-content settings-content--route personalization-settings">
      <RouteHeader title="Personalization" />
      <RouteSection
        actions={
          <RouteButton
            disabled={!hasUnsavedInstructions || saving}
            onClick={() => void save()}
            primary={hasUnsavedInstructions}
          >
            {saving ? "Saving…" : "Save"}
          </RouteButton>
        }
        description={
          <>
            Give ChatGPT extra instructions and context for all chats on this
            host.{" "}
            <a
              href="https://developers.openai.com/codex/guides/agents-md"
              onClick={(event) => {
                event.preventDefault();
                void window.chatgptDesktop.openExternal(
                  event.currentTarget.href,
                );
              }}
              rel="noreferrer"
              target="_blank"
            >
              Learn more
            </a>
          </>
        }
        title="Custom instructions"
      >
        {loadError ? (
          <div className="personalization-load-state">
            <span>Unable to load agents.md.</span>
            <RouteButton onClick={() => void load()}>Retry</RouteButton>
          </div>
        ) : loaded ? (
          <textarea
            aria-label="Custom instructions"
            className="settings-route-textarea personalization-textarea"
            disabled={saving}
            onChange={(event) => setCustomInstructions(event.target.value)}
            placeholder="Add your custom instructions…"
            value={customInstructions}
          />
        ) : (
          <div className="personalization-load-state personalization-load-state--loading">
            <LoaderCircle aria-hidden="true" />
            <span>Loading agents.md…</span>
          </div>
        )}
        {status && (
          <div
            className={`personalization-status is-${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.text}
          </div>
        )}
        <div className="personality-warning">
          <CircleAlert aria-hidden="true" />
          Personality settings are not supported by every model. Codex&apos;s
          tone can be customized in Custom instructions.
        </div>
        <RouteCard>
          <RouteRow
            action={<PersonalityChoice />}
            description="Choose a default tone for ChatGPT responses"
            title="Personality"
          />
        </RouteCard>
      </RouteSection>
    </div>
  );
}

const personalityOptions = [
  {
    description: "Warm, collaborative, and helpful",
    label: "Friendly",
    value: "friendly",
  },
  {
    description: "Concise, task-focused, and direct",
    label: "Pragmatic",
    value: "pragmatic",
  },
] as const;

function PersonalityChoice() {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [value, setValue] = useState(
    () => localStorage.getItem("personalization-personality") ?? "friendly",
  );
  const selected =
    personalityOptions.find((option) => option.value === value) ??
    personalityOptions[0];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div className="personality-choice" ref={rootRef}>
      <RoutePill
        ariaLabel="Personality"
        onClick={() => {
          if (!open && triggerRef.current) {
            const trigger = triggerRef.current.getBoundingClientRect();
            setPosition({
              left: snapToDevicePixel(trigger.right - 269),
              top: snapToDevicePixel(trigger.bottom + 2),
            });
          }
          setOpen(!open);
        }}
        buttonRef={triggerRef}
      >
        {selected.label} <ChevronDown />
      </RoutePill>
      {open &&
        createPortal(
          <div
            className="personality-choice__menu"
            ref={menuRef}
            role="menu"
            style={{ ...position, background: dropdownBackground }}
          >
            {personalityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setValue(option.value);
                  localStorage.setItem(
                    "personalization-personality",
                    option.value,
                  );
                  setOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                {option.value === selected.value && (
                  <Check aria-hidden="true" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

const pets = [
  ["Codex", "The original Codex companion.", "codex"],
  ["Dewey", "A calm companion for focused workspace days", "dewey"],
  ["Fireball", "Hot path energy for fast iteration.", "fireball"],
  ["Hoots", "A sharp-eyed owl for polished work in a blink.", "hoots"],
  ["Rocky", "A steady rock when the diff gets large.", "rocky"],
  ["Seedy", "Small green shoots for new ideas.", "seedy"],
  ["Stacky", "A balanced stack for deep work.", "stacky"],
  ["BSOD", "A tiny blue-screen gremlin.", "bsod"],
  ["Null Signal", "Quiet signal from the void.", "null-signal"],
];

function PetsSettings({ onCreatePet }: { onCreatePet?(): void }) {
  const [selectedPet, setSelectedPet] = useState(
    () => localStorage.getItem("avatar-overlay-selected-avatar") ?? "Codex",
  );
  const [petOpen, setPetOpen] = useState(
    () => localStorage.getItem("avatar-overlay-open") === "true",
  );
  const [refreshing, setRefreshing] = useState(false);

  const selectPet = (name: string, slug: string) => {
    setSelectedPet(name);
    localStorage.setItem("avatar-overlay-selected-avatar", name);
    localStorage.setItem("avatar-overlay-selected-asset", slug);
    if (petOpen) void window.chatgptDesktop.setPetOverlay(true, slug);
  };

  const refreshPets = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await window.chatgptDesktop.listSkills();
    } finally {
      setRefreshing(false);
    }
  };

  const togglePet = () => {
    const open = !petOpen;
    const pet = pets.find(([name]) => name === selectedPet)?.[2] ?? "codex";
    setPetOpen(open);
    localStorage.setItem("avatar-overlay-open", String(open));
    void window.chatgptDesktop.setPetOverlay(open, pet);
  };

  return (
    <div className="settings-content settings-content--route">
      <RouteHeader title="Pets" />
      <RouteSection
        actions={
          <div className="pets-actions">
            <button
              aria-label="Refresh"
              className={refreshing ? "is-loading" : ""}
              disabled={refreshing}
              onClick={() => void refreshPets()}
              type="button"
            >
              <SettingsRefreshIcon />
            </button>
            <RouteButton ariaLabel="Create your own pet" onClick={onCreatePet}>
              Create
            </RouteButton>
            <RouteButton onClick={togglePet}>
              {petOpen ? "Tuck Away Pet" : "Wake Pet"}
            </RouteButton>
          </div>
        }
        description="Pets manage threads and surface what needs attention"
        title="Pick a pet"
      >
        <RouteCard className="pets-card">
          {pets.map(([name, description, slug]) => (
            <RouteRow
              action={
                <RouteButton
                  disabled={name === selectedPet}
                  onClick={() => selectPet(name, slug)}
                >
                  {name === selectedPet ? "Selected" : "Select"}
                </RouteButton>
              }
              description={description}
              icon={<span className={`pet-avatar pet-avatar--${slug}`} />}
              key={name}
              title={name}
            />
          ))}
        </RouteCard>
      </RouteSection>
    </div>
  );
}

function ShortcutBinding({
  onCapture,
  onClear,
  shortcut,
  title,
}: {
  onCapture(shortcut: string): void;
  onClear(): void;
  shortcut: string;
  title: string;
}) {
  const [capturing, setCapturing] = useState(false);

  if (capturing) {
    return (
      <div className="shortcut-capture">
        <input
          aria-label={`Shortcut capture for ${title}`}
          autoFocus
          onBlur={() => setCapturing(false)}
          onKeyDown={(event) => {
            if (event.repeat) return;
            event.preventDefault();
            event.stopPropagation();
            if (
              event.key === "Escape" &&
              !event.altKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey
            ) {
              setCapturing(false);
              return;
            }
            const captured = shortcutFromKeyboardEvent(event);
            if (captured) {
              onCapture(captured);
              setCapturing(false);
            }
          }}
          readOnly
          value="Press shortcut"
        />
        <button
          onClick={() => setCapturing(false)}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          Cancel
        </button>
      </div>
    );
  }

  const assigned = shortcut !== "Unassigned";
  return (
    <div className="shortcut-binding">
      <kbd>{shortcut}</kbd>
      <button
        aria-label={`${assigned ? "Change" : "Set"} shortcut for ${title}`}
        onClick={() => setCapturing(true)}
        type="button"
      >
        <SettingsShortcutEditIcon />
      </button>
      {assigned && (
        <button
          aria-label={`Clear shortcut for ${title}`}
          onClick={onClear}
          type="button"
        >
          <SettingsShortcutTrashIcon />
        </button>
      )}
    </div>
  );
}

function ShortcutRow({
  bindings,
  description,
  onCapture,
  onClear,
  title,
}: {
  bindings: string[];
  description: string;
  onCapture(index: number, shortcut: string): void;
  onClear(index: number): void;
  title: string;
}) {
  return (
    <div
      className="settings-route-row shortcut-row"
      data-binding-count={Math.min(bindings.length, 3)}
    >
      <div className="settings-route-row__copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="shortcut-actions">
        {bindings.map((shortcut, index) => (
          <ShortcutBinding
            key={`${title}-${shortcut}-${index}`}
            onCapture={(value) => onCapture(index, value)}
            onClear={() => onClear(index)}
            shortcut={shortcut}
            title={title}
          />
        ))}
      </div>
    </div>
  );
}

const shortcutStorageKey = "chatgpt.keyboard-shortcuts";

function defaultShortcutBindings(): Record<string, string[]> {
  return Object.fromEntries(
    shortcutDefinitions.map(([title, _description, ...bindings]) => [
      title,
      [...bindings],
    ]),
  );
}

function initialShortcutBindings(): Record<string, string[]> {
  const defaults = defaultShortcutBindings();
  try {
    const saved = JSON.parse(localStorage.getItem(shortcutStorageKey) ?? "{}");
    if (saved == null || typeof saved !== "object" || Array.isArray(saved)) {
      return defaults;
    }
    for (const [title, bindings] of Object.entries(saved)) {
      if (
        title in defaults &&
        Array.isArray(bindings) &&
        bindings.every((binding) => typeof binding === "string")
      ) {
        defaults[title] = bindings.length > 0 ? bindings : ["Unassigned"];
      }
    }
  } catch {
    // Ignore malformed local state and use the extracted defaults.
  }
  return defaults;
}

function shortcutFromKeyboardEvent(
  event: KeyboardEvent<HTMLInputElement>,
): string | null {
  if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) return null;
  const key =
    event.key === " "
      ? "Space"
      : event.key.startsWith("Arrow")
        ? event.key.slice(5)
        : event.key.length === 1
          ? event.key.toUpperCase()
          : event.key;
  return `${event.ctrlKey ? "⌃" : ""}${event.altKey ? "⌥" : ""}${event.shiftKey ? "⇧" : ""}${event.metaKey ? "⌘" : ""}${key}`;
}

function KeyboardSettings() {
  const [query, setQuery] = useState("");
  const [bindingsByTitle, setBindingsByTitle] = useState(
    initialShortcutBindings,
  );
  const updateBindings = (
    title: string,
    update: (bindings: string[]) => string[],
  ) => {
    setBindingsByTitle((current) => {
      const next = { ...current, [title]: update(current[title] ?? []) };
      localStorage.setItem(shortcutStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredShortcuts = shortcutDefinitions.filter((definition) =>
    definition.some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
  return (
    <div className="settings-content settings-content--route keyboard-settings">
      <RouteHeader title="Keyboard shortcuts" />
      <label className="shortcut-search">
        <SearchIcon />
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shortcuts"
          value={query}
        />
        <button aria-label="Search by keystrokes" type="button">
          <SettingsKeyboardIcon />
        </button>
      </label>
      <RouteCard className="shortcut-card">
        {filteredShortcuts.map(([title, description]) => (
          <ShortcutRow
            bindings={bindingsByTitle[title] ?? ["Unassigned"]}
            description={description}
            key={title}
            onCapture={(index, shortcut) =>
              updateBindings(title, (bindings) =>
                bindings.map((binding, bindingIndex) =>
                  bindingIndex === index ? shortcut : binding,
                ),
              )
            }
            onClear={(index) =>
              updateBindings(title, (bindings) => {
                const remaining = bindings.filter(
                  (_binding, bindingIndex) => bindingIndex !== index,
                );
                return remaining.length > 0 ? remaining : ["Unassigned"];
              })
            }
            title={title}
          />
        ))}
      </RouteCard>
    </div>
  );
}

function UsageSettings() {
  const open = (url: string) => void window.chatgptDesktop.openExternal(url);
  const billingUrl = "https://chatgpt.com/#settings/Billing";
  return (
    <div className="settings-content settings-content--route settings-content--described usage-settings">
      <RouteHeader title="Usage & billing">
        To view invoices, change your payment method, and take other actions,
        visit{" "}
        <a
          href={billingUrl}
          onClick={(event) => {
            event.preventDefault();
            open(billingUrl);
          }}
          rel="noreferrer"
          target="_blank"
        >
          settings on Web
        </a>
      </RouteHeader>
      <RouteSection title="Your plan">
        <RouteCard>
          <RouteRow
            action={
              <RouteButton onClick={() => open("https://chatgpt.com/pricing")}>
                View plans
              </RouteButton>
            }
            title="Pro plan"
          />
        </RouteCard>
      </RouteSection>
      <RouteSection
        description="Your remaining credits"
        title="Credits balance"
      >
        <RouteCard>
          <RouteRow
            action={
              <RouteButton
                onClick={() =>
                  open("https://chatgpt.com/settings/usage?credit_modal=true")
                }
              >
                Buy credits
              </RouteButton>
            }
            description="Current balance"
            title="Credit remaining unavailable"
          />
        </RouteCard>
      </RouteSection>
      <RouteSection title="Cancel plan">
        <p className="settings-route-note">
          Your subscription is managed through ChatGPT. Go to{" "}
          <a
            href={billingUrl}
            onClick={(event) => {
              event.preventDefault();
              open(billingUrl);
            }}
            rel="noreferrer"
            target="_blank"
          >
            billing
          </a>{" "}
          to cancel your plan
        </p>
      </RouteSection>
    </div>
  );
}

function PluginsSettings({
  onAddMcpServer,
  onBrowseDirectory,
  onCreatePlugin,
}: {
  onAddMcpServer?(): void;
  onBrowseDirectory?(): void;
  onCreatePlugin?(): void;
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node))
        setAddMenuOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [addMenuOpen]);

  return (
    <>
      <div className="settings-content settings-content--route settings-content--described plugins-settings">
        <RouteHeader
          actions={
            <>
              <RouteButton onClick={onBrowseDirectory}>
                Browse directory
              </RouteButton>
              <div className="plugins-settings__add" ref={addMenuRef}>
                <RouteButton
                  ariaLabel="Add"
                  onClick={() => setAddMenuOpen((open) => !open)}
                  primary
                >
                  Add <SettingsChevronDownIcon />
                </RouteButton>
                {addMenuOpen && (
                  <div className="plugins-settings__add-menu" role="menu">
                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        onCreatePlugin?.();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <SettingsPluginCreateIcon aria-hidden="true" />
                      <span>Create plugin</span>
                    </button>
                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        setMarketplaceOpen(true);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <SettingsPlusIcon aria-hidden="true" />
                      <span>Add a marketplace</span>
                    </button>
                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        onAddMcpServer?.();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <SettingsCableIcon aria-hidden="true" />
                      <span>Add MCP server</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          }
          title="Plugins"
        >
          Manage plugins, skills, and MCPs
        </RouteHeader>
        <div className="plugins-tools">
          <RoutePill ariaLabel="Manage extensions">
            MCPs <span>0</span>
          </RoutePill>
          <label className="plugins-search">
            <SearchIcon />
            <input placeholder="Search MCP servers" />
          </label>
        </div>
        <RouteSection title="Servers">
          <RouteCard className="plugins-empty">
            No MCP servers connected
          </RouteCard>
        </RouteSection>
      </div>
      {marketplaceOpen && (
        <MarketplaceDialog onClose={() => setMarketplaceOpen(false)} />
      )}
    </>
  );
}

function ChromeMark() {
  return (
    <span aria-hidden="true" className="chrome-mark">
      <img alt="" draggable={false} src={chromeLogo} />
      <svg fill="none" viewBox="0 0 24 24">
        <path
          d="M9 3H19C20.1046 3 21 3.89543 21 5V16C21 17.1046 20.1046 18 19 18H15V19C15 20.6569 13.6569 22 12 22C10.3431 22 9 20.6569 9 19V18H5C3.89543 18 3 17.1046 3 16V13H4C5.65685 13 7 11.6569 7 10C7 8.34315 5.65685 7 4 7H3V5C3 3.89543 3.89543 3 5 3H9Z"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}

function BrowserMark() {
  return (
    <svg
      aria-hidden="true"
      className="browser-mark"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        clipRule="evenodd"
        d="M9.62561 8.79541L9.77112 8.82764L14.1774 10.1499C15.1066 10.4288 15.1641 11.7231 14.2633 12.0835L12.4684 12.8013L11.7506 14.5962C11.3903 15.4971 10.096 15.4395 9.81702 14.5103L8.49475 10.104C8.27544 9.37127 8.90238 8.68518 9.62561 8.79541ZM10.8014 14.1382L11.4977 12.4009L11.5416 12.3062C11.6544 12.0911 11.8405 11.9217 12.068 11.8306L13.8053 11.1343L9.51331 9.84619L10.8014 14.1382Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        d="M9.93323 2.14111C10.6945 2.14111 11.297 2.14156 11.7819 2.18115C12.2729 2.22127 12.6895 2.30471 13.0699 2.49854C13.6861 2.81247 14.1876 3.3131 14.5016 3.9292C14.6954 4.3096 14.7788 4.72637 14.819 5.21729C14.8586 5.70219 14.858 6.30549 14.858 7.06689V7.6665C14.858 7.95634 14.6234 8.19172 14.3336 8.19189C14.0437 8.19189 13.8082 7.95645 13.8082 7.6665V7.06689C13.8082 6.28823 13.8074 5.73544 13.7721 5.30322C13.7373 4.87739 13.6718 4.61446 13.566 4.40674C13.3527 3.98808 13.012 3.6474 12.5934 3.43408C12.3856 3.32822 12.1229 3.26187 11.6969 3.22705C11.2647 3.19174 10.712 3.19189 9.93323 3.19189H6.06702C5.28839 3.19189 4.73555 3.19175 4.30334 3.22705C3.87742 3.26185 3.6146 3.32829 3.40686 3.43408C2.9882 3.6474 2.64752 3.98808 2.4342 4.40674C2.32841 4.61448 2.26197 4.8773 2.22717 5.30322C2.19187 5.73543 2.19202 6.28826 2.19202 7.06689V8.99951C2.19202 9.74646 2.19168 10.2767 2.22424 10.6919C2.25636 11.1013 2.31809 11.3543 2.41565 11.5552C2.63356 12.0038 2.99542 12.3665 3.44397 12.5845C3.64482 12.682 3.89884 12.7428 4.30823 12.7749C4.72328 12.8074 5.25301 12.8081 5.99963 12.8081C6.28958 12.8081 6.52502 13.0435 6.52502 13.3335C6.52485 13.6233 6.28947 13.8579 5.99963 13.8579C5.26963 13.8579 4.69181 13.8583 4.2262 13.8218C3.75478 13.7848 3.35407 13.7076 2.98596 13.5288C2.32548 13.208 1.79118 12.6746 1.47034 12.0142C1.29156 11.6461 1.21435 11.2454 1.17737 10.7739C1.14084 10.3082 1.14124 9.72981 1.14124 8.99951V7.06689C1.14124 6.30548 1.14166 5.70219 1.18127 5.21729C1.2214 4.72638 1.30484 4.30959 1.49866 3.9292C1.81259 3.3133 2.31342 2.81246 2.92932 2.49854C3.30972 2.30471 3.72651 2.22128 4.21741 2.18115C4.70231 2.14153 5.30561 2.14111 6.06702 2.14111H9.93323Z"
        fill="currentColor"
      />
      <path
        d="M5.13803 4.65356C5.51358 4.65356 5.81772 4.9577 5.81772 5.33325C5.81771 5.7088 5.51358 6.01294 5.13803 6.01294C4.76259 6.01281 4.45835 5.70872 4.45834 5.33325C4.45834 4.95778 4.76258 4.65369 5.13803 4.65356Z"
        fill="currentColor"
      />
      <path
        d="M10.6667 4.7994C10.9612 4.7994 11.2005 5.0387 11.2005 5.33325C11.2005 5.6278 10.9612 5.86711 10.6667 5.86711H8.00001C7.70546 5.86711 7.46616 5.6278 7.46616 5.33325C7.46616 5.0387 7.70546 4.7994 8.00001 4.7994H10.6667Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsRouteChoice({
  onChange,
  options,
  value,
}: {
  onChange(value: string): void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open]);

  return (
    <div className="settings-route-choice" ref={rootRef}>
      <RoutePill onClick={() => setOpen((current) => !current)}>
        {selected.label} <ChevronDown />
      </RoutePill>
      {open && (
        <div
          className="settings-route-choice__menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          role="menu"
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="menuitemradio"
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type BrowserSubpage =
  | "contactInfo"
  | "downloadHistory"
  | "passwordManager"
  | "siteSettings";

const browserSubpageTitles: Record<BrowserSubpage, string> = {
  contactInfo: "Contact info",
  downloadHistory: "Download history",
  passwordManager: "Password manager",
  siteSettings: "Site settings",
};

function BrowserSettingsSubpage({
  onBack,
  page,
}: {
  onBack(): void;
  page: BrowserSubpage;
}) {
  if (page === "downloadHistory") {
    return (
      <div className="settings-error settings-error--overlay">
        <Info aria-hidden="true" className="settings-error__icon" />
        Oops, an error has occurred
        <div>
          <button
            onClick={() => void window.chatgptDesktop.installUpdate()}
            type="button"
          >
            <Download aria-hidden="true" /> Update ChatGPT
          </button>
          <button onClick={onBack} type="button">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const title = browserSubpageTitles[page];
  return (
    <div className="browser-settings-subpage">
      <nav aria-label="Breadcrumb" className="browser-settings-breadcrumb">
        <button aria-label="Back" onClick={onBack} type="button">
          <ChevronLeft />
        </button>
        <button onClick={onBack} type="button">
          Settings
        </button>
        <ChevronRight />
        <button onClick={onBack} type="button">
          Browser
        </button>
        <ChevronRight />
        <strong>{title}</strong>
      </nav>
    </div>
  );
}

function BrowserImportDialog({ onClose }: { onClose(): void }) {
  return (
    <div
      className="browser-import-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        aria-labelledby="browser-import-title"
        className="browser-import-dialog"
        role="dialog"
        style={{ background: dropdownBackground }}
      >
        <button
          aria-label="Close"
          className="browser-import-dialog__close"
          onClick={onClose}
          type="button"
        >
          <X />
        </button>
        <h2 id="browser-import-title">Import from your browser</h2>
        <p>Choose data to bring over to the built-in browser</p>
        <label>
          <span>From</span>
          <button disabled type="button">
            No profiles found <ChevronDown />
          </button>
        </label>
        <footer>
          <RouteButton onClick={onClose}>Cancel</RouteButton>
          <RouteButton disabled primary>
            Import
          </RouteButton>
        </footer>
      </div>
    </div>
  );
}

function BrowserSettings() {
  const [subpage, setSubpage] = useState<BrowserSubpage | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [webTarget, setWebTarget] = useState(
    () =>
      localStorage.getItem("open-link-in-target-preference") ??
      "external-browser",
  );
  const [localTarget, setLocalTarget] = useState(
    () =>
      localStorage.getItem("open-local-url-in-target-preference") ??
      "in-app-browser",
  );
  const [annotationMode, setAnnotationMode] = useState(
    () =>
      localStorage.getItem("browser-annotation-screenshots-mode") ?? "always",
  );
  const [downloadDirectory, setDownloadDirectory] = useState(() =>
    localStorage.getItem("browser-download-directory"),
  );
  const [downloadPrompt, setDownloadPrompt] = useState(
    () => localStorage.getItem("browser-download-prompt-enabled") === "true",
  );
  const targets = [
    { label: "ChatGPT", value: "in-app-browser" },
    { label: "Default browser", value: "external-browser" },
  ];

  const changeDownloadDirectory = async () => {
    const directory = await window.chatgptDesktop.selectFolder();
    if (!directory) return;
    setDownloadDirectory(directory);
    localStorage.setItem("browser-download-directory", directory);
    await window.chatgptDesktop.setBrowserDownloadDirectory(directory);
  };

  if (subpage) {
    return (
      <BrowserSettingsSubpage onBack={() => setSubpage(null)} page={subpage} />
    );
  }
  return (
    <div className="settings-content settings-content--route browser-settings">
      <RouteHeader title="Browser" />
      <RouteCard className="integration-status">
        <RouteRow
          icon={<BrowserMark />}
          action={<RouteSwitch disabled label="Unavailable plugin toggle" />}
          description="Disabled by your organization or unavailable in your region"
          title="Browser"
        />
      </RouteCard>
      <RouteSection
        actions={
          <RouteButton onClick={() => setImportOpen(true)}>Import…</RouteButton>
        }
        title="General"
      >
        <RouteCard>
          <RouteRow
            action={
              <SettingsRouteChoice
                onChange={(value) => {
                  setWebTarget(value);
                  localStorage.setItem("open-link-in-target-preference", value);
                }}
                options={targets}
                value={webTarget}
              />
            }
            description="Where links open by default"
            title="Web URL and link open destination"
          />
          <RouteRow
            action={
              <SettingsRouteChoice
                onChange={(value) => {
                  setLocalTarget(value);
                  localStorage.setItem(
                    "open-local-url-in-target-preference",
                    value,
                  );
                }}
                options={targets}
                value={localTarget}
              />
            }
            description="Where local development sites open by default"
            title="Local URL open destination"
          />
          <RouteRow
            action={
              <RouteButton
                onClick={() =>
                  void window.chatgptDesktop.clearBrowserData([
                    "cookies",
                    "siteData",
                    "cache",
                    "downloads",
                    "history",
                  ])
                }
              >
                Clear browsing data
              </RouteButton>
            }
            description="Clear browsing history, site data, cache, and download history from the in-app browser"
            title="Browsing data"
          />
          <RouteRow
            action={
              <SettingsRouteChoice
                onChange={(value) => {
                  setAnnotationMode(value);
                  localStorage.setItem(
                    "browser-annotation-screenshots-mode",
                    value,
                  );
                }}
                options={[
                  { label: "Always include", value: "always" },
                  { label: "Only on drag selection", value: "necessary" },
                ]}
                value={annotationMode}
              />
            }
            description="Screenshots help ChatGPT better understand and address comments, but increase plan usage"
            title="Annotation screenshots"
          />
        </RouteCard>
      </RouteSection>
      <RouteSection title="Autofill and passwords">
        <RouteCard>
          <RouteRow
            action={
              <RouteButton onClick={() => setSubpage("passwordManager")}>
                Manage
              </RouteButton>
            }
            description="Add, delete, and edit saved passwords"
            title="Password manager"
          />
          <RouteRow
            action={
              <RouteButton onClick={() => setSubpage("contactInfo")}>
                Manage
              </RouteButton>
            }
            description="Add, delete, and edit saved addresses, phone numbers, and email addresses"
            title="Contact info"
          />
        </RouteCard>
      </RouteSection>
      <RouteSection title="Downloads">
        <RouteCard>
          <RouteRow
            action={
              <RouteButton onClick={() => void changeDownloadDirectory()}>
                Change
              </RouteButton>
            }
            description={downloadDirectory ?? "System Downloads folder"}
            title="Location"
          />
          <RouteRow
            action={
              <RouteSwitch
                checked={downloadPrompt}
                label="Ask where to save downloads"
                onCheckedChange={(enabled) => {
                  setDownloadPrompt(enabled);
                  localStorage.setItem(
                    "browser-download-prompt-enabled",
                    String(enabled),
                  );
                  void window.chatgptDesktop.setBrowserDownloadPrompt(enabled);
                }}
              />
            }
            description="Show a save dialog for downloads you start in the built-in browser"
            title="Ask where to save downloads"
          />
          <RouteRow
            action={
              <RouteButton
                ariaLabel="Manage download history"
                onClick={() => setSubpage("downloadHistory")}
              >
                Manage
              </RouteButton>
            }
            description="View and manage files downloaded from the built-in browser"
            title="Download history"
          />
        </RouteCard>
      </RouteSection>
      <RouteSection title="Permissions">
        <RouteCard>
          <RouteRow
            action={
              <RouteButton onClick={() => setSubpage("siteSettings")}>
                Manage
              </RouteButton>
            }
            description="Control camera and microphone permissions in the built-in browser"
            title="Site settings"
          />
        </RouteCard>
      </RouteSection>
      {importOpen && (
        <BrowserImportDialog onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

function ComputerUseSettings() {
  return (
    <div className="settings-content settings-content--route settings-content--described">
      <RouteHeader title="Computer use">
        Manage how ChatGPT uses other applications on your computer
      </RouteHeader>
      <RouteSection title="Control">
        <RouteCard className="integration-status">
          <RouteRow
            icon={<ChromeMark />}
            action={<RouteSwitch disabled />}
            description="Disabled by your organization or unavailable in your region"
            title="Google Chrome"
          />
        </RouteCard>
      </RouteSection>
    </div>
  );
}

function HooksSettings() {
  const [reloading, setReloading] = useState(false);
  const reload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await window.chatgptDesktop.request("config/read", {
        cwd: null,
        includeLayers: true,
      });
    } finally {
      setReloading(false);
    }
  };
  return (
    <div className="settings-content settings-content--route settings-content--described hooks-settings">
      <RouteHeader
        actions={
          <button
            aria-label="Reload hooks"
            className={`settings-icon-button${reloading ? " is-loading" : ""}`}
            disabled={reloading}
            onClick={() => void reload()}
            type="button"
          >
            <SettingsRefreshIcon />
          </button>
        }
        title="Hooks"
      >
        Manage lifecycle hooks from config and enabled plugins.{" "}
        <a
          href="https://developers.openai.com/codex/hooks"
          onClick={(event) => {
            event.preventDefault();
            void window.chatgptDesktop.openExternal(event.currentTarget.href);
          }}
          rel="noreferrer"
          target="_blank"
        >
          Learn more
        </a>
      </RouteHeader>
      <RouteCard className="hooks-empty">
        <RouteRow
          description="Configured hooks will appear here"
          title="No hooks found"
        />
      </RouteCard>
    </div>
  );
}

function GitSettings() {
  const [branchPrefix, setBranchPrefix] = useState(
    () => localStorage.getItem("git-branch-prefix") ?? "codex/",
  );
  const initialCommitInstructions =
    localStorage.getItem("git-commit-instructions") ?? "";
  const initialPullRequestInstructions =
    localStorage.getItem("git-pr-instructions") ?? "";
  const [commitInstructions, setCommitInstructions] = useState(
    initialCommitInstructions,
  );
  const [savedCommitInstructions, setSavedCommitInstructions] = useState(
    initialCommitInstructions,
  );
  const [pullRequestInstructions, setPullRequestInstructions] = useState(
    initialPullRequestInstructions,
  );
  const [savedPullRequestInstructions, setSavedPullRequestInstructions] =
    useState(initialPullRequestInstructions);
  const [reviewDelivery, setReviewDelivery] = useState<"Detached" | "Inline">(
    () =>
      localStorage.getItem("reviewDelivery") === "detached"
        ? "Detached"
        : "Inline",
  );
  return (
    <div className="settings-content settings-content--route git-settings">
      <RouteHeader title="Git" />
      <RouteCard>
        <RouteRow
          action={
            <input
              aria-label="Branch prefix"
              className="settings-inline-input"
              onBlur={() =>
                localStorage.setItem("git-branch-prefix", branchPrefix)
              }
              onChange={(event) => setBranchPrefix(event.target.value)}
              placeholder="codex/"
              value={branchPrefix}
            />
          }
          description="Prefix used when ChatGPT creates new branches"
          title="Branch prefix"
        />
        <RouteRow
          action={
            <RouteSwitch
              checked={localStorage.getItem("git-always-force-push") === "true"}
              label="Always force push"
              onCheckedChange={(checked) =>
                localStorage.setItem("git-always-force-push", String(checked))
              }
            />
          }
          description="Use --force-with-lease when pushing from ChatGPT"
          title="Always force push"
        />
        <RouteRow
          action={
            <RouteSwitch
              checked={
                localStorage.getItem("git-create-pull-request-as-draft") !==
                "false"
              }
              label="Create draft pull requests"
              onCheckedChange={(checked) =>
                localStorage.setItem(
                  "git-create-pull-request-as-draft",
                  String(checked),
                )
              }
            />
          }
          description="Use draft pull requests by default when creating PRs from ChatGPT"
          title="Create draft pull requests"
        />
        <RouteRow
          action={
            <div className="review-delivery">
              {(["Inline", "Detached"] as const).map((value) => (
                <button
                  aria-pressed={reviewDelivery === value}
                  className={reviewDelivery === value ? "is-active" : ""}
                  key={value}
                  onClick={() => {
                    setReviewDelivery(value);
                    localStorage.setItem("reviewDelivery", value.toLowerCase());
                  }}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          }
          description="Start /review in the current chat when possible or launch a separate review chat"
          title="Review delivery"
        />
      </RouteCard>
      <RouteSection
        actions={
          <RouteButton
            disabled={commitInstructions === savedCommitInstructions}
            onClick={() => {
              setSavedCommitInstructions(commitInstructions);
              localStorage.setItem(
                "git-commit-instructions",
                commitInstructions,
              );
            }}
          >
            Save
          </RouteButton>
        }
        description="Added to commit message generation prompts"
        title="Commit instructions"
      >
        <textarea
          aria-label="Commit instructions"
          className="settings-route-textarea git-textarea"
          onChange={(event) => setCommitInstructions(event.target.value)}
          placeholder="Add commit message guidance…"
          value={commitInstructions}
        />
      </RouteSection>
      <RouteSection
        actions={
          <RouteButton
            disabled={pullRequestInstructions === savedPullRequestInstructions}
            onClick={() => {
              setSavedPullRequestInstructions(pullRequestInstructions);
              localStorage.setItem(
                "git-pr-instructions",
                pullRequestInstructions,
              );
            }}
          >
            Save
          </RouteButton>
        }
        description="Added to PR title/description generation prompts"
        title="Pull request instructions"
      >
        <textarea
          aria-label="Pull request instructions"
          className="settings-route-textarea git-textarea"
          onChange={(event) => setPullRequestInstructions(event.target.value)}
          placeholder="Add pull request guidance…"
          value={pullRequestInstructions}
        />
      </RouteSection>
    </div>
  );
}

function EnvironmentVariablesButton() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  return (
    <div className="environment-variables-trigger" ref={triggerRef}>
      <RouteButton
        ariaLabel="Variables"
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) {
            setPosition({
              left: Math.max(8, rect.right - 320),
              top: rect.bottom + 6,
            });
          }
          setOpen((value) => !value);
        }}
      >
        Variables
      </RouteButton>
      {open &&
        createPortal(
          <div
            aria-label="Setup script environment variables"
            className="environment-variables-popover"
            ref={popoverRef}
            role="dialog"
            style={position}
          >
            <strong>Setup script environment variables</strong>
            <div>
              <span>Source workspace path</span>
              <code>CODEX_SOURCE_TREE_PATH</code>
            </div>
            <div>
              <span>New worktree path</span>
              <code>CODEX_WORKTREE_PATH</code>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function EnvironmentsSettings() {
  const { createProject, localProjects, pickProjectFolder } = useSession();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [environmentName, setEnvironmentName] = useState("local");
  const [setupScript, setSetupScript] = useState("");
  const [cleanupScript, setCleanupScript] = useState("");
  const [actions, setActions] = useState<
    Array<{ command: string; name: string }>
  >([]);
  const editingProject =
    localProjects.find((project) => project.id === editingProjectId) ?? null;

  const addProject = async () => {
    const source = await pickProjectFolder();
    if (!source) return;
    const name = source.split(/[\\/]/).filter(Boolean).at(-1) ?? source;
    createProject(name, [source]);
  };

  const saveEnvironment = () => {
    if (!editingProject || !setupScript.trim()) return;
    const raw = localStorage.getItem("chatgpt.local-environments");
    const saved = raw
      ? (JSON.parse(raw) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    saved[editingProject.id] = {
      actions,
      cleanupScript,
      name: environmentName.trim() || "local",
      setupScript,
    };
    localStorage.setItem("chatgpt.local-environments", JSON.stringify(saved));
    setEditingProjectId(null);
    setAdvancedOpen(false);
  };

  const editEnvironment = (projectId: string) => {
    try {
      const environments = JSON.parse(
        localStorage.getItem("chatgpt.local-environments") ?? "{}",
      ) as Record<
        string,
        {
          actions?: Array<{ command: string; name: string }>;
          cleanupScript?: string;
          name?: string;
          setupScript?: string;
        }
      >;
      const environment = environments[projectId];
      setActions(environment?.actions ?? []);
      setCleanupScript(environment?.cleanupScript ?? "");
      setEnvironmentName(environment?.name ?? "local");
      setSetupScript(environment?.setupScript ?? "");
    } catch {
      setActions([]);
      setCleanupScript("");
      setEnvironmentName("local");
      setSetupScript("");
    }
    setAdvancedOpen(false);
    setEditingProjectId(projectId);
  };

  if (editingProject) {
    return (
      <div className="settings-content settings-content--route settings-content--described environment-editor">
        <button
          className="environment-editor__back"
          onClick={() => setEditingProjectId(null)}
          type="button"
        >
          <ChevronLeft /> Back
        </button>
        <RouteHeader title="Edit local environment" />
        <RouteSection
          actions={<EnvironmentVariablesButton />}
          title="Setup script"
        >
          <textarea
            aria-label="Setup script"
            autoFocus
            className="settings-route-textarea environment-editor__script"
            onChange={(event) => setSetupScript(event.target.value)}
            placeholder="For example: npm install"
            rows={6}
            value={setupScript}
          />
        </RouteSection>
        <section className="environment-editor__advanced">
          <button
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
            type="button"
          >
            <ChevronDown /> Advanced options
          </button>
          {advancedOpen && (
            <div className="environment-editor__advanced-content">
              <label>
                <span>Name</span>
                <input
                  id="local-environment-name"
                  onChange={(event) => setEnvironmentName(event.target.value)}
                  value={environmentName}
                />
              </label>
              <RouteSection
                description="Runs at the project root before worktree cleanup"
                title="Cleanup script"
              >
                <textarea
                  aria-label="Cleanup script"
                  className="settings-route-textarea environment-editor__script"
                  onChange={(event) => setCleanupScript(event.target.value)}
                  rows={6}
                  value={cleanupScript}
                />
              </RouteSection>
              <RouteSection
                actions={
                  <RouteButton
                    onClick={() =>
                      setActions((items) => [
                        ...items,
                        { command: "", name: "" },
                      ])
                    }
                  >
                    Add action
                  </RouteButton>
                }
                description="These actions can run any command and will be displayed in the header"
                title="Actions"
              >
                {actions.length === 0 ? (
                  <RouteCard className="environment-actions-empty">
                    Add an action to run commands from the local toolbar
                  </RouteCard>
                ) : (
                  <div className="environment-actions">
                    {actions.map((action, index) => (
                      <RouteCard key={index}>
                        <label>
                          <span>Name</span>
                          <input
                            aria-label={`Action ${index + 1} name`}
                            onChange={(event) =>
                              setActions((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            value={action.name}
                          />
                        </label>
                        <label>
                          <span>Action script</span>
                          <textarea
                            aria-label={`Action ${index + 1} script`}
                            onChange={(event) =>
                              setActions((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, command: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            rows={4}
                            value={action.command}
                          />
                        </label>
                      </RouteCard>
                    ))}
                  </div>
                )}
              </RouteSection>
            </div>
          )}
        </section>
        <div className="environment-editor__footer">
          <RouteButton
            disabled={!setupScript.trim()}
            onClick={saveEnvironment}
            primary
          >
            Set up project
          </RouteButton>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-content settings-content--route settings-content--described environments-settings">
      <RouteHeader title="Environments">
        Local environments tell ChatGPT how to set up worktrees for a project.{" "}
        <a
          href="https://developers.openai.com/codex/app/local-environments"
          onClick={(event) => {
            event.preventDefault();
            void window.chatgptDesktop.openExternal(event.currentTarget.href);
          }}
          rel="noreferrer"
          target="_blank"
        >
          Learn more
        </a>
      </RouteHeader>
      <RouteSection
        actions={
          <RouteButton onClick={() => void addProject()}>
            Add project
          </RouteButton>
        }
        title="Select a project"
      >
        {localProjects.length === 0 ? (
          <RouteCard className="environment-empty">
            <p>No projects yet. Add one to configure local environments.</p>
            <RouteButton onClick={() => void addProject()} primary>
              Add project
            </RouteButton>
          </RouteCard>
        ) : (
          <div
            aria-label="Available projects"
            className="environment-projects"
            role="list"
          >
            {localProjects.map((project) => (
              <div aria-label={project.name} key={project.id} role="listitem">
                <RouteCard>
                  <RouteRow
                    action={
                      <RouteButton
                        ariaLabel={`Add environment to ${project.name}`}
                        onClick={() => editEnvironment(project.id)}
                      >
                        <Plus />
                      </RouteButton>
                    }
                    description={project.rootPaths[0]}
                    icon={<Folder />}
                    title={project.name}
                  />
                </RouteCard>
              </div>
            ))}
          </div>
        )}
      </RouteSection>
    </div>
  );
}

function WorktreesSettings() {
  const [worktreeRoot, setWorktreeRoot] = useState(
    () => localStorage.getItem("git-worktree-root") ?? "",
  );
  const [autoCleanup, setAutoCleanup] = useState(
    () => localStorage.getItem("worktree-auto-cleanup-enabled") !== "false",
  );
  const [keepCount, setKeepCount] = useState(
    () => localStorage.getItem("worktree-keep-count") ?? "15",
  );

  const saveKeepCount = () => {
    const parsed = Number.parseInt(keepCount.trim(), 10);
    if (Number.isNaN(parsed)) {
      setKeepCount(localStorage.getItem("worktree-keep-count") ?? "15");
      return;
    }
    const normalized = String(Math.max(1, Math.trunc(parsed)));
    setKeepCount(normalized);
    localStorage.setItem("worktree-keep-count", normalized);
  };

  return (
    <div className="settings-content settings-content--route worktrees-settings">
      <RouteHeader title="Worktrees" />
      <RouteCard>
        <RouteRow
          action={
            <input
              aria-label="Worktree root"
              className="settings-inline-input"
              onBlur={() =>
                localStorage.setItem("git-worktree-root", worktreeRoot.trim())
              }
              onChange={(event) => setWorktreeRoot(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              placeholder="Default"
              value={worktreeRoot}
            />
          }
          description="Directory where ChatGPT creates managed worktrees; leave blank to use the default location"
          title="Worktree root"
        />
        <RouteRow
          action={
            <RouteSwitch
              checked={autoCleanup}
              label="Automatically delete old worktrees"
              onCheckedChange={(checked) => {
                setAutoCleanup(checked);
                localStorage.setItem(
                  "worktree-auto-cleanup-enabled",
                  String(checked),
                );
              }}
            />
          }
          description="Recommended for most users. Turn this off only if you want to manage old worktrees and disk usage yourself."
          title="Automatically delete old worktrees"
        />
        <RouteRow
          action={
            <input
              aria-label="Auto-delete limit"
              className="settings-inline-input settings-inline-input--small"
              disabled={!autoCleanup}
              onBlur={saveKeepCount}
              onChange={(event) => setKeepCount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveKeepCount();
                }
              }}
              value={keepCount}
            />
          }
          description={
            autoCleanup
              ? "Number of managed worktrees to keep before older ones are pruned automatically. ChatGPT snapshots worktrees before deleting, so pruned worktrees should always be restorable."
              : "Automatic deletion is disabled. ChatGPT will not prune old worktrees automatically. Re-enable it to use this saved limit again."
          }
          title="Auto-delete limit"
        />
      </RouteCard>
      <div className="worktree-loading">
        <SettingsLoadingIcon /> Fetching worktree details…
      </div>
    </div>
  );
}

export function SettingsRouteContent({
  onAddMcpServer,
  onBrowsePlugins,
  onCreatePlugin,
  onCreatePet,
  section,
}: {
  onAddMcpServer?(): void;
  onBrowsePlugins?(): void;
  onCreatePlugin?(): void;
  onCreatePet?(): void;
  section: SettingsSection;
}) {
  switch (section) {
    case "appearance":
      return <AppearanceSettings />;
    case "configuration":
      return <ConfigurationSettings />;
    case "personalization":
      return <PersonalizationSettings />;
    case "pets":
      return <PetsSettings onCreatePet={onCreatePet} />;
    case "keyboard-shortcuts":
      return <KeyboardSettings />;
    case "usage-billing":
      return <UsageSettings />;
    case "plugins":
      return (
        <PluginsSettings
          onAddMcpServer={onAddMcpServer}
          onBrowseDirectory={onBrowsePlugins}
          onCreatePlugin={onCreatePlugin}
        />
      );
    case "browser":
      return <BrowserSettings />;
    case "computer-use":
      return <ComputerUseSettings />;
    case "hooks":
      return <HooksSettings />;
    case "git":
      return <GitSettings />;
    case "environments":
      return <EnvironmentsSettings />;
    case "worktrees":
      return <WorktreesSettings />;
    case "account":
    case "archived-chats":
    case "general":
      return null;
  }
}
