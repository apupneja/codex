import { ArrowLeft, Download, Info, Search } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";

import type { SettingsSection } from "../../state/navigation";
import { BackIcon, ModeCheckIcon, SearchIcon } from "../../ui/AppIcons";
import {
  SettingsAccountIcon,
  SettingsAppearanceIcon,
  SettingsArchivedIcon,
  SettingsBrowserIcon,
  SettingsComputerUseIcon,
  SettingsConfigurationIcon,
  SettingsChevronDownIcon,
  SettingsEnvironmentsIcon,
  SettingsExternalIcon,
  SettingsGeneralIcon,
  SettingsGitIcon,
  SettingsHooksIcon,
  SettingsKeyboardIcon,
  SettingsPersonalizationIcon,
  SettingsPetsActiveIcon,
  SettingsPetsIcon,
  SettingsPluginsIcon,
  SettingsUsageIcon,
  SettingsWorktreesIcon,
} from "./SettingsNavIcons";
import { SettingsRouteContent } from "./SettingsRoutes";

export type { SettingsSection } from "../../state/navigation";

type NavItem = {
  activeIcon?: ComponentType<SVGProps<SVGSVGElement>>;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  id: SettingsSection;
  label: string;
  external?: boolean;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Personal",
    items: [
      { icon: SettingsGeneralIcon, id: "general", label: "General" },
      { icon: SettingsAppearanceIcon, id: "appearance", label: "Appearance" },
      {
        icon: SettingsConfigurationIcon,
        id: "configuration",
        label: "Configuration",
      },
      {
        icon: SettingsPersonalizationIcon,
        id: "personalization",
        label: "Personalization",
      },
      {
        activeIcon: SettingsPetsActiveIcon,
        icon: SettingsPetsIcon,
        id: "pets",
        label: "Pets",
      },
      {
        icon: SettingsKeyboardIcon,
        id: "keyboard-shortcuts",
        label: "Keyboard shortcuts",
      },
      {
        icon: SettingsUsageIcon,
        id: "usage-billing",
        label: "Usage & billing",
      },
      {
        external: true,
        icon: SettingsAccountIcon,
        id: "account",
        label: "Account",
      },
    ],
  },
  {
    label: "Integrations",
    items: [
      { icon: SettingsPluginsIcon, id: "plugins", label: "Plugins" },
      { icon: SettingsBrowserIcon, id: "browser", label: "Browser" },
      {
        icon: SettingsComputerUseIcon,
        id: "computer-use",
        label: "Computer use",
      },
    ],
  },
  {
    label: "Coding",
    items: [
      { icon: SettingsHooksIcon, id: "hooks", label: "Hooks" },
      { icon: SettingsGitIcon, id: "git", label: "Git" },
      {
        icon: SettingsEnvironmentsIcon,
        id: "environments",
        label: "Environments",
      },
      {
        icon: SettingsWorktreesIcon,
        id: "worktrees",
        label: "Worktrees",
      },
    ],
  },
  {
    label: "Archived",
    items: [
      {
        icon: SettingsArchivedIcon,
        id: "archived-chats",
        label: "Archived chats",
      },
    ],
  },
];

function SettingSwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange?(): void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className="settings-switch"
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span className="settings-switch__track">
        <span className="settings-switch__thumb" />
      </span>
    </button>
  );
}

