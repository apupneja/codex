import {
  Blocks,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  Globe2,
  KeyRound,
  ListChecks,
  LogOut,
  Package,
  Play,
  Power,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AppsListResponse,
  DesktopPreferences,
  JsonObject,
  PluginInstallResponse,
  PluginListResponse,
  SkillMetadata,
  SkillsConfigWriteResponse,
  SkillsListResponse,
} from "../../shared/types";
import type { CodexController } from "../state/useCodexController";

type UtilityProps = { controller: CodexController };

const AUTOMATIONS = [
  {
    icon: ShieldCheck,
    title: "Repository health check",
    description:
      "Review tests, dependencies, security-sensitive changes, and the highest-impact maintenance work.",
    prompt:
      "Run a comprehensive repository health check. Inspect tests, dependencies, security risks, and maintenance debt, then implement the highest-impact safe improvement.",
  },
  {
    icon: ListChecks,
    title: "Review current changes",
    description:
      "Inspect the current diff for correctness, regressions, missing coverage, and production risks.",
    prompt:
      "Review all current uncommitted changes. Find correctness issues, regressions, security risks, and missing tests. Fix confirmed issues and validate the result.",
  },
  {
    icon: RefreshCw,
    title: "Repair failing checks",
    description:
      "Run targeted checks, diagnose failures, and repair the smallest safe scope.",
    prompt:
      "Run the repository's targeted checks, diagnose any failures, implement the smallest correct fixes, and rerun validation.",
  },
];

