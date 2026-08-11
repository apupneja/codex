import {
  ArrowLeft,
  Blocks,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleArrowUp,
  CircleHelp,
  Cloud,
  Code2,
  ExternalLink,
  GitBranch,
  Globe2,
  Keyboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  Slack,
  Smartphone,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { DesktopPreferences, ManagedWorktree } from "../../shared/types";
import { MenuSeparator, MenuSurface, Select } from "../design-system";
import type { CodexController } from "../state/useCodexController";
import {
  SettingsRange,
  SettingsRow,
  SettingsSelect,
  SettingsToggle,
  Stepper,
  useStoredSetting,
} from "./settings/SettingsControls";

type UtilityProps = { controller: CodexController };

function relativeAge(timestamp: number): string {
  const elapsedDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  if (elapsedDays < 1) return "today";
  if (elapsedDays < 30) return `${Math.floor(elapsedDays)}d ago`;
  if (elapsedDays < 365) return `${Math.floor(elapsedDays / 30)}mo ago`;
  return `${Math.floor(elapsedDays / 365)}y ago`;
}

export function SettingsView({
  controller,
  onClose,
}: UtilityProps & { onClose(): void }) {
  const [activeSection, setActiveSection] = useState("General");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [customizeNoticeVisible, setCustomizeNoticeVisible] = useState(true);
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [managedWorktrees, setManagedWorktrees] = useState<
    ManagedWorktree[] | null
  >(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsNarrow, setSettingsNarrow] = useState(
    () => window.innerWidth < 684,
  );
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(true);
  const [tipsEnabled, setTipsEnabled] = useStoredSetting<boolean>(
    "toggle:Tips",
    true,
  );
  const [systemNotifications, setSystemNotifications] =
    useStoredSetting<boolean>("toggle:System Notifications", true);
  const identity =
    controller.account?.type === "chatgpt"
      ? (controller.account.email ?? "ChatGPT")
      : controller.account?.type === "apiKey"
        ? "API key"
        : controller.account?.type === "amazonBedrock"
          ? "Amazon Bedrock"
          : "Not signed in";
  const displayIdentity =
    controller.account?.type === "chatgpt"
      ? (controller.account.email?.split("@")[0] ?? "Anirudh Pupneja")
      : identity;
  const sections = [
    "General",
    "Profile",
    "Appearance",
    "Agents",
    "Cloud Agents",
    "Models",
    "Git & PRs",
    "Worktrees",
    "Browser & Network",
    "Tab",
    "Code Intelligence",
    "Beta",
    "Docs",
  ];
  const externalSections = new Set(["Cloud Agents", "Docs"]);
  const groupedSections = new Set(["Agents", "Browser & Network", "Docs"]);
  const sectionIcons: Record<string, LucideIcon> = {
    "Agents": Bot,
    "Appearance": CircleHelp,
    "Beta": WandSparkles,
    "Browser & Network": Globe2,
    "Cloud Agents": Cloud,
    "Code Intelligence": Code2,
    "Docs": BookOpen,
    "General": Settings2,
    "Git & PRs": GitBranch,
    "Models": Package,
    "Profile": UserRound,
    "Tab": PanelRight,
    "Worktrees": Blocks,
  };
  const filteredSections = sections.filter((section) =>
    section
      .toLocaleLowerCase()
      .includes(searchQuery.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    let cancelled = false;
    void window.codexDesktop
      .listManagedWorktrees()
      .then((worktrees) => {
        if (!cancelled) setManagedWorktrees(worktrees);
      })
      .catch(() => {
        if (!cancelled) setManagedWorktrees([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "Profile" || profileLoaded) return;
    const timer = window.setTimeout(() => setProfileLoaded(true), 650);
    return () => window.clearTimeout(timer);
  }, [activeSection, profileLoaded]);

  useEffect(() => {
    const updateLayout = () => {
      const narrow = window.innerWidth < 684;
      setSettingsNarrow(narrow);
      if (!narrow) setSettingsSidebarOpen(true);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  async function logout(): Promise<void> {
    try {
      await window.codexDesktop.request("account/logout");
      controller.addToast("Signed out", "success");
    } catch (error) {
      controller.addToast(
        error instanceof Error ? error.message : String(error),
        "danger",
      );
    }
  }

  return (
    <main
      className={`settings-shell ${settingsNarrow ? "settings-shell-narrow" : ""}`}
    >
      {settingsNarrow && settingsSidebarOpen ? (
        <button
          aria-label="Close sidebar"
          className="settings-sidebar-scrim"
          onClick={() => setSettingsSidebarOpen(false)}
        />
      ) : null}
      {settingsNarrow && !settingsSidebarOpen ? (
        <button
          aria-label="Show Sidebar"
          className="settings-show-sidebar"
          onClick={() => setSettingsSidebarOpen(true)}
        >
          <PanelLeftOpen size={15} />
        </button>
      ) : null}
      <aside
        className={`settings-sidebar ${settingsNarrow && !settingsSidebarOpen ? "settings-sidebar-hidden" : ""}`}
      >
        {settingsNarrow ? (
          <button
            aria-label="Hide Sidebar"
            className="settings-hide-sidebar"
            onClick={() => setSettingsSidebarOpen(false)}
          >
            <PanelLeftClose size={14} />
          </button>
        ) : null}
        <button className="settings-back" onClick={onClose}>
          <ArrowLeft size={14} /> Back
        </button>
        <label className="settings-search">
          <Search size={14} />
          <input
            aria-label="Search Settings"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Settings"
            value={searchQuery}
          />
        </label>
        <nav aria-label="Settings sections">
          {filteredSections.map((section) => {
            const Icon = sectionIcons[section] ?? CircleHelp;
            return (
              <button
                className={[
                  activeSection === section ? "active" : "",
                  searchQuery.length === 0 && groupedSections.has(section)
                    ? "settings-nav-group"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={section}
                onClick={() => {
                  if (externalSections.has(section)) {
                    void window.codexDesktop
                      .openExternal(
                        section === "Docs"
                          ? "https://docs.cursor.com/"
                          : "https://cursor.com/agents",
                      )
                      .catch(() => undefined);
                    return;
                  }
                  setActiveSection(section);
                }}
              >
                <Icon aria-hidden="true" size={12} />
                {section}
                {externalSections.has(section) ? (
                  <ExternalLink className="settings-external-icon" size={11} />
                ) : null}
              </button>
            );
          })}
          {filteredSections.length === 0 ? (
            <span className="settings-no-results">No results found.</span>
          ) : null}
        </nav>
        <div className="settings-sidebar-footer">
          {onboardingVisible ? (
            <div className="onboarding-card">
              <div>
                <span>Getting Started</span>
                <small>
                  2/3 <i aria-hidden="true" />
                </small>
                <button
                  aria-label="Skip step 2 of 3"
                  className="onboarding-skip"
                  onClick={() => setOnboardingVisible(false)}
                  title="Skip step 2 of 3"
                >
                  ×
                </button>
              </div>
              <button onClick={() => setActiveSection("General")}>
                <Slack size={14} />
                Connect Slack
              </button>
            </div>
          ) : null}
          <div className="settings-account-controls">
            <button
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="settings-account-row"
              onClick={() => setAccountMenuOpen((current) => !current)}
            >
              <span className="avatar">
                {displayIdentity.charAt(0).toUpperCase()}
              </span>
              <span>
                <strong>
                  {displayIdentity === "Not signed in"
                    ? "Anirudh Pupneja"
                    : displayIdentity}
                </strong>
                <small>Free Plan</small>
              </span>
            </button>
            <button
              aria-label="Close Settings"
              aria-pressed={true}
              className="settings-close-button"
              onClick={onClose}
              title="Close Settings"
            >
              <Settings size={14} />
            </button>
            {accountMenuOpen ? (
              <MenuSurface className="account-menu" role="menu">
                {(
                  [
                    ["Create Profile", UserRound],
                    ["Get Cursor for iOS", Smartphone],
                    ["Docs", BookOpen],
                    ["Shortcuts", Keyboard],
                    ["Contact Us", CircleHelp],
                    ["Log Out", LogOut],
                  ] as const
                ).map(([item, Icon], index) => (
                  <div key={item}>
                    {index === 5 ? <MenuSeparator /> : null}
                    <button
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <Icon aria-hidden="true" size={13} />
                      {item}
                    </button>
                  </div>
                ))}
              </MenuSurface>
            ) : null}
          </div>
        </div>
      </aside>
      <section className="settings-content">
        {activeSection === "General" ? (
          <>
            {customizeNoticeVisible ? (
              <div className="settings-notice">
                <div>
                  <strong>
                    Plugins, MCPs, Skills, and Rules have moved to Customize
                  </strong>
                  <span>
                    We&apos;ve introduced a new home for all the ways to
                    customize Cursor.
                  </span>
                </div>
                <div className="settings-notice-actions">
                  <button
                    className="settings-dismiss"
                    onClick={() => setCustomizeNoticeVisible(false)}
                  >
                    Dismiss
                  </button>
                  <button onClick={() => controller.setView("customize")}>
                    Open Customize →
                  </button>
                </div>
              </div>
            ) : null}
            <h1>General</h1>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-hidden="true">Account</h2>
              <SettingsRow
                description="Manage your account and billing"
                title="Cursor Account"
              >
                <button
                  className="button-secondary"
                  onClick={() =>
                    void window.codexDesktop.openExternal(
                      "https://www.cursor.com/settings",
                    )
                  }
                >
                  Open <ExternalLink aria-hidden="true" size={10} />
                </button>
              </SettingsRow>
              <SettingsRow
                description="Entry-level plan with access to premium models, unlimited Tab completions, and more."
                title="Upgrade to Pro"
              >
                <button
                  className="settings-upgrade"
                  onClick={() =>
                    void window.codexDesktop.openExternal(
                      "https://www.cursor.com/pricing",
                    )
                  }
                >
                  <CircleArrowUp aria-hidden="true" size={11} /> Upgrade
                </button>
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Startup</h2>
              <SettingsRow
                description="Show rotating tips on the empty screen"
                title="Tips"
              >
                <input
                  aria-label="Tips"
                  checked={tipsEnabled}
                  onChange={(event) => setTipsEnabled(event.target.checked)}
                  role="switch"
                  type="checkbox"
                />
              </SettingsRow>
              <SettingsRow
                description="Controls which windows Cursor restores on startup"
                title="Window Restoration"
              >
                <SettingsSelect
                  label="Window Restoration"
                  options={["Default", "New window"]}
                  value="Default"
                />
              </SettingsRow>
            </section>
            <section className="settings-section settings-notifications-section">
              <h2 aria-level={3}>Notifications</h2>
              <SettingsRow
                description="Show system notifications when Agent completes or needs attention"
                title="System Notifications"
              >
                <input
                  aria-label="System Notifications"
                  checked={systemNotifications}
                  onChange={(event) =>
                    setSystemNotifications(event.target.checked)
                  }
                  role="switch"
                  type="checkbox"
                />
              </SettingsRow>
              <SettingsRow
                description="Show warning-level in-app toasts"
                title="Warning Notifications"
              >
                <SettingsToggle label="Warning Notifications" />
              </SettingsRow>
              <SettingsRow
                description="Show Cursor in menu bar"
                title="Menu Bar Icon"
              >
                <SettingsToggle checked label="Menu Bar Icon" />
              </SettingsRow>
              <SettingsRow
                description="Play a sound when agents finish or need attention"
                title="Completion Sound"
              >
                <SettingsToggle label="Completion Sound" />
              </SettingsRow>
            </section>
            <section className="settings-section settings-privacy-section">
              <h2 aria-level={3}>Privacy</h2>
              <SettingsRow
                description="Your codebase, prompts, edits and other usage data will be stored and trained on by Cursor to improve the product."
                title={
                  <span className="settings-data-sharing-title">
                    <Check aria-hidden="true" size={10} /> Data Sharing Enabled
                  </span>
                }
              >
                <SettingsSelect
                  label="Data Sharing Enabled"
                  options={["Configure"]}
                  value="Configure"
                />
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Profile" ? (
          <>
            <h1>Profile</h1>
            {profileLoaded ? (
              <section className="settings-profile-card">
                <div>
                  <strong>Create your public profile</strong>
                  <p>
                    Claim a handle to get a profile page showing your token,
                    model, and agent usage.
                  </p>
                </div>
                <button
                  className="button-primary"
                  onClick={() =>
                    void window.codexDesktop.openExternal(
                      "https://www.cursor.com/profile",
                    )
                  }
                >
                  Claim handle
                </button>
              </section>
            ) : (
              <div aria-hidden="true" className="settings-profile-loading" />
            )}
          </>
        ) : activeSection === "Appearance" ? (
          <>
            <h1>Appearance</h1>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-hidden="true">Theme</h2>
              <SettingsRow
                description="Choose between light, dark, or high contrast themes"
                title="Theme"
              >
                <Select
                  aria-label="Theme"
                  value={controller.preferences.theme}
                  onChange={(value) =>
                    void controller.updatePreferences({
                      theme: value as DesktopPreferences["theme"],
                    })
                  }
                  options={[
                    { label: "System", value: "system" },
                    { label: "Cursor Light", value: "light" },
                    {
                      label: "Cursor Light Colorblind (Beta)",
                      value: "light-colorblind",
                    },
                    { label: "Cursor Dark", value: "dark" },
                    {
                      label: "Cursor Dark High Contrast",
                      value: "dark-high-contrast",
                    },
                  ]}
                />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Agent Conversations</h2>
              <SettingsRow
                description="Adjust how much detail is shown for tool calls"
                title="Tool Call Density"
              >
                <div className="settings-density">
                  <SettingsRange
                    defaultValue={0}
                    label="Conversation density"
                    max={1}
                    min={0}
                  />
                  <span>
                    <small>Compact</small>
                    <small>Detailed</small>
                  </span>
                </div>
              </SettingsRow>
              <SettingsRow
                description="Wrap long lines in Agent conversation code blocks"
                title="Code Block Word Wrap"
              >
                <SettingsToggle label="Code Block Word Wrap" />
              </SettingsRow>
              <SettingsRow
                description="Use themed background colors for inline code diffs"
                title="Themed Diff Backgrounds"
              >
                <SettingsToggle checked label="Themed Diff Backgrounds" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Colors</h2>
              <SettingsRow description="Choose a tint color" title="Hue">
                <SettingsRange
                  defaultValue={210}
                  label="Tint hue"
                  max={360}
                  min={0}
                />
              </SettingsRow>
              <SettingsRow
                description="Control how strongly the tint is applied"
                title="Intensity"
              >
                <SettingsRange
                  defaultValue={0}
                  label="Tint intensity"
                  max={100}
                  min={0}
                  outputSuffix="%"
                />
              </SettingsRow>
              <SettingsRow
                description="Replace translucent surfaces with opaque backgrounds"
                title="Reduce Transparency"
              >
                <SettingsToggle label="Reduce Transparency" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Typography</h2>
              <SettingsRow
                description="Font size for the Cursor user interface"
                title="UI Font Size"
              >
                <Stepper
                  label="UI Font Size"
                  onChange={(uiFontSize) =>
                    void controller.updatePreferences({ uiFontSize })
                  }
                  value={controller.preferences.uiFontSize ?? 13}
                />
              </SettingsRow>
              <SettingsRow
                description="Font size for code editors and diffs"
                title="Code Font Size"
              >
                <Stepper
                  label="Code Font Size"
                  onChange={(editorFontSize) =>
                    void controller.updatePreferences({ editorFontSize })
                  }
                  value={controller.preferences.editorFontSize}
                />
              </SettingsRow>
              <SettingsRow
                description="Override the Cursor user interface typeface"
                title="UI Font Family"
              >
                <span className="settings-static-value">System UI</span>
              </SettingsRow>
              <SettingsRow
                description="Override the font for code editors and diffs"
                title="Code Font Family"
              >
                <span className="settings-static-value">System monospace</span>
              </SettingsRow>
              <div
                aria-label="Sample diff preview for the code font"
                className="settings-font-preview"
              >
                <code>
                  <span className="removed">
                    <b>1</b> return a + b;
                  </span>
                  <span className="added">
                    <b>1</b> const result = a + b;
                  </span>
                  <span className="added">
                    <b>2</b> return result;
                  </span>
                </code>
              </div>
              <SettingsRow
                description="Use native macOS font anti-aliasing"
                title="Font Smoothing"
              >
                <SettingsToggle checked label="Font Smoothing" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>High Contrast</h2>
              <SettingsRow
                description="Switch to a high contrast theme when your OS is in a high contrast mode"
                title="Follow System High Contrast"
              >
                <SettingsToggle checked label="Follow System High Contrast" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Motion</h2>
              <SettingsRow
                description="Minimize interface animations. System follows your OS preference."
                title="Reduce Motion"
              >
                <SettingsSelect
                  label="Reduce Motion"
                  options={["System", "On", "Off"]}
                  value="System"
                />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Privacy</h2>
              <SettingsRow
                description="Partially mask your email address in the Cursor user interface"
                title="Hide Email Address"
              >
                <SettingsToggle label="Hide Email Address" />
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Agents" ? (
          <>
            <h1>Agents</h1>
            <section className="settings-section">
              <h2 aria-level={3}>Conversation</h2>
              <SettingsRow
                description="⌘Enter submits chat, Enter inserts a newline, and primary actions move to ⌥⌘Enter"
                title="Submit with ⌘ + Enter"
              >
                <SettingsToggle label="Submit with ⌘ + Enter" />
              </SettingsRow>
              <SettingsRow
                description="Where new agents start by default"
                title="Default Environment"
              >
                <SettingsSelect
                  label="Default Environment"
                  options={["Last Used"]}
                  value="Last Used"
                />
              </SettingsRow>
              <SettingsRow
                description="What model new agents use by default"
                title="Default Model"
              >
                <SettingsSelect
                  label="Default Model"
                  options={["Cursor Default"]}
                  value="Cursor Default"
                />
              </SettingsRow>
              <SettingsRow
                description="Adjust the default behavior of sending a message while Agent is running"
                title="Queue Messages"
              >
                <SettingsSelect
                  label="Queue Messages"
                  options={["Send After Current Message"]}
                  value="Send After Current Message"
                />
              </SettingsRow>
              <SettingsRow
                description="When to show the usage summary at the bottom of the chat pane"
                title="Usage Summary"
              >
                <SettingsSelect
                  label="Usage Summary"
                  options={["Auto"]}
                  value="Auto"
                />
              </SettingsRow>
              <SettingsRow
                description="Contextual suggestions while prompting Agent"
                title="Agent Autocomplete"
              >
                <SettingsToggle checked label="Agent Autocomplete" />
              </SettingsRow>
              <SettingsRow
                description="Allow Agent to switch modes without asking first, such as Agent to Plan or Agent to Debug. When off, Cursor asks before switching."
                title="Auto-Approve Mode Transitions"
              >
                <SettingsToggle label="Auto-Approve Mode Transitions" />
              </SettingsRow>
              <div className="settings-row settings-keyword-row">
                <div>
                  <strong>Voice Submit Keywords</strong>
                  <p>
                    Custom words that submit a voice prompt. Spaces and
                    punctuation are ignored.
                  </p>
                  <div className="settings-keyword-input">
                    <span>
                      submit
                      <button aria-label="Remove submit" type="button">
                        ×
                      </button>
                    </span>
                    <input
                      aria-label="Add keyword"
                      placeholder="e.g., send, submit, cursor"
                      type="text"
                    />
                  </div>
                </div>
              </div>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Third-Party Imports</h2>
              <SettingsRow
                description="Automatically import agent configs from other tools"
                title="Include Third-Party Plugins, Skills, and Other Configs"
              >
                <SettingsToggle
                  checked
                  label="Include Third-Party Plugins, Skills, and Other Configs"
                />
              </SettingsRow>
              <SettingsRow
                description="Sync chats and continue them in Cursor"
                title="Import Claude Code Conversations"
              >
                <SettingsToggle label="Import Claude Code Conversations" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Context and Tools</h2>
              <SettingsRow
                description="Allow Agent to search the web for relevant information"
                title="Web Search Tool"
              >
                <SettingsToggle checked label="Web Search Tool" />
              </SettingsRow>
              <SettingsRow
                description="Enabled by Run Everything Auto-Run Mode: Agent bypasses approval prompts for tools including Web Search."
                title="Auto-Accept Web Search"
              >
                <SettingsToggle
                  checked
                  disabled
                  label="Auto-Accept Web Search"
                />
              </SettingsRow>
              <SettingsRow
                description="Allow Agent to fetch content from URLs"
                title="Web Fetch Tool"
              >
                <SettingsToggle checked label="Web Fetch Tool" />
              </SettingsRow>
              <SettingsRow
                description="Wait indefinitely to authenticate when prompted. When off, skip authentication prompts after 30 seconds."
                title="Wait for MCP Authentication"
              >
                <SettingsToggle checked label="Wait for MCP Authentication" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Execution and Approvals</h2>
              <SettingsRow
                description="Choose how Agents run tools like command execution, MCP, and file writes. All commands will run without approval, classification or sandboxing."
                title="Run Mode"
              >
                <div className="settings-run-mode-control">
                  <SettingsSelect
                    label="Run Mode"
                    options={["Run Everything (Unsandboxed)"]}
                    value="Run Everything (Unsandboxed)"
                  />
                  <a
                    className="settings-learn-more"
                    href="https://cursor.com/docs/agent/security/run-modes"
                    onClick={(event) => {
                      event.preventDefault();
                      void window.codexDesktop.openExternal(
                        event.currentTarget.href,
                      );
                    }}
                  >
                    Learn more
                  </a>
                </div>
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Terminal and Editing</h2>
              <SettingsRow
                description="Use the legacy terminal tool in agent mode, for use on systems with unsupported shell configurations"
                title="Legacy Terminal Tool"
              >
                <SettingsToggle label="Legacy Terminal Tool" />
              </SettingsRow>
              <SettingsRow
                description="Automatically parse links when pasted into Quick Edit (⌘K) input"
                title="Auto-Parse Links"
              >
                <SettingsToggle label="Auto-Parse Links" />
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Models" ? (
          <>
            <h1>Models</h1>
            <p className="settings-muted">
              Choose which models appear in the model picker
            </p>
            <section className="settings-section">
              <h2 aria-level={3}>Task Models</h2>
              <SettingsRow
                description="Choose a model or use the cost- and availability-aware default"
                title="Explore Subagent Model"
              >
                <SettingsSelect
                  label="Explore Subagent Model"
                  options={["Default"]}
                  value="Default"
                />
                <button
                  aria-label="About the default Explore model"
                  className="settings-model-about"
                >
                  <CircleHelp aria-hidden="true" size={12} />
                </button>
              </SettingsRow>
            </section>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-hidden="true">Models</h2>
              <div className="settings-model-tools">
                <Search size={13} />
                <input
                  aria-label="Add or search model"
                  placeholder="Add or search model"
                />
                <button
                  aria-label="Refresh model list"
                  className="button-secondary"
                  onClick={() => controller.addToast("Model list refreshed.")}
                  title="Refresh model list"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              {[
                ...(
                  [
                    ["Cursor Grok 4.5", true],
                    ["Composer 2.5", true],
                    ["Opus 5", true],
                    ["GPT-5.6 Sol", true],
                    ["Fable 5", true],
                    ["Sonnet 5", true],
                    ["GPT-5.6 Terra", true],
                    ["Cursor Grok 4.6", false],
                    ["Opus 4.8", false],
                    ["GPT-5.5", false],
                  ] as const
                ).map(([name, enabled]) => ({
                  description: "Available in this workspace",
                  enabled,
                  id: name,
                  name,
                })),
                ...controller.models.map((model) => ({
                  description:
                    model.description ?? "Available in this workspace",
                  enabled: true,
                  id: model.id,
                  name: model.displayName ?? model.id,
                })),
              ]
                .filter(
                  (model, index, models) =>
                    models.findIndex(
                      (candidate) => candidate.name === model.name,
                    ) === index,
                )
                .map((model) => (
                  <div className="settings-model-row" key={model.id}>
                    <span>
                      <strong>{model.name}</strong>
                    </span>
                    <SettingsToggle
                      checked={Boolean(model.enabled)}
                      label={model.name}
                    />
                  </div>
                ))}
              <button
                className="settings-view-all-models"
                onClick={() => controller.addToast("All models opened.")}
              >
                View All Models
              </button>
              <button
                className="settings-api-keys"
                onClick={() =>
                  controller.addToast("API keys are managed by the app server.")
                }
              >
                <ChevronRight aria-hidden="true" size={13} /> API Keys
              </button>
            </section>
          </>
        ) : activeSection === "Git & PRs" ? (
          <>
            <h1>Git &amp; PRs</h1>
            <section className="settings-section">
              <h2 aria-level={3}>Pull Requests</h2>
              <SettingsRow
                description="Choose GitHub or Graphite for pull request links on web and desktop"
                title="Review Provider"
              >
                <SettingsSelect
                  label="Review Provider"
                  options={["GitHub", "Graphite"]}
                  value="GitHub"
                />
              </SettingsRow>
              <SettingsRow
                description="Open pull request links inside Cursor or in the default browser"
                title="PR Link Destination"
              >
                <SettingsSelect
                  label="PR Link Destination"
                  options={["Inside Cursor", "Default Browser"]}
                  value="Inside Cursor"
                />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Attribution</h2>
              <SettingsRow
                description="Mark Agent commits as 'Made with Cursor'"
                title="Commit Attribution"
              >
                <SettingsToggle checked label="Commit Attribution" />
              </SettingsRow>
              <SettingsRow
                description="Mark pull requests as made with Cursor"
                title="PR Attribution"
              >
                <SettingsToggle checked label="PR Attribution" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Branches</h2>
              <SettingsRow
                description="Prefix for new branches created by Agent (e.g., cursor/, username/)"
                title="Branch Prefix"
              >
                <input aria-label="Branch Prefix" placeholder="cursor/" />
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Worktrees" ? (
          <>
            <h1 className="settings-worktrees-heading">Worktrees</h1>
            <section className="settings-section settings-worktrees-cleanup">
              <h2 aria-level={3}>Cleanup</h2>
              <p className="settings-muted settings-worktree-intro">
                Cursor periodically removes old worktrees to free disk space.
                Tune how aggressively cleanup runs.
              </p>
              <SettingsRow
                description="Maximum number of Cursor-managed worktrees to retain across all workspaces. Older worktrees are removed first."
                title="Max Worktrees"
              >
                <Stepper label="Max Worktrees" value={25} />
              </SettingsRow>
              <SettingsRow
                description="Maximum total size in GB across all Cursor-managed worktrees. Set to 0 to disable the size limit."
                title="Max Total Size (GB)"
              >
                <Stepper label="Max Total Size (GB)" value={50} />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Cursor-Managed Worktrees</h2>
              <p className="settings-muted settings-worktree-count">
                {managedWorktrees?.length ?? 0} worktrees
              </p>
              {managedWorktrees && managedWorktrees.length > 0 ? (
                <div className="settings-worktree-source">
                  <strong>Source repository unknown</strong>
                  <div
                    aria-label="Cursor-managed worktrees grouped by source repository"
                    className="settings-worktree-list"
                  >
                    {managedWorktrees.map((worktree) => {
                      const displayPath = worktree.path.replace(
                        /^\/Users\/[^/]+/,
                        "~",
                      );
                      return (
                        <div
                          className="settings-worktree-row"
                          key={worktree.path}
                        >
                          <div className="settings-worktree-info">
                            <span
                              className="settings-worktree-path"
                              title={worktree.path}
                            >
                              <GitBranch aria-hidden="true" size={11} />
                              {displayPath}
                            </span>
                            <small>No linked agents</small>
                          </div>
                          <span>({relativeAge(worktree.modifiedAtMs)})</span>
                          <button
                            aria-label={`Delete worktree at ${worktree.path}`}
                            className="settings-worktree-delete"
                            onClick={() =>
                              controller.addToast(
                                "Open the worktree in Cursor to remove it safely.",
                              )
                            }
                          >
                            <Trash2 aria-hidden="true" size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="settings-empty-worktrees">
                  No linked worktrees
                </div>
              )}
            </section>
          </>
        ) : activeSection === "Browser & Network" ? (
          <>
            <h1>Browser &amp; Network</h1>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-hidden="true">Browser</h2>
              <SettingsRow
                description="Connected to Browser Tab"
                title="Browser Automation"
              >
                <SettingsSelect
                  label="Browser Automation"
                  options={["Browser Tab", "Disabled"]}
                  value="Browser Tab"
                />
              </SettingsRow>
              <SettingsRow
                description="Prevent Agent from automatically running Browser tools"
                title="Browser Protection"
              >
                <SettingsToggle label="Browser Protection" />
              </SettingsRow>
              <SettingsRow
                description="Automatically open localhost links in the Browser Tab"
                title="Open Local Links in Cursor Browser"
              >
                <SettingsToggle
                  checked
                  label="Open Local Links in Cursor Browser"
                />
              </SettingsRow>
              <SettingsRow
                description="Automatically open http and https links in the Browser Tab"
                title="Open Web Links in Cursor Browser"
              >
                <SettingsToggle label="Open Web Links in Cursor Browser" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Network</h2>
              <SettingsRow
                description="HTTP/2 is recommended for low-latency streaming. In some corporate proxy and VPN environments, the compatibility mode may need to be lowered."
                title="HTTP Compatibility Mode"
              >
                <SettingsSelect
                  label="HTTP Compatibility Mode"
                  options={["HTTP/2", "HTTP/1.1"]}
                  value="HTTP/2"
                />
              </SettingsRow>
              <SettingsRow
                description="These domains must be accessible for Cursor to function. Add them to your firewall or proxy allowlist."
                title="Required Domains"
              >
                <button
                  className="button-secondary"
                  onClick={() => controller.addToast("Domains copied.")}
                >
                  Copy Domains
                </button>
                <button
                  className="button-secondary"
                  onClick={() => controller.addToast("Required domains shown.")}
                >
                  Show
                </button>
              </SettingsRow>
              <SettingsRow
                description="Check network connectivity to all Cursor services"
                title="Network Diagnostics"
              >
                <button
                  className="button-secondary"
                  onClick={() =>
                    controller.addToast("Network diagnostic complete.")
                  }
                >
                  Run Diagnostic
                </button>
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Tab" ? (
          <>
            <h1>Tab</h1>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-hidden="true">Cursor Tab</h2>
              <SettingsRow
                description="Context-aware, multi-line suggestions around your cursor based on recent edits"
                title="Cursor Tab"
              >
                <SettingsToggle label="Cursor Tab" />
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Code Intelligence" ? (
          <>
            <h1>Code Intelligence</h1>
            <section className="settings-section">
              <h2 aria-level={3}>Codebase</h2>
              <SettingsRow
                description="Automatically index repositories to speed up Grep searches. All data is stored locally."
                title="Index Repositories for Instant Grep"
              >
                <SettingsToggle
                  checked
                  label="Index Repositories for Instant Grep"
                />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>Ignore Files</h2>
              <SettingsRow
                description="Apply .cursorignore files to all subdirectories. Changing this setting requires restarting Cursor."
                title="Hierarchical Cursor Ignore"
              >
                <SettingsToggle label="Hierarchical Cursor Ignore" />
              </SettingsRow>
              <SettingsRow
                description="Use with caution. Skip symlinks during .cursorignore file discovery. Enable only when all .cursorignore files are reachable without symlinks. Changing this setting requires restarting Cursor."
                title="Ignore Symlinks in Cursor Ignore Search"
              >
                <SettingsToggle label="Ignore Symlinks in Cursor Ignore Search" />
              </SettingsRow>
            </section>
            <section className="settings-section">
              <h2 aria-level={3}>LSP</h2>
              <SettingsRow
                description="Enable language server by default to provide code intelligence in workspaces"
                title="Enable LSPs"
              >
                <SettingsToggle checked label="Enable LSPs" />
              </SettingsRow>
              <SettingsRow
                description="Enable language server by default to provide code intelligence in agent worktree workspaces"
                title="Enable LSPs for Worktrees"
              >
                <SettingsToggle label="Enable LSPs for Worktrees" />
              </SettingsRow>
              <SettingsRow
                description="Maximum local workspaces that can run language servers at the same time"
                title="Maximum Local LSP Workspaces"
              >
                <Stepper label="Maximum Local LSP Workspaces" value={3} />
              </SettingsRow>
              <SettingsRow
                description="Maximum remote workspaces that can run language servers at the same time"
                title="Maximum Remote LSP Workspaces"
              >
                <Stepper label="Maximum Remote LSP Workspaces" value={3} />
              </SettingsRow>
            </section>
          </>
        ) : activeSection === "Beta" ? (
          <>
            <h1>Beta</h1>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-hidden="true">Updates</h2>
              <SettingsRow
                description="By default, get notifications for stable updates. In Early Access, pre-release builds may be unstable for production work."
                title="Update Access"
              >
                <SettingsSelect
                  label="Update Access"
                  options={["Default", "Early Access"]}
                  value="Default"
                />
              </SettingsRow>
            </section>
            <section className="settings-section settings-section-label-hidden">
              <h2 aria-level={3}>Interrupted agents</h2>
              <SettingsRow
                description="When Cursor closes while an agent is working, pick the agent back up the next time you open Cursor."
                title="Continue interrupted agents on relaunch"
              >
                <SettingsToggle
                  checked
                  label="Continue interrupted agents on relaunch"
                />
              </SettingsRow>
            </section>
          </>
        ) : (
          <div className="settings-placeholder">
            <h1>{activeSection}</h1>
            <p>
              This Codex setting is ready for configuration in the next panel.
            </p>
          </div>
        )}
        {activeSection === "General" ? (
          <button className="settings-logout" onClick={() => void logout()}>
            <LogOut size={13} /> Log Out
          </button>
        ) : null}
      </section>
    </main>
  );
}