function SettingPill({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?(): void;
}) {
  return (
    <button
      className="settings-pill"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

type DropdownOption = { label: string; value: string };

function SettingDropdown({
  options,
  searchable = false,
  storageKey,
  value: initialValue,
}: {
  options: DropdownOption[];
  searchable?: boolean;
  storageKey: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(
    () => localStorage.getItem(storageKey) ?? initialValue,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div
      className="settings-dropdown"
      data-storage-key={storageKey}
      ref={rootRef}
    >
      <SettingPill onClick={() => setOpen((current) => !current)}>
        {selected.label} <SettingsChevronDownIcon aria-hidden="true" />
      </SettingPill>
      {open && (
        <div
          className={`settings-dropdown__menu${searchable ? " is-searchable" : ""}`}
          role={searchable ? "dialog" : "menu"}
        >
          {searchable && (
            <>
              <label className="settings-dropdown__search">
                <Search aria-hidden="true" />
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search languages"
                  ref={searchInputRef}
                  role="combobox"
                  value={query}
                />
              </label>
              {!query && (
                <button
                  className="settings-dropdown__automatic"
                  onClick={() => {
                    setValue("auto");
                    localStorage.setItem(storageKey, "auto");
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span>Auto detect</span>
                  {value === "auto" && <ModeCheckIcon aria-hidden="true" />}
                </button>
              )}
            </>
          )}
          <div className={searchable ? "settings-dropdown__scroll" : undefined}>
            <div
              aria-label={searchable ? "Suggestions" : undefined}
              className="settings-dropdown__options"
              role={searchable ? "listbox" : undefined}
            >
              {visibleOptions
                .filter((option) => !searchable || option.value !== "auto")
                .map((option) => (
                  <button
                    aria-checked={
                      searchable ? undefined : option.value === value
                    }
                    aria-selected={
                      searchable ? option.value === value : undefined
                    }
                    key={option.value}
                    onClick={() => {
                      setValue(option.value);
                      localStorage.setItem(storageKey, option.value);
                      setOpen(false);
                    }}
                    role={searchable ? "option" : "menuitem"}
                    type="button"
                  >
                    <span>{option.label}</span>
                    {option.value === value && (
                      <ModeCheckIcon aria-hidden="true" />
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingRow({
  action,
  children,
  description,
  title,
}: {
  action: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <div className="settings-card__row">
      <div className="settings-card__copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
        {children}
      </div>
      <div className="settings-card__action">{action}</div>
    </div>
  );
}

function Segmented({
  active,
  storageKey,
  values,
}: {
  active: string;
  storageKey: string;
  values: string[];
}) {
  const [selected, setSelected] = useState(
    () => localStorage.getItem(storageKey) ?? active,
  );
  return (
    <div className="settings-segmented">
      {values.map((value) => (
        <button
          aria-label={value}
          aria-pressed={value === selected}
          className={value === selected ? "is-active" : ""}
          key={value}
          onClick={() => {
            setSelected(value);
            localStorage.setItem(storageKey, value);
          }}
          type="button"
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function GeneralSettings({ onOpenLicenses }: { onOpenLicenses(): void }) {
  const storedBoolean = (key: string, fallback: boolean) => {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  };
  const [fullAccess, setFullAccess] = useState(() =>
    storedBoolean("general-show-full-access", true),
  );
  const [menuBar, setMenuBar] = useState(() =>
    storedBoolean("general-show-menu-bar", true),
  );
  const [bottomPanel, setBottomPanel] = useState(() =>
    storedBoolean("general-show-bottom-panel", true),
  );
  const [preventSleep, setPreventSleep] = useState(() =>
    storedBoolean("general-prevent-sleep", false),
  );
  const [contextUsage, setContextUsage] = useState(() =>
    storedBoolean("general-show-context-usage", false),
  );
  const [permissionNotifications, setPermissionNotifications] = useState(() =>
    storedBoolean("general-permission-notifications", true),
  );
  const [questionNotifications, setQuestionNotifications] = useState(() =>
    storedBoolean("general-question-notifications", true),
  );

  const updateBoolean = (
    key: string,
    value: boolean,
    update: (value: boolean) => void,
  ) => {
    update(value);
    localStorage.setItem(key, String(value));
  };

  useEffect(() => {
    void window.chatgptDesktop.setPreventSleep(preventSleep);
  }, []);

  return (
    <div className="settings-content">
      <h1>General</h1>

      <section className="settings-panel-section settings-panel-section--permissions">
        <div className="settings-panel-section__title">Permissions</div>
        <div className="settings-card">
          <SettingRow
            action={
              <SettingSwitch
                checked
                disabled
                label="Default permissions are always shown"
              />
            }
            description="By default, ChatGPT can read and edit files in its workspace. It can ask for additional access when needed"
            title="Default permissions"
          />
          <SettingRow
            action={
              <SettingSwitch
                checked={fullAccess}
                label="Show Full access in the composer"
                onChange={() =>
                  updateBoolean(
                    "general-show-full-access",
                    !fullAccess,
                    setFullAccess,
                  )
                }
              />
            }
            description={
              <>
                When ChatGPT runs with full access, it can edit any file on your
                computer and run commands with network, without your approval.
                This significantly increases the risk of data loss, leaks, or
                unexpected behavior.{" "}
                <a
                  href="https://developers.openai.com/codex/config-basic"
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
                </a>{" "}
                about elevated risks.
              </>
            }
            title="Full access"
          />
        </div>
      </section>

      <section className="settings-panel-section">
        <div className="settings-panel-section__title">General</div>
        <div className="settings-card">
          <SettingRow
            action={
              <SettingPill disabled>
                No targets found <SettingsChevronDownIcon aria-hidden="true" />
              </SettingPill>
            }
            description="Where files and folders open by default"
            title="Default file open destination"
          />
          <SettingRow
            action={
              <SettingDropdown
                options={languageOptions}
                searchable
                storageKey="chatgpt.locale-override"
                value="auto"
              />
            }
            description="Language for the app UI"
            title="Language"
          />
          <SettingRow
            action={
              <SettingSwitch
                checked={menuBar}
                label="Show ChatGPT in the menu bar"
                onChange={() => {
                  const next = !menuBar;
                  updateBoolean("general-show-menu-bar", next, setMenuBar);
                  void window.chatgptDesktop.setMenuBarVisible(next);
                }}
              />
            }
            description="Keep ChatGPT in the macOS menu bar when the main window is closed"
            title="Show in menu bar"
          />
          <SettingRow
            action={
              <SettingSwitch
                checked={bottomPanel}
                label="Bottom panel"
                onChange={() => {
                  updateBoolean(
                    "general-show-bottom-panel",
                    !bottomPanel,
                    setBottomPanel,
                  );
                  window.dispatchEvent(
                    new CustomEvent("chatgpt:bottom-panel-setting-changed", {
                      detail: !bottomPanel,
                    }),
                  );
                }}
              />
            }
            description="Show the bottom panel control in the app header"
            title="Bottom panel"
          />
          <SettingRow
            action={
              <Segmented
                active="Bottom"
                storageKey="general-terminal-location"
                values={["Bottom", "Right"]}
              />
            }
            description="Choose where the terminal shortcut and environment actions open terminal tabs"
            title="Default terminal location"
          />
          <SettingRow
            action={
              <SettingSwitch
                checked={preventSleep}
                label="Prevent sleep while running"
                onChange={() => {
                  const next = !preventSleep;
                  updateBoolean("general-prevent-sleep", next, setPreventSleep);
                  void window.chatgptDesktop.setPreventSleep(next);
                }}
              />
            }
            description="Keep your computer awake while ChatGPT is running a task"
            title="Prevent sleep while running"
          />
          <SettingRow
            action={<SettingPill disabled>No data detected</SettingPill>}
            description="Bring over your setup, projects, and recent chats"
            title="Import work from other AI apps"
          />
          <SettingRow
            action={<SettingPill onClick={onOpenLicenses}>View</SettingPill>}
            description="Third-party notices for bundled dependencies"
            title="Open source licenses"
          />
        </div>
      </section>

      <section className="settings-panel-section settings-panel-section--composer">
        <div className="settings-panel-section__title">Composer</div>
        <div className="settings-card">
          <SettingRow
            action={
              <SettingSwitch
                checked={contextUsage}
                label="Show context window usage in the composer"
                onChange={() =>
                  updateBoolean(
                    "general-show-context-usage",
                    !contextUsage,
                    setContextUsage,
                  )
                }
              />
            }
            title="Show context window usage"
          />
          <SettingRow
            action={
              <SettingDropdown
                options={sendShortcutOptions}
                storageKey="chatgpt.composer-enter-behavior"
                value="enter"
              />
            }
            description="Choose when Enter sends a prompt or inserts a new line"
            title="Send shortcut"
          />
          <SettingRow
            action={
              <Segmented
                active="Steer"
                storageKey="general-follow-up-behavior"
                values={["Queue", "Steer"]}
              />
            }
            description="Queue follow-ups while ChatGPT runs or steer the current run. Press ⌘⏎ to do the opposite for one message"
            title="Follow-up behavior"
          />
        </div>
      </section>

      <section className="settings-panel-section">
        <div className="settings-panel-section__title">Notifications</div>
        <div className="settings-card">
          <SettingRow
            action={
              <SettingDropdown
                options={notificationOptions}
                storageKey="chatgpt.turn-notifications"
                value="unfocused"
              />
            }
            description="Set when ChatGPT alerts you that it's finished"
            title="Turn completion notifications"
          />
          <SettingRow
            action={
              <SettingSwitch
                checked={permissionNotifications}
                label="Enable permission notifications"
                onChange={() =>
                  updateBoolean(
                    "general-permission-notifications",
                    !permissionNotifications,
                    setPermissionNotifications,
                  )
                }
              />
            }
            description="Show alerts when notification permissions are required"
            title="Enable permission notifications"
          />
          <SettingRow
            action={
              <SettingSwitch
                checked={questionNotifications}
                label="Enable question notifications"
                onChange={() =>
                  updateBoolean(
                    "general-question-notifications",
                    !questionNotifications,
                    setQuestionNotifications,
                  )
                }
              />
            }
            description="Show alerts when input is needed to continue"
            title="Enable question notifications"
          />
        </div>
      </section>
    </div>
  );
}

const languageOptions: DropdownOption[] = [
  { label: "Auto detect", value: "auto" },
  { label: "Albanian", value: "sq-AL" },
  { label: "Armenian", value: "hy-AM" },
  { label: "Bahasa Melayu", value: "ms-MY" },
  { label: "bosanski", value: "bs-BA" },
  { label: "Burmese", value: "my-MM" },
  { label: "català", value: "ca-ES" },
  { label: "čeština", value: "cs-CZ" },
  { label: "dansk", value: "da-DK" },
  { label: "Deutsch", value: "de-DE" },
  { label: "eesti", value: "et-EE" },
  { label: "English", value: "en-US" },
  { label: "español (España)", value: "es-ES" },
  { label: "español (Latinoamérica)", value: "es-419" },
  { label: "Filipino", value: "fil-PH" },
  { label: "français (Canada)", value: "fr-CA" },
  { label: "français (France)", value: "fr-FR" },
  { label: "Georgian", value: "ka-GE" },
  { label: "hrvatski", value: "hr-HR" },
  { label: "Icelandic", value: "is-IS" },
  { label: "Indonesia", value: "id-ID" },
  { label: "italiano", value: "it-IT" },
  { label: "Kiswahili", value: "sw-KE" },
  { label: "latviešu", value: "lv-LV" },
  { label: "lietuvių", value: "lt-LT" },
  { label: "Macedonian", value: "mk-MK" },
  { label: "magyar", value: "hu-HU" },
  { label: "Mongolian", value: "mn-MN" },
  { label: "Nederlands", value: "nl-NL" },
  { label: "norsk bokmål", value: "nb-NO" },
  { label: "polski", value: "pl-PL" },
  { label: "português (Brasil)", value: "pt-BR" },
  { label: "português (Portugal)", value: "pt-PT" },
  { label: "română", value: "ro-RO" },
  { label: "slovenčina", value: "sk-SK" },
  { label: "slovenščina", value: "sl-SI" },
  { label: "Somali", value: "so-SO" },
  { label: "suomi", value: "fi-FI" },
  { label: "svenska", value: "sv-SE" },
  { label: "Tiếng Việt", value: "vi-VN" },
  { label: "Türkçe", value: "tr-TR" },
  { label: "Ελληνικά", value: "el-GR" },
  { label: "български", value: "bg-BG" },
  { label: "қазақ тілі", value: "kk-KZ" },
  { label: "русский", value: "ru-RU" },
  { label: "српски", value: "sr-RS" },
  { label: "українська", value: "uk-UA" },
  { label: "اردو", value: "ur-PK" },
  { label: "العربية", value: "ar-SA" },
  { label: "فارسی", value: "fa-IR" },
  { label: "አማርኛ", value: "am-ET" },
  { label: "मराठी", value: "mr-IN" },
  { label: "हिन्दी", value: "hi-IN" },
  { label: "বাংলা", value: "bn-BD" },
  { label: "ਪੰਜਾਬੀ", value: "pa-IN" },
  { label: "ગુજરાતી", value: "gu-IN" },
  { label: "தமிழ்", value: "ta-IN" },
  { label: "తెలుగు", value: "te-IN" },
  { label: "ಕನ್ನಡ", value: "kn-IN" },
  { label: "മലയാളം", value: "ml-IN" },
  { label: "ไทย", value: "th-TH" },
  { label: "한국어", value: "ko-KR" },
  { label: "日本語", value: "ja-JP" },
  { label: "简体中文", value: "zh-CN" },
  { label: "繁體中文（台灣）", value: "zh-TW" },
  { label: "繁體中文（香港）", value: "zh-HK" },
];

const sendShortcutOptions: DropdownOption[] = [
  { label: "Enter", value: "enter" },
  { label: "⌘ + Enter for multiline prompts", value: "cmdIfMultiline" },
  { label: "⌘ + Enter always", value: "cmdAlways" },
];

const notificationOptions: DropdownOption[] = [
  { label: "Never", value: "off" },
  { label: "Only when unfocused", value: "unfocused" },
  { label: "Always", value: "always" },
];

function OpenSourceLicenses({ onBack }: { onBack(): void }) {
  return (
    <>
      <button className="settings-main__back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" />
        Back
      </button>
      <div className="settings-content settings-open-source-licenses">
        <header>
          <h1>Open source licenses</h1>
          <p>Third-party notices for dependencies included in this app</p>
        </header>
        <section>No third-party notices were found.</section>
      </div>
    </>
  );
}

export function SettingsPage({
  initialSection = "general",
  onAddMcpServer,
  onBack,
  onBrowsePlugins,
  onCreatePlugin,
  onCreatePet,
}: {
  initialSection?: SettingsSection;
  onAddMcpServer?(): void;
  onBack(): void;
  onBrowsePlugins?(): void;
  onCreatePlugin?(): void;
  onCreatePet?(): void;
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLicenses, setShowLicenses] = useState(false);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !normalizedSearchQuery ||
          item.label.toLocaleLowerCase().includes(normalizedSearchQuery),
      ),
    }))
    .filter((group) => group.items.length > 0);

  if (section === "archived-chats") {
    return (
      <div className="settings-error">
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

  return (
    <div className="settings-window">
      <aside className="settings-sidebar">
        <div className="settings-sidebar__drag" />
        <button className="settings-back" onClick={onBack} type="button">
          <BackIcon aria-hidden="true" />
          <span>Back to app</span>
        </button>
        <label className="settings-search">
          <SearchIcon aria-hidden="true" />
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search settings…"
            value={searchQuery}
          />
        </label>

        <nav aria-label="Settings">
          {visibleNavGroups.map(({ items, label }, groupIndex) => (
            <div className="settings-nav-group" key={label}>
              <div
                className={`settings-sidebar__heading${groupIndex === 0 ? " is-first" : ""}`}
              >
                {label}
              </div>
              {items.map(
                ({ activeIcon, external, icon, id, label: itemLabel }) => {
                  const Icon = section === id && activeIcon ? activeIcon : icon;
                  return (
                    <button
                      aria-label={itemLabel}
                      className={section === id ? "is-active" : ""}
                      key={id}
                      onClick={() => {
                        if (external) {
                          void window.chatgptDesktop.openExternal(
                            "https://chatgpt.com/#settings/Account",
                          );
                        } else {
                          setShowLicenses(false);
                          setSection(id);
                        }
                      }}
                      type="button"
                    >
                      <Icon aria-hidden="true" />
                      <span>{itemLabel}</span>
                      {external && <SettingsExternalIcon aria-hidden="true" />}
                    </button>
                  );
                },
              )}
            </div>
          ))}
        </nav>
      </aside>

      <main className="settings-main">
        {showLicenses ? (
          <OpenSourceLicenses onBack={() => setShowLicenses(false)} />
        ) : section === "general" ? (
          <GeneralSettings onOpenLicenses={() => setShowLicenses(true)} />
        ) : (
          <SettingsRouteContent
            onAddMcpServer={onAddMcpServer}
            onBrowsePlugins={onBrowsePlugins}
            onCreatePlugin={onCreatePlugin}
            onCreatePet={onCreatePet}
            section={section}
          />
        )}
      </main>
    </div>
  );
}