export function AutomationsView({ controller }: UtilityProps) {
  return (
    <main className="utility-view">
      <header className="utility-header">
        <span>
          <Workflow size={18} />
        </span>
        <div>
          <h1>Automations</h1>
          <p>Reusable agent workflows for the repository you have open.</p>
        </div>
        <button className="button-primary" onClick={controller.newTask}>
          <Sparkles size={14} /> New task
        </button>
      </header>
      <div className="automation-hero">
        <div className="automation-orbit">
          <Bot size={28} />
          <i />
          <i />
          <i />
        </div>
        <div>
          <h2>Turn repeat work into one click</h2>
          <p>
            Each workflow starts a real Codex task with your current model,
            permissions, and repository context.
          </p>
        </div>
      </div>
      <section className="automation-grid">
        {AUTOMATIONS.map((automation) => {
          const Icon = automation.icon;
          return (
            <article className="automation-card" key={automation.title}>
              <span>
                <Icon size={17} />
              </span>
              <h3>{automation.title}</h3>
              <p>{automation.description}</p>
              <footer>
                <span>
                  <Clock3 size={12} /> On demand
                </span>
                <button
                  onClick={() => {
                    controller.newTask();
                    void controller.submitPrompt(automation.prompt);
                  }}
                >
                  <Play size={13} /> Run now
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </main>
  );
}

type CatalogAction =
  | {
      marketplacePath: string | null;
      pluginName: string;
      remoteMarketplaceName: string | null;
      type: "install-plugin";
    }
  | { pluginId: string; type: "remove-plugin" }
  | { enabled: boolean; path: string; type: "toggle-skill" }
  | { type: "open-app"; url: string };

type CatalogItem = {
  action?: CatalogAction;
  actionLabel?: string;
  badge: string;
  description: string;
  id: string;
  name: string;
  enabled: boolean;
  statusLabel: string;
};
type CatalogTab = "apps" | "plugins" | "skills";

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unavailableReason(value: string | null): string {
  if (!value) return "Unavailable";
  return value.replaceAll("_", " ");
}

export function CustomizeView({ controller }: UtilityProps) {
  const [tab, setTab] = useState<CatalogTab>("plugins");
  const [items, setItems] = useState<Record<CatalogTab, CatalogItem[]>>({
    plugins: [],
    skills: [],
    apps: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const loadGeneration = useRef(0);
  const cwd =
    controller.activeThread?.cwd ?? controller.preferences.lastWorkspace;
  const threadId = controller.activeThread?.id ?? null;

  const loadCatalog = useCallback(
    async (forceRefresh = false) => {
      const generation = ++loadGeneration.current;
      setLoading(true);
      setLoadError(null);
      if (controller.runtime.phase !== "ready") {
        if (
          controller.runtime.phase !== "starting" &&
          controller.runtime.phase !== "restarting"
        ) {
          setLoading(false);
          setLoadError("The Codex runtime is unavailable.");
        }
        return;
      }
      try {
        const results = await Promise.allSettled([
          window.codexDesktop.request<PluginListResponse>("plugin/list", {
            cwds: cwd ? [cwd] : [],
            forceRefetch: forceRefresh,
          }),
          window.codexDesktop.request<SkillsListResponse>("skills/list", {
            cwds: cwd ? [cwd] : [],
            forceReload: forceRefresh,
          }),
          window.codexDesktop.request<AppsListResponse>("app/list", {
            forceRefetch: forceRefresh,
            limit: 100,
            threadId,
          }),
        ]);
        if (generation !== loadGeneration.current) return;

        const errors: string[] = [];
        const pluginResult = results[0];
        const plugins: CatalogItem[] = [];
        if (pluginResult.status === "fulfilled") {
          for (const marketplace of pluginResult.value.marketplaces) {
            for (const plugin of marketplace.plugins) {
              const installedByDefault =
                plugin.installPolicy === "INSTALLED_BY_DEFAULT";
              const canInstall =
                !plugin.installed &&
                plugin.installPolicy === "AVAILABLE" &&
                plugin.availability === "AVAILABLE";
              const canRemove = plugin.installed && !installedByDefault;
              let action: CatalogAction | undefined;
              let actionLabel: string | undefined;
              if (canInstall) {
                const remotePluginName = plugin.remotePluginId ?? plugin.name;
                action = {
                  marketplacePath: marketplace.path,
                  pluginName: marketplace.path ? plugin.name : remotePluginName,
                  remoteMarketplaceName: marketplace.path
                    ? null
                    : marketplace.name,
                  type: "install-plugin",
                };
                actionLabel = "Install";
              } else if (canRemove) {
                action = {
                  pluginId: plugin.remotePluginId ?? plugin.id,
                  type: "remove-plugin",
                };
                actionLabel = "Remove";
              }
              const displayName = plugin.interface?.displayName ?? plugin.name;
              const unavailable = unavailableReason(plugin.disabledReason);
              plugins.push({
                action,
                actionLabel,
                badge: installedByDefault
                  ? "Built in"
                  : plugin.installed
                    ? plugin.enabled
                      ? "Installed · enabled"
                      : "Installed · disabled"
                    : canInstall
                      ? "Available"
                      : unavailable,
                description:
                  plugin.interface?.shortDescription ??
                  plugin.interface?.longDescription ??
                  "Codex plugin",
                enabled: plugin.enabled,
                id: plugin.id,
                name: displayName,
                statusLabel: installedByDefault
                  ? "Built in"
                  : plugin.enabled
                    ? "Enabled"
                    : unavailable,
              });
            }
          }
          errors.push(
            ...(pluginResult.value.marketplaceLoadErrors ?? []).map(
              (error) => error.message,
            ),
          );
        } else {
          errors.push(`Plugins: ${messageForError(pluginResult.reason)}`);
        }

        const skillsResult = results[1];
        const skillsByPath = new Map<string, SkillMetadata>();
        if (skillsResult.status === "fulfilled") {
          for (const entry of skillsResult.value.data) {
            for (const skill of entry.skills) {
              skillsByPath.set(skill.path, skill);
            }
            errors.push(...entry.errors.map((error) => error.message));
          }
        } else {
          errors.push(`Skills: ${messageForError(skillsResult.reason)}`);
        }
        const skills: CatalogItem[] = [...skillsByPath.values()].map(
          (skill) => ({
            action: {
              enabled: !skill.enabled,
              path: skill.path,
              type: "toggle-skill",
            },
            actionLabel: skill.enabled ? "Disable" : "Enable",
            badge: `${skill.scope} skill`,
            description:
              skill.interface?.shortDescription ??
              skill.shortDescription ??
              skill.description,
            enabled: skill.enabled,
            id: skill.path,
            name: skill.interface?.displayName ?? skill.name,
            statusLabel: skill.enabled ? "Enabled" : "Disabled",
          }),
        );

        const appsResult = results[2];
        let apps: CatalogItem[] = [];
        if (appsResult.status === "fulfilled") {
          apps = appsResult.value.data.map((app) => {
            const connected = app.isAccessible && app.isEnabled;
            const actionLabel = app.installUrl
              ? app.isAccessible
                ? "Manage"
                : "Connect"
              : undefined;
            return {
              action: app.installUrl
                ? { type: "open-app" as const, url: app.installUrl }
                : undefined,
              actionLabel,
              badge: app.isAccessible
                ? app.isEnabled
                  ? "Connected"
                  : "Connected · disabled"
                : "Connection required",
              description: app.description ?? "Connected app",
              enabled: connected,
              id: app.id,
              name: app.name,
              statusLabel: connected ? "Connected" : "Unavailable",
            };
          });
        } else {
          errors.push(`Apps: ${messageForError(appsResult.reason)}`);
        }

        setItems({ plugins, skills, apps });
        setLoadError(errors.length ? errors.slice(0, 3).join(" · ") : null);
      } catch (error) {
        if (generation === loadGeneration.current) {
          setLoadError(messageForError(error));
        }
      } finally {
        if (generation === loadGeneration.current) {
          setLoading(false);
        }
      }
    },
    [controller.runtime.phase, cwd, threadId],
  );

  useEffect(() => {
    void loadCatalog();
    return () => {
      loadGeneration.current += 1;
    };
  }, [loadCatalog]);

  async function runCatalogAction(item: CatalogItem): Promise<void> {
    const action = item.action;
    if (!action || busyItems.has(item.id)) return;

    if (
      action.type === "install-plugin" &&
      !window.confirm(
        `Install ${item.name}?\n\nPlugins can add skills, tools, hooks, and connected apps to Codex.`,
      )
    ) {
      return;
    }
    if (
      action.type === "remove-plugin" &&
      !window.confirm(`Remove ${item.name} from Codex?`)
    ) {
      return;
    }

    setBusyItems((current) => new Set(current).add(item.id));
    setLoadError(null);
    try {
      if (action.type === "install-plugin") {
        const params: JsonObject = { pluginName: action.pluginName };
        if (action.marketplacePath) {
          params.marketplacePath = action.marketplacePath;
        } else if (action.remoteMarketplaceName) {
          params.remoteMarketplaceName = action.remoteMarketplaceName;
        } else {
          throw new Error("The plugin has no install source.");
        }
        const response =
          await window.codexDesktop.request<PluginInstallResponse>(
            "plugin/install",
            params,
          );
        const authenticationCount = response.appsNeedingAuth?.length ?? 0;
        controller.addToast(
          authenticationCount
            ? `Installed ${item.name}. ${authenticationCount} connected ${authenticationCount === 1 ? "app needs" : "apps need"} authentication.`
            : `Installed ${item.name}`,
          "success",
        );
      } else if (action.type === "remove-plugin") {
        await window.codexDesktop.request("plugin/uninstall", {
          pluginId: action.pluginId,
        });
        controller.addToast(`Removed ${item.name}`, "success");
      } else if (action.type === "toggle-skill") {
        const response =
          await window.codexDesktop.request<SkillsConfigWriteResponse>(
            "skills/config/write",
            {
              enabled: action.enabled,
              name: null,
              path: action.path,
            },
          );
        const effectiveEnabled = response.effectiveEnabled ?? action.enabled;
        controller.addToast(
          `${item.name} ${effectiveEnabled ? "enabled" : "disabled"}`,
          "success",
        );
      } else {
        await window.codexDesktop.openExternal(action.url);
        return;
      }
      await loadCatalog(true);
    } catch (error) {
      const message = messageForError(error);
      setLoadError(message);
      controller.addToast(
        `Could not update ${item.name}: ${message}`,
        "danger",
      );
    } finally {
      setBusyItems((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  const filtered = useMemo(
    () =>
      items[tab].filter((item) =>
        `${item.name} ${item.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query, tab],
  );

  return (
    <main className="utility-view customize-view">
      <header className="utility-header">
        <span>
          <Blocks size={18} />
        </span>
        <div>
          <h1>Customize</h1>
          <p>Extend Codex with plugins, skills, and connected apps.</p>
        </div>
        <button
          aria-label="Open Codex documentation"
          className="button-secondary"
          onClick={() =>
            void window.codexDesktop
              .openExternal("https://developers.openai.com/codex/")
              .catch((error: unknown) =>
                controller.addToast(messageForError(error), "danger"),
              )
          }
        >
          Documentation <ExternalLink size={13} />
        </button>
      </header>
      <div className="catalog-controls">
        <label>
          <Globe2 size={14} />
          <input
            aria-label="Search plugins, skills, and connected apps"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search extensions…"
            value={query}
          />
        </label>
        <nav aria-label="Customize categories">
          {(["plugins", "skills", "apps"] as const).map((name) => (
            <button
              aria-pressed={tab === name}
              className={tab === name ? "active" : ""}
              key={name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
          <button
            aria-label="Refresh plugins, skills, and connected apps"
            disabled={loading}
            onClick={() => void loadCatalog(true)}
            title="Refresh extension catalog"
          >
            <RefreshCw className={loading ? "spin" : ""} size={12} /> Refresh
          </button>
        </nav>
      </div>
      {loading ? (
        <div
          aria-label="Loading plugins, skills, and connected apps"
          className="catalog-loading"
          role="status"
        >
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          {loadError ? (
            <section className="catalog-grid">
              <div className="catalog-empty" role="alert">
                <Package size={24} />
                <h3>Some extensions could not be loaded</h3>
                <p>{loadError}</p>
                <button
                  aria-label="Retry loading extensions"
                  className="button-secondary"
                  onClick={() => void loadCatalog(true)}
                >
                  <RefreshCw size={13} /> Retry
                </button>
              </div>
            </section>
          ) : null}
          <section className="catalog-grid">
            {filtered.map((item) => {
              const busy = busyItems.has(item.id);
              const ActionIcon =
                item.action?.type === "install-plugin"
                  ? Download
                  : item.action?.type === "remove-plugin"
                    ? Trash2
                    : item.action?.type === "toggle-skill"
                      ? Power
                      : ExternalLink;
              return (
                <article className="catalog-card" key={item.id}>
                  <span className="catalog-icon">
                    {tab === "plugins" ? (
                      <Package size={18} />
                    ) : tab === "skills" ? (
                      <WandSparkles size={18} />
                    ) : (
                      <Globe2 size={18} />
                    )}
                  </span>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <small>{item.badge}</small>
                  </div>
                  {item.action && item.actionLabel ? (
                    <button
                      aria-label={`${item.actionLabel} ${item.name}`}
                      className="button-secondary"
                      disabled={busy || controller.runtime.phase !== "ready"}
                      onClick={() => void runCatalogAction(item)}
                    >
                      {busy ? (
                        <RefreshCw className="spin" size={13} />
                      ) : (
                        <ActionIcon size={13} />
                      )}
                      {busy ? "Working…" : item.actionLabel}
                    </button>
                  ) : (
                    <span
                      className={`availability ${item.enabled ? "enabled" : ""}`}
                    >
                      {item.enabled ? <CheckCircle2 size={13} /> : null}
                      {item.statusLabel}
                    </span>
                  )}
                </article>
              );
            })}
            {filtered.length === 0 ? (
              <div className="catalog-empty">
                <Package size={24} />
                <h3>No {tab} found</h3>
                <p>Refresh the catalog or try another search.</p>
              </div>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}

function SettingsRow({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
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

export function SettingsView({ controller }: UtilityProps) {
  const [loggingIn, setLoggingIn] = useState(false);
  const identity =
    controller.account?.type === "chatgpt"
      ? (controller.account.email ?? "ChatGPT")
      : controller.account?.type === "apiKey"
        ? "API key"
        : controller.account?.type === "amazonBedrock"
          ? "Amazon Bedrock"
          : "Not signed in";

  async function login(): Promise<void> {
    setLoggingIn(true);
    try {
      const response = await window.codexDesktop.request<{
        type: string;
        authUrl?: string;
      }>("account/login/start", {
        type: "chatgpt",
        codexStreamlinedLogin: true,
        useHostedLoginSuccessPage: true,
      });
      if (response.authUrl)
        await window.codexDesktop.openExternal(response.authUrl);
      controller.addToast(
        "Complete sign-in in your browser. Codex will update automatically.",
      );
    } catch (error) {
      controller.addToast(
        error instanceof Error ? error.message : String(error),
        "danger",
      );
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout(): Promise<void> {
    await window.codexDesktop.request("account/logout");
    controller.addToast("Signed out", "success");
  }

  return (
    <main className="utility-view settings-view">
      <header className="utility-header">
        <span>
          <Settings2 size={18} />
        </span>
        <div>
          <h1>Settings</h1>
          <p>
            Control your account, appearance, model behavior, and local safety
            defaults.
          </p>
        </div>
      </header>
      <section className="settings-section">
        <h2>Account</h2>
        <SettingsRow
          description="Authentication is stored and managed by the Codex CLI runtime."
          title={identity}
        >
          {controller.account ? (
            <button className="button-secondary" onClick={() => void logout()}>
              <LogOut size={13} /> Sign out
            </button>
          ) : (
            <button
              className="button-primary"
              disabled={loggingIn}
              onClick={() => void login()}
            >
              <KeyRound size={13} /> {loggingIn ? "Opening…" : "Sign in"}
            </button>
          )}
        </SettingsRow>
      </section>
      <section className="settings-section">
        <h2>Appearance</h2>
        <SettingsRow
          description="Follow the system or choose a persistent app theme."
          title="Theme"
        >
          <select
            value={controller.preferences.theme}
            onChange={(event) =>
              void controller.updatePreferences({
                theme: event.target.value as DesktopPreferences["theme"],
              })
            }
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </SettingsRow>
        <SettingsRow
          description="Changes the code editor without affecting the rest of the interface."
          title="Editor font size"
        >
          <input
            max="24"
            min="10"
            onChange={(event) =>
              void controller.updatePreferences({
                editorFontSize: Number(event.target.value),
              })
            }
            type="range"
            value={controller.preferences.editorFontSize}
          />
          <output>{controller.preferences.editorFontSize}px</output>
        </SettingsRow>
      </section>
      <section className="settings-section">
        <h2>Agent safety</h2>
        <SettingsRow
          description="Choose when Codex must pause before executing consequential actions."
          title="Approval policy"
        >
          <select
            value={controller.preferences.approvalPolicy}
            onChange={(event) =>
              void controller.updatePreferences({
                approvalPolicy: event.target
                  .value as DesktopPreferences["approvalPolicy"],
              })
            }
          >
            <option value="untrusted">Only untrusted actions</option>
            <option value="on-request">When Codex requests</option>
            <option value="never">Never ask</option>
          </select>
        </SettingsRow>
        <SettingsRow
          description="Controls which local files and directories commands can modify."
          title="Sandbox"
        >
          <select
            value={controller.preferences.sandbox}
            onChange={(event) =>
              void controller.updatePreferences({
                sandbox: event.target.value as DesktopPreferences["sandbox"],
              })
            }
          >
            <option value="read-only">Read only</option>
            <option value="workspace-write">Workspace write</option>
            <option value="danger-full-access">Full access</option>
          </select>
        </SettingsRow>
      </section>
      <section className="settings-section about-section">
        <div>
          <Code2 size={16} />
          <span>
            <strong>Codex Desktop</strong>
            <small>
              App server:{" "}
              {controller.runtime.initialized?.userAgent ??
                controller.runtime.phase}
            </small>
          </span>
        </div>
        <button
          className="button-secondary"
          onClick={() =>
            void window.codexDesktop.openExternal(
              "https://github.com/openai/codex",
            )
          }
        >
          View source <ChevronRight size={13} />
        </button>
      </section>
    </main>
  );
}
