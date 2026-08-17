import { useEffect, useMemo, useRef, useState } from "react";

import { type Approval, useSession } from "../../state/session";

type PluginSummary = {
  description: string | null;
  displayName: string;
  enabled: boolean;
  id: string;
  installed: boolean;
  marketplacePath: string | null;
  remoteMarketplaceName: string | null;
};

type PluginListResponse = {
  marketplaces?: Array<{
    name?: string;
    path?: string | null;
    plugins?: Array<{
      enabled?: boolean;
      id?: string;
      installed?: boolean;
      interface?: {
        displayName?: string | null;
        shortDescription?: string | null;
      } | null;
      name?: string;
      remotePluginId?: string | null;
    }>;
  }>;
};

const defaultDescriptions: Record<string, string> = {
  "gmail": "Read customer and sales threads",
  "google-drive": "Find launch docs and source material",
  "slack": "Read decisions and team context",
};

const defaultOrder = ["google-drive", "slack", "gmail"];

function readPlugins(response: PluginListResponse): PluginSummary[] {
  return (response.marketplaces ?? []).flatMap((marketplace) =>
    (marketplace.plugins ?? []).flatMap((plugin) => {
      const id = plugin.id?.trim() || plugin.name?.trim();
      if (!id) return [];
      return [
        {
          description:
            defaultDescriptions[id] ??
            plugin.interface?.shortDescription?.trim() ??
            null,
          displayName:
            plugin.interface?.displayName?.trim() || plugin.name?.trim() || id,
          enabled: plugin.enabled !== false,
          id,
          installed: plugin.installed === true,
          marketplacePath: marketplace.path ?? null,
          remoteMarketplaceName:
            marketplace.path == null ? (marketplace.name ?? null) : null,
        },
      ];
    }),
  );
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

function SourceLogo({ source }: { source: PluginSummary }) {
  if (source.id === "google-drive") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect fill="#fff" height="24" rx="5" width="24" />
        <path d="M8.1 5.5h4.2l3.7 6.4h-4.2z" fill="#0ebc5f" />
        <path d="M11.8 11.9H16l-3.6 6.2H8.2z" fill="#fec700" />
        <path d="M8.1 5.5l3.7 6.4-3.6 6.2H4.5z" fill="#3186ff" />
      </svg>
    );
  }
  if (source.id === "gmail") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect fill="#fff" height="24" rx="5" width="24" />
        <path
          d="M5 7.25v10h3V9.8l4 3.2 4-3.2v7.45h3v-10l-7 5.5z"
          fill="#fc413d"
        />
        <path d="M5 7.25 8 9.8v7.45H6a1 1 0 0 1-1-1z" fill="#3186ff" />
        <path d="M19 7.25 16 9.8v7.45h2a1 1 0 0 0 1-1z" fill="#0ebc5f" />
      </svg>
    );
  }
  if (source.id === "slack") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M12 2c4.6 0 7.8 3.25 7.8 7.56 0 4.17-3.25 5.72-3.25 7.96H7.46c0-2.24-3.26-3.8-3.26-7.96C4.2 5.25 7.42 2 12 2Z"
          fill="#ffd500"
        />
        <path
          d="M7.5 17.5h9c-.05 2.65-1.78 4.3-4.5 4.3s-4.45-1.65-4.5-4.3Z"
          fill="#bdbbbb"
        />
        <path d="M7.45 17.02h9.1v1.95h-9.1z" fill="#d9d9d9" />
      </svg>
    );
  }
  return <span aria-hidden="true">{source.displayName.slice(0, 1)}</span>;
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 21">
      <path
        d="M15.2793 7.71101C15.539 7.45131 15.961 7.45131 16.2207 7.71101C16.4804 7.97071 16.4804 8.39272 16.2207 8.65242L10.4707 14.4024C10.211 14.6621 9.78902 14.6621 9.52932 14.4024L3.77932 8.65242L3.69436 8.54792C3.52385 8.28979 3.55205 7.93828 3.77932 7.71101C4.00659 7.48374 4.3581 7.45554 4.61623 7.62605L4.72073 7.71101L10 12.9903L15.2793 7.71101Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        clipRule="evenodd"
        d="M7.33057 1.98535C10.2484 1.98535 12.6136 4.3508 12.6138 7.26855C12.6138 8.58031 12.1346 9.77942 11.3433 10.7031L13.9897 13.3496C14.1655 13.5253 14.1655 13.8106 13.9897 13.9863C13.814 14.1621 13.5288 14.1621 13.353 13.9863L10.7017 11.335C9.78678 12.0942 8.61243 12.5518 7.33057 12.5518C4.41281 12.5516 2.04736 10.1864 2.04736 7.26855C2.04754 4.35091 4.41292 1.98553 7.33057 1.98535ZM7.33057 2.88574C4.90998 2.88592 2.94793 4.84796 2.94775 7.26855C2.94775 9.68929 4.90987 11.6522 7.33057 11.6523C9.75141 11.6523 11.7144 9.6894 11.7144 7.26855C11.7142 4.84786 9.75131 2.88574 7.33057 2.88574Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function SetupContextPickerCard({ request }: { request: Approval }) {
  const { current, resolveSetupContextPicker } = useSession();
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void window.chatgptDesktop
      .request<PluginListResponse>("plugin/list", {
        cwds: current?.cwd ? [current.cwd] : null,
        marketplaceKinds: null,
      })
      .then((response) => {
        if (active) setPlugins(readPlugins(response));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [current?.cwd]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (menuOpen) setMenuOpen(false);
      else resolveSetupContextPicker(request, "dismiss", []);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, request, resolveSetupContextPicker]);

  const suggested = useMemo(
    () =>
      defaultOrder.flatMap((id) => {
        const plugin = plugins.find((item) => item.id === id);
        return plugin ? [plugin] : [];
      }),
    [plugins],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? plugins.filter((plugin) =>
          `${plugin.displayName} ${plugin.description ?? ""}`
            .toLocaleLowerCase()
            .includes(normalized),
        )
      : plugins;
  }, [plugins, query]);

  const connect = async (source: PluginSummary) => {
    if (source.installed || selected.includes(source.id)) return;
    await window.chatgptDesktop
      .request("plugin/install", {
        ...(source.marketplacePath == null
          ? { remoteMarketplaceName: source.remoteMarketplaceName }
          : { marketplacePath: source.marketplacePath }),
        pluginName: source.id,
      })
      .catch(() => undefined);
    setSelected((items) =>
      items.includes(source.id) ? items : [...items, source.id],
    );
  };

  return (
    <div className="approval-request-region">
      <section className="setup-context-card">
        <header className="setup-context-card__header">
          <h2>Where can we pull context from?</h2>
          <button
            aria-label="Dismiss"
            onClick={() => resolveSetupContextPicker(request, "dismiss", [])}
            type="button"
          >
            <DismissIcon />
          </button>
        </header>
        <div aria-busy={loading} className="setup-context-card__sources">
          {loading
            ? Array.from({ length: 3 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className="setup-context-card__source setup-context-card__source--loading"
                  key={index}
                >
                  <span />
                  <span />
                  <span />
                </div>
              ))
            : suggested.map((source) => {
                const connected =
                  source.installed || selected.includes(source.id);
                return (
                  <div className="setup-context-card__source" key={source.id}>
                    <div className="setup-context-card__logo">
                      <SourceLogo source={source} />
                    </div>
                    <div className="setup-context-card__source-copy">
                      <strong>{source.displayName}</strong>
                      <span>{source.description}</span>
                    </div>
                    <button
                      disabled={connected}
                      onClick={() => void connect(source)}
                      type="button"
                    >
                      <span>{connected ? "Connected" : "Connect"}</span>
                    </button>
                  </div>
                );
              })}
        </div>
        <footer className="setup-context-card__footer">
          <div className="setup-context-card__browse" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={loading}
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <span>Browse all</span>
              <ChevronIcon />
            </button>
            {menuOpen && (
              <div className="setup-context-menu" role="menu">
                <label>
                  <SearchIcon />
                  <input
                    aria-label="Search apps and plugins"
                    autoFocus
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search apps and plugins"
                    value={query}
                  />
                </label>
                <div className="setup-context-menu__items">
                  {filtered.length > 0 ? (
                    filtered.map((source) => {
                      const connected =
                        source.installed || selected.includes(source.id);
                      return (
                        <button
                          disabled={connected}
                          key={source.id}
                          onClick={() => void connect(source)}
                          role="menuitem"
                          type="button"
                        >
                          <span className="setup-context-menu__logo">
                            <SourceLogo source={source} />
                          </span>
                          <span className="setup-context-menu__copy">
                            <span>
                              <strong>{source.displayName}</strong>
                              {connected && <small>Connected</small>}
                            </span>
                            {source.description && (
                              <span>{source.description}</span>
                            )}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p>No apps found</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="setup-context-card__actions">
            <button
              className="setup-context-card__skip"
              onClick={() => resolveSetupContextPicker(request, "skip", [])}
              type="button"
            >
              <span>Skip</span>
            </button>
            <button
              className="setup-context-card__continue"
              disabled={loading}
              onClick={() =>
                resolveSetupContextPicker(request, "continue", [
                  ...new Set([
                    ...selected,
                    ...plugins
                      .filter((plugin) => plugin.installed)
                      .map((plugin) => plugin.id),
                  ]),
                ])
              }
              type="button"
            >
              <span>Continue</span>
              <kbd aria-hidden="true">⏎</kbd>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
