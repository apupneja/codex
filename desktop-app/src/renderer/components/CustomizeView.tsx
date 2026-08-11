import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Folder,
  Globe2,
  Package,
  PanelRight,
  Power,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AppsListResponse,
  JsonObject,
  PluginInstallResponse,
  PluginListResponse,
  SkillMetadata,
  SkillsConfigWriteResponse,
  SkillsListResponse,
} from "../../shared/types";
import { MenuSurface } from "../design-system";
import type { CodexController } from "../state/useCodexController";

type UtilityProps = { controller: CodexController };

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
type CatalogTab =
  | "apps"
  | "commands"
  | "hooks"
  | "plugins"
  | "rules"
  | "skills"
  | "subagents";

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
    commands: [],
    hooks: [],
    plugins: [],
    rules: [],
    skills: [],
    apps: [],
    subagents: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
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

        setItems({
          apps,
          commands: [],
          hooks: [],
          plugins,
          rules: [],
          skills,
          subagents: [],
        });
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
  const scopeOwner = "Anirudh Pupneja";
  const scopeLabel = `${scopeOwner} +1`;
  const tabLabel: Record<CatalogTab, string> = {
    apps: "MCPs",
    commands: "Commands",
    hooks: "Hooks",
    plugins: "Plugins",
    rules: "Rules",
    skills: "Skills",
    subagents: "Subagents",
  };
  const tabIntro: Record<
    CatalogTab,
    { description: string; docsUrl: string; title: string }
  > = {
    apps: {
      description:
        "Model Context Protocol servers connect Cursor to external tools and data sources like Linear, Figma, and Notion.",
      docsUrl: "https://cursor.com/docs/mcp",
      title: "Connect External Tools with MCP",
    },
    commands: {
      description:
        "Commands are reusable prompts you invoke with /name to standardize common workflows across your team.",
      docsUrl: "https://cursor.com/docs/agent/chat/commands",
      title: "Create Reusable Commands",
    },
    hooks: {
      description:
        "Hooks run custom scripts at lifecycle events to observe, control, and extend the agent loop.",
      docsUrl: "https://cursor.com/docs/hooks",
      title: "Automate with Hooks",
    },
    plugins: {
      description:
        "Plugins bundle rules, skills, subagents, commands, MCP servers, and hooks into one installable package.",
      docsUrl: "https://cursor.com/docs/plugins",
      title: "Extend Cursor with Plugins",
    },
    rules: {
      description:
        "Rules give Agent persistent, system-level instructions for your coding standards and workflows.",
      docsUrl: "https://cursor.com/docs/rules",
      title: "Guide Agent with Rules",
    },
    skills: {
      description:
        "Skills package domain-specific knowledge and workflows that Agent applies automatically when relevant.",
      docsUrl: "https://cursor.com/docs/skills",
      title: "Teach Cursor New Skills",
    },
    subagents: {
      description:
        "Subagents are specialized assistants that run in their own context window so Agent can parallelize and stay focused.",
      docsUrl: "https://cursor.com/docs/agent/subagents",
      title: "Delegate Work to Subagents",
    },
  };

  return (
    <main className="utility-view customize-view">
      <div className="utility-route-actions">
        <button
          className="utility-ide-link"
          onClick={() => controller.setView("new")}
        >
          IDE <ExternalLink size={12} />
        </button>
        <button
          aria-label="Show Apps"
          className="icon-button subtle"
          onClick={() => controller.setView("new")}
        >
          <PanelRight size={15} />
        </button>
      </div>
      <header className="customize-toolbar">
        <label>
          <Search size={14} />
          <input
            aria-label={`Search ${tabLabel[tab]} for Selected Sources...`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${tabLabel[tab]} for Selected Sources...`}
            value={query}
          />
        </label>
        <button
          className="button-primary customize-marketplace"
          onClick={() =>
            void window.codexDesktop
              .openExternal("https://cursor.com/marketplace")
              .catch((error: unknown) =>
                controller.addToast(messageForError(error), "danger"),
              )
          }
        >
          Browse Marketplace
        </button>
      </header>
      <div className="customize-tabs">
        <button
          aria-label="Manage scope"
          aria-expanded={scopeOpen}
          aria-haspopup="menu"
          className="customize-scope"
          onClick={() => setScopeOpen((open) => !open)}
          title="Manage scope"
        >
          <Globe2 aria-hidden="true" size={12} />
          <span>{scopeLabel}</span>
          <ChevronDown size={12} />
        </button>
        {scopeOpen ? (
          <MenuSurface className="customize-scope-menu" role="menu">
            <button
              className="customize-scope-user"
              onClick={() => setScopeOpen(false)}
            >
              <UserRound aria-hidden="true" size={13} />
              <span>
                <strong>User</strong>
                <small>{scopeOwner}</small>
              </span>
              <Check aria-hidden="true" size={12} />
            </button>
            <strong>Workspaces</strong>
            {controller.preferences.recentWorkspaces
              .slice(0, 4)
              .map((recent) => (
                <button key={recent} onClick={() => setScopeOpen(false)}>
                  <Folder aria-hidden="true" size={12} />
                  {recent.split(/[\\/]/).filter(Boolean).pop() ?? recent}
                </button>
              ))}
            {controller.preferences.recentWorkspaces.length > 4 ? (
              <span className="customize-scope-more">
                {controller.preferences.recentWorkspaces.length - 4} more
              </span>
            ) : null}
            {controller.preferences.recentWorkspaces.length === 0 ? (
              <span>No workspaces configured</span>
            ) : null}
          </MenuSurface>
        ) : null}
        {(
          [
            ["plugins", "Plugins"],
            ["apps", "MCPs"],
            ["skills", "Skills"],
            ["subagents", "Subagents"],
            ["rules", "Rules"],
            ["commands", "Commands"],
            ["hooks", "Hooks"],
          ] as const
        ).map(([name, label]) => (
          <button
            aria-pressed={tab === name}
            className={tab === name ? "active" : ""}
            key={name}
            onClick={() => {
              setTab(name);
              setAddOpen(false);
              setViewOptionsOpen(false);
            }}
          >
            {label}
          </button>
        ))}
        {tab !== "plugins" && tab !== "hooks" ? (
          <span className="customize-view-options-wrap">
            <button
              aria-expanded={viewOptionsOpen}
              aria-haspopup="menu"
              aria-label="View options"
              className="customize-view-options"
              onClick={() => setViewOptionsOpen((open) => !open)}
            >
              <SlidersHorizontal aria-hidden="true" size={12} />
            </button>
            {viewOptionsOpen ? (
              <MenuSurface
                className="customize-view-options-menu"
                role="menu"
              >
                {["Group By", "Filter By", "Sort By"].map((label) => (
                  <button key={label} role="menuitem">
                    {label} <ChevronRight aria-hidden="true" size={12} />
                  </button>
                ))}
              </MenuSurface>
            ) : null}
          </span>
        ) : null}
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
            {filtered.length === 0 ? (
              <div className="customize-intro">
                <strong>{tabIntro[tab].title}</strong>
                <p>{tabIntro[tab].description}</p>
                <div>
                  {tab === "plugins" ? (
                    <span
                      className="customize-add-wrap"
                      onBlur={(event) => {
                        if (
                          !event.currentTarget.contains(event.relatedTarget)
                        ) {
                          setAddOpen(false);
                        }
                      }}
                    >
                      <button
                        aria-expanded={addOpen}
                        aria-haspopup="menu"
                        className="button-primary"
                        onClick={() => setAddOpen((open) => !open)}
                      >
                        + Add
                      </button>
                      {addOpen ? (
                        <MenuSurface className="customize-add-menu" role="menu">
                          <button
                            onClick={() => {
                              setAddOpen(false);
                              void window.codexDesktop
                                .openExternal("https://cursor.com/marketplace")
                                .catch((error: unknown) =>
                                  controller.addToast(
                                    messageForError(error),
                                    "danger",
                                  ),
                                );
                            }}
                            role="menuitem"
                          >
                            From Marketplace
                          </button>
                          <button
                            onClick={() => {
                              setAddOpen(false);
                              controller.addToast(
                                "Choose a local plugin repository to add it to Cursor.",
                              );
                            }}
                            role="menuitem"
                          >
                            From Local Repo
                          </button>
                        </MenuSurface>
                      ) : null}
                    </span>
                  ) : tab === "apps" || tab === "skills" ? (
                    <button
                      className="button-primary"
                      onClick={() =>
                        controller.addToast(
                          `New ${tabLabel[tab]} source opened.`,
                        )
                      }
                    >
                      + New
                    </button>
                  ) : tab === "hooks" ? (
                    <button
                      className="button-primary"
                      onClick={() => controller.addToast("Hook config opened.")}
                    >
                      Open config
                    </button>
                  ) : (
                    <button
                      className="button-primary"
                      onClick={() =>
                        void window.codexDesktop.openExternal(
                          "https://cursor.com/marketplace",
                        )
                      }
                    >
                      Browse Marketplace
                    </button>
                  )}
                  <button
                    className="button-secondary"
                    onClick={() =>
                      void window.codexDesktop.openExternal(
                        tabIntro[tab].docsUrl,
                      )
                    }
                  >
                    Documentation
                  </button>
                </div>
              </div>
            ) : null}
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
          </section>
        </>
      )}
    </main>
  );
}
