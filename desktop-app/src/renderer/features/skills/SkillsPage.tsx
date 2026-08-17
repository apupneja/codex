import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ProjectClearIcon } from "../../ui/AppIcons";

type DirectorySection = "plugins" | "skills";
type PluginScope = "personal" | "public";

export function SkillsPage({
  onAddServer,
  onBackToManage,
  onCreatePlugin,
  onManage,
  page,
}: {
  onAddServer?(): void;
  onBackToManage?(): void;
  onCreatePlugin?(): void;
  onManage?(): void;
  page?: "add-server" | "manage";
}) {
  const [section, setSection] = useState<DirectorySection>("plugins");
  const [scope, setScope] = useState<PluginScope>("public");
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  useEffect(() => {
    if (section !== "skills") return;
    let current = true;
    setRefreshing(true);
    void window.chatgptDesktop
      .listSkills()
      .then((items) => {
        if (current) setSkills(items);
      })
      .finally(() => {
        if (current) setRefreshing(false);
      });
    return () => {
      current = false;
    };
  }, [refreshToken, section]);

  const chooseSection = (next: DirectorySection) => {
    setSection(next);
    setQuery("");
    setAddMenuOpen(false);
    setFilterMenuOpen(false);
  };
  const refresh = () => {
    setRefreshing(true);
    setRefreshToken((value) => value + 1);
    if (section === "plugins")
      window.setTimeout(() => setRefreshing(false), 450);
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSkills = skills.filter((skill) =>
    skill.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <>
      {page === "add-server" ? (
        <McpServerForm onBack={onBackToManage} />
      ) : page === "manage" ? (
        <ManagePluginsPage onAdd={onAddServer} />
      ) : (
        <main className="codex-route-page plugins-page">
          <nav aria-label="Plugin sections" className="route-titlebar-tabs">
            <button
              className={section === "plugins" ? "is-active" : ""}
              onClick={() => chooseSection("plugins")}
              type="button"
            >
              Plugins
            </button>
            <button
              className={section === "skills" ? "is-active" : ""}
              onClick={() => chooseSection("skills")}
              type="button"
            >
              Skills
            </button>
          </nav>

          <div className="route-titlebar-actions plugins-titlebar-actions">
            <button
              aria-label="Refresh"
              className={`route-titlebar-icon${refreshing ? " is-refreshing" : ""}`}
              onClick={refresh}
              type="button"
            >
              <RefreshCw aria-hidden="true" />
            </button>
            <button
              aria-label="Manage"
              className="route-titlebar-icon"
              onClick={onManage}
              type="button"
            >
              <Settings aria-hidden="true" />
            </button>
            <div className="plugins-menu-anchor">
              <button
                aria-expanded={addMenuOpen}
                aria-haspopup="menu"
                className="route-titlebar-add"
                onClick={() => {
                  setAddMenuOpen((value) => !value);
                  setFilterMenuOpen(false);
                }}
                type="button"
              >
                <span>Add</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {addMenuOpen && (
                <div className="plugins-popup plugins-add-popup" role="menu">
                  <button
                    onClick={() => {
                      setAddMenuOpen(false);
                      onCreatePlugin?.();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Create plugin
                  </button>
                  <button
                    onClick={() => {
                      setAddMenuOpen(false);
                      setMarketplaceOpen(true);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Add a marketplace
                  </button>
                </div>
              )}
            </div>
          </div>

          <header className="codex-route-page__header">
            <h1>{section === "plugins" ? "Plugins" : "Skills"}</h1>
            <p>
              {section === "plugins"
                ? "Work with ChatGPT across your favorite tools"
                : "Extend ChatGPT with task-specific skills"}
            </p>
          </header>

          <label className="route-search">
            <Search aria-hidden="true" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                section === "plugins" ? "Search plugins" : "Search skills"
              }
              value={query}
            />
          </label>

          {section === "plugins" ? (
            <>
              <div className="plugins-filters">
                <div className="plugins-filter-tabs">
                  <button
                    className={scope === "public" ? "is-active" : ""}
                    onClick={() => setScope("public")}
                    type="button"
                  >
                    Public
                  </button>
                  <button
                    className={scope === "personal" ? "is-active" : ""}
                    onClick={() => setScope("personal")}
                    type="button"
                  >
                    Personal
                  </button>
                </div>
                <div className="plugins-filter-anchor">
                  <button
                    aria-expanded={filterMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Filter sections"
                    className="plugins-filter-sections"
                    onClick={() => {
                      setFilterMenuOpen((value) => !value);
                      setAddMenuOpen(false);
                    }}
                    type="button"
                  >
                    <ListFilter aria-hidden="true" />
                  </button>
                  {filterMenuOpen && (
                    <div
                      className="plugins-popup plugins-filter-popup"
                      role="menu"
                    >
                      <button
                        onClick={() => setFilterMenuOpen(false)}
                        role="menuitem"
                        type="button"
                      >
                        All
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="plugins-loading" role="status">
                <span className="plugins-loading__spinner" />
                <span>Loading plugins…</span>
              </div>
            </>
          ) : visibleSkills.length === 0 ? (
            <div className="skills-empty">No skills found</div>
          ) : (
            <div className="skills-list">
              {visibleSkills.map((skill) => (
                <div className="skills-list__row" key={skill}>
                  <strong>{skill}</strong>
                  <span>Personal skill</span>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
      {marketplaceOpen && (
        <MarketplaceDialog onClose={() => setMarketplaceOpen(false)} />
      )}
    </>
  );
}

function ManagePluginsPage({ onAdd }: { onAdd?(): void }) {
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    void window.chatgptDesktop
      .request<{ config?: Record<string, unknown> }>("config/read", {
        cwd: null,
        includeLayers: false,
      })
      .then((response) => {
        const configured =
          response.config?.mcp_servers ?? response.config?.mcpServers;
        if (current && configured && typeof configured === "object")
          setServers(Object.keys(configured));
      });
    return () => {
      current = false;
    };
  }, []);
  const visibleServers = servers.filter((server) =>
    server.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <main className="plugins-manage-page">
      <div className="plugins-manage-page__toolbar">
        <div className="plugins-manage-page__count">
          <span>MCPs</span>
          <small>{servers.length}</small>
        </div>
        <label className="plugins-manage-page__search">
          <Search aria-hidden="true" />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search MCP servers"
            value={query}
          />
        </label>
      </div>
      <h1>Servers</h1>
      {visibleServers.length ? (
        <section className="plugins-manage-page__servers">
          {visibleServers.map((server) => (
            <div key={server}>
              <strong>{server}</strong>
              <span>Connected</span>
            </div>
          ))}
        </section>
      ) : (
        <section className="plugins-manage-page__empty">
          <span>No MCP servers connected</span>
          <button onClick={onAdd} type="button">
            <Plus aria-hidden="true" />
            Add server
          </button>
        </section>
      )}
    </main>
  );
}

function McpServerForm({ onBack }: { onBack?(): void }) {
  const [serverType, setServerType] = useState<"http" | "stdio">("stdio");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [argumentsList, setArgumentsList] = useState([""]);
  const [environment, setEnvironment] = useState([{ key: "", value: "" }]);
  const [passthrough, setPassthrough] = useState([""]);
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const serverName = name.trim();
    if (!serverName) return;
    setSaving(true);
    setSaveError(undefined);
    const value =
      serverType === "stdio"
        ? {
            args: argumentsList.map((item) => item.trim()).filter(Boolean),
            command: command.trim(),
            cwd: workingDirectory.trim() || null,
            env: Object.fromEntries(
              environment
                .filter((item) => item.key.trim())
                .map((item) => [item.key.trim(), item.value]),
            ),
            env_vars: passthrough.map((item) => item.trim()).filter(Boolean),
          }
        : { url: url.trim() };
    try {
      await window.chatgptDesktop.request("config/value/write", {
        keyPath: `mcp_servers.${serverName}`,
        mergeStrategy: "replace",
        value,
      });
      await window.chatgptDesktop.request("config/mcpServer/reload");
      onBack?.();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save MCP server",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mcp-server-page">
      <div className="plugins-manage-page__toolbar">
        <div className="plugins-manage-page__count">
          <span>MCPs</span>
          <small>0</small>
        </div>
        <label className="plugins-manage-page__search">
          <Search aria-hidden="true" />
          <input placeholder="Search MCP servers" />
        </label>
      </div>
      <button className="mcp-server-page__back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" /> Back
      </button>
      <h1>Connect to a custom MCP</h1>
      <button
        className="mcp-server-page__docs"
        onClick={() =>
          void window.chatgptDesktop.openExternal(
            "https://developers.openai.com/codex/mcp/",
          )
        }
        type="button"
      >
        Docs <ExternalLink aria-hidden="true" />
      </button>

      <section className="mcp-form">
        <div className="mcp-form-stack mcp-form-stack--identity">
          <div className="mcp-form-section mcp-form-section--field">
            <p>Name</p>
            <input
              aria-label="Name"
              onChange={(event) => setName(event.target.value)}
              placeholder="MCP server name"
              value={name}
            />
          </div>
          <div className="mcp-form-type">
            <strong>Type</strong>
            <div>
              <button
                className={serverType === "stdio" ? "is-active" : ""}
                onClick={() => setServerType("stdio")}
                type="button"
              >
                STDIO
              </button>
              <button
                className={serverType === "http" ? "is-active" : ""}
                onClick={() => setServerType("http")}
                type="button"
              >
                Streamable HTTP
              </button>
            </div>
          </div>
        </div>

        <div className="mcp-form-stack mcp-form-stack--fields">
          {serverType === "stdio" ? (
            <>
              <div className="mcp-form-section mcp-form-section--field">
                <p>Command to launch</p>
                <input
                  aria-label="Command to launch"
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="openai-dev-mcp serve-sqlite"
                  value={command}
                />
              </div>
              <EditableStringList
                addLabel="Add argument"
                label="Arguments"
                onChange={setArgumentsList}
                values={argumentsList}
              />
              <EnvironmentList onChange={setEnvironment} values={environment} />
              <EditableStringList
                addLabel="Add variable"
                label="Environment variable passthrough"
                onChange={setPassthrough}
                values={passthrough}
              />
              <div className="mcp-form-section mcp-form-section--field">
                <p>Working directory</p>
                <input
                  aria-label="Working directory"
                  onChange={(event) => setWorkingDirectory(event.target.value)}
                  placeholder="~/code"
                  value={workingDirectory}
                />
              </div>
            </>
          ) : (
            <div className="mcp-form-section mcp-form-section--field">
              <p>URL</p>
              <input
                aria-label="URL"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/mcp"
                value={url}
              />
            </div>
          )}
        </div>

        <div className="mcp-server-page__actions">
          {saveError && <span role="alert">{saveError}</span>}
          <button
            disabled={
              saving ||
              !name.trim() ||
              (serverType === "stdio" ? !command.trim() : !url.trim())
            }
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    </main>
  );
}

function EditableStringList({
  addLabel,
  label,
  onChange,
  values,
}: {
  addLabel: string;
  label: string;
  onChange(values: string[]): void;
  values: string[];
}) {
  return (
    <div className="mcp-form-section mcp-form-list">
      <p>{label}</p>
      {values.map((value, index) => (
        <div className="mcp-form-list__row" key={index}>
          <input
            aria-label={`${label} ${index + 1}`}
            onChange={(event) =>
              onChange(
                values.map((item, itemIndex) =>
                  itemIndex === index ? event.target.value : item,
                ),
              )
            }
            value={value}
          />
          <button
            aria-label="Remove entry"
            disabled={values.length === 1}
            onClick={() =>
              onChange(values.filter((_, itemIndex) => itemIndex !== index))
            }
            type="button"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        className="mcp-form-list__add"
        onClick={() => onChange([...values, ""])}
        type="button"
      >
        <Plus aria-hidden="true" /> {addLabel}
      </button>
    </div>
  );
}

function EnvironmentList({
  onChange,
  values,
}: {
  onChange(values: Array<{ key: string; value: string }>): void;
  values: Array<{ key: string; value: string }>;
}) {
  return (
    <div className="mcp-form-section mcp-form-list">
      <p>Environment variables</p>
      {values.map((value, index) => (
        <div
          className="mcp-form-list__row mcp-form-list__row--pair"
          key={index}
        >
          <input
            placeholder="Key"
            value={value.key}
            onChange={(event) =>
              onChange(
                values.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, key: event.target.value }
                    : item,
                ),
              )
            }
          />
          <input
            placeholder="Value"
            value={value.value}
            onChange={(event) =>
              onChange(
                values.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, value: event.target.value }
                    : item,
                ),
              )
            }
          />
          <button
            aria-label="Remove entry"
            disabled={values.length === 1}
            onClick={() =>
              onChange(values.filter((_, itemIndex) => itemIndex !== index))
            }
            type="button"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        className="mcp-form-list__add"
        onClick={() => onChange([...values, { key: "", value: "" }])}
        type="button"
      >
        <Plus aria-hidden="true" /> Add environment variable
      </button>
    </div>
  );
}

export function MarketplaceDialog({ onClose }: { onClose(): void }) {
  const [source, setSource] = useState("");
  const [gitRef, setGitRef] = useState("");
  const [sparsePaths, setSparsePaths] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const addMarketplace = async () => {
    setAdding(true);
    setError(undefined);
    try {
      await window.chatgptDesktop.request("marketplace/add", {
        refName: gitRef.trim() || null,
        source: source.trim(),
        sparsePaths: sparsePaths
          .split("\n")
          .map((path) => path.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not add marketplace",
      );
    } finally {
      setAdding(false);
    }
  };
  return createPortal(
    <div className="plugins-dialog-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="plugin-marketplace-title"
        className="plugins-marketplace-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form
          className="plugins-marketplace-dialog__form"
          onSubmit={(event) => {
            event.preventDefault();
            void addMarketplace();
          }}
        >
          <h2 className="visually-hidden" id="plugin-marketplace-title">
            Add plugin marketplace
          </h2>
          <div className="plugins-marketplace-dialog__section plugins-marketplace-dialog__header">
            <div className="plugins-marketplace-dialog__title">
              Add plugin marketplace
            </div>
            <div className="plugins-marketplace-dialog__description">
              Add from a GitHub repo, Git URL, or local folder.{" "}
              <a
                href="https://developers.openai.com/codex/plugins/build"
                onClick={(event) => {
                  event.preventDefault();
                  void window.chatgptDesktop.openExternal(
                    event.currentTarget.href,
                  );
                }}
              >
                Learn more
              </a>
            </div>
          </div>
          <div className="plugins-marketplace-dialog__section plugins-marketplace-dialog__fields">
            <label htmlFor="plugin-marketplace-source">
              Source
              <input
                aria-invalid="false"
                autoFocus
                id="plugin-marketplace-source"
                onChange={(event) => setSource(event.target.value)}
                placeholder="openai/plugins or git@github.com:org/repo.git"
                value={source}
              />
            </label>
            <label htmlFor="plugin-marketplace-ref">
              Git ref
              <input
                id="plugin-marketplace-ref"
                onChange={(event) => setGitRef(event.target.value)}
                placeholder="main"
                value={gitRef}
              />
            </label>
            <label htmlFor="plugin-marketplace-sparse-paths">
              Sparse paths
              <textarea
                id="plugin-marketplace-sparse-paths"
                onChange={(event) => setSparsePaths(event.target.value)}
                placeholder="plugins/codex"
                value={sparsePaths}
              />
            </label>
            {error && <span role="alert">{error}</span>}
          </div>
          <div className="plugins-marketplace-dialog__section">
            <div className="plugins-marketplace-dialog__actions">
              <button onClick={onClose} type="button">
                Cancel
              </button>
              <button disabled={adding || !source.trim()} type="submit">
                {adding ? "Adding…" : "Add marketplace"}
              </button>
            </div>
          </div>
        </form>
        <button
          className="plugins-marketplace-dialog__close"
          onClick={onClose}
          type="button"
        >
          <ProjectClearIcon aria-hidden="true" />
        </button>
      </section>
    </div>,
    document.body,
  );
}
