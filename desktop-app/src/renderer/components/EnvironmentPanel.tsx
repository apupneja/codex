import {
  ChevronDown,
  CircleDot,
  FileAudio,
  FileCode2,
  GitBranch,
  Github,
  Image,
  Laptop,
  MonitorUp,
  MoreHorizontal,
  PanelTop,
  Play,
  Plus,
  SquarePlus,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { ThreadItem } from "../../shared/types";
import { MenuItem, MenuSurface, useDismissibleLayer } from "../design-system";
import {
  extractPromptContext,
  parseMentionedFilesEnvelope,
} from "../lib/promptContext";
import { summarizeThreadChanges } from "./ThreadChanges";
import type { EnvironmentPanelMode } from "./useEnvironmentPanelLayout";

type EnvironmentSource = {
  kind: "audio" | "context" | "file" | "image" | "remote";
  label: string;
  path: string | null;
};

type EnvironmentPanelProps = {
  branch: string;
  cwd: string;
  deviceLabel: string;
  items: ThreadItem[];
  mode: EnvironmentPanelMode;
  onAddSource(): void;
  onClose(): void;
  onCopyBranch(): void;
  onCreatePullRequest(): void;
  onOpenFile(path: string): void;
  onOpenTerminal(): void;
  onShowChanges(): void;
  onToggleWorkspace(): void;
  workspaceVisible: boolean;
};

function pathLabel(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function urlLabel(url: string, fallback: string): string {
  try {
    return pathLabel(new URL(url).pathname) || fallback;
  } catch {
    return fallback;
  }
}

export function collectEnvironmentSources(
  items: ThreadItem[],
): EnvironmentSource[] {
  const sources = new Map<string, EnvironmentSource>();
  const add = (key: string, source: EnvironmentSource) => {
    if (!sources.has(key)) sources.set(key, source);
  };

  for (const item of items) {
    if (item.type !== "userMessage") continue;
    for (const entry of item.content) {
      if (entry.type === "text") {
        const extracted = extractPromptContext(entry.text, entry.text_elements);
        for (const context of extracted.contexts) {
          add(`context:${context.title}:${context.text}`, {
            kind: "context",
            label: context.title,
            path: null,
          });
        }
        const envelope = parseMentionedFilesEnvelope(extracted.text);
        for (const file of envelope.files) {
          add(`file:${file.path}`, {
            kind: "file",
            label: file.title,
            path: file.path,
          });
        }
        continue;
      }

      if (
        entry.type === "localImage" ||
        entry.type === "localAudio" ||
        entry.type === "skill" ||
        entry.type === "mention"
      ) {
        add(`file:${entry.path}`, {
          kind:
            entry.type === "localImage"
              ? "image"
              : entry.type === "localAudio"
                ? "audio"
                : "file",
          label:
            entry.type === "skill" || entry.type === "mention"
              ? entry.name
              : pathLabel(entry.path),
          path: entry.path,
        });
        continue;
      }

      add(`${entry.type}:${entry.url}`, {
        kind:
          entry.type === "image"
            ? "image"
            : entry.type === "audio"
              ? "audio"
              : "remote",
        label: urlLabel(entry.url, entry.type === "image" ? "Image" : "Audio"),
        path: null,
      });
    }
  }

  return [...sources.values()];
}

function SourceIcon({ kind }: { kind: EnvironmentSource["kind"] }) {
  if (kind === "image") return <Image size={14} />;
  if (kind === "audio") return <FileAudio size={14} />;
  if (kind === "context") return <PanelTop size={14} />;
  return <FileCode2 size={14} />;
}

export function EnvironmentPanel({
  branch,
  cwd,
  deviceLabel,
  items,
  mode,
  onAddSource,
  onClose,
  onCopyBranch,
  onCreatePullRequest,
  onOpenFile,
  onOpenTerminal,
  onShowChanges,
  onToggleWorkspace,
  workspaceVisible,
}: EnvironmentPanelProps) {
  const panelLayer = useRef<HTMLElement>(null);
  const menuLayer = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const changes = useMemo(() => summarizeThreadChanges(items), [items]);
  const sources = useMemo(() => collectEnvironmentSources(items), [items]);
  const additions = changes.reduce(
    (total, change) => total + change.additions,
    0,
  );
  const deletions = changes.reduce(
    (total, change) => total + change.deletions,
    0,
  );
  const visibleSources = showAllSources ? sources : sources.slice(0, 3);
  useDismissibleLayer({
    active: menuOpen,
    layerRef: menuLayer,
    onDismiss: () => setMenuOpen(false),
  });
  useDismissibleLayer({
    active: mode === "drawer" && !menuOpen,
    layerRef: panelLayer,
    onDismiss: onClose,
  });

  return (
    <aside
      aria-label="Environment"
      aria-modal={mode === "drawer" ? true : undefined}
      className={`environment-panel environment-panel-${mode}`}
      id="environment-panel"
      ref={panelLayer}
      role={mode === "drawer" ? "dialog" : undefined}
    >
      <header className="environment-panel-header">
        <h2>Environment</h2>
        <div className="environment-panel-header-actions" ref={menuLayer}>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Environment actions"
            className="environment-panel-icon"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <MoreHorizontal size={16} />
          </button>
          <button
            aria-label="Open terminal"
            className="environment-panel-icon"
            onClick={onOpenTerminal}
            title="Open terminal"
            type="button"
          >
            <Play size={16} />
          </button>
          {mode === "drawer" ? (
            <button
              aria-label="Close Environment"
              autoFocus
              className="environment-panel-icon"
              onClick={onClose}
              type="button"
            >
              <X size={16} />
            </button>
          ) : null}
          {menuOpen ? (
            <MenuSurface className="environment-panel-menu" role="menu">
              <MenuItem
                onClick={() => {
                  onOpenTerminal();
                  setMenuOpen(false);
                }}
                role="menuitem"
              >
                Open Terminal
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onClose();
                  setMenuOpen(false);
                }}
                role="menuitem"
              >
                Hide Environment
              </MenuItem>
            </MenuSurface>
          ) : null}
        </div>
      </header>

      <div className="environment-panel-actions">
        <button className="environment-panel-row" onClick={onShowChanges}>
          <SquarePlus size={16} />
          <span>Changes</span>
          <span className="environment-change-counts">
            <b className="addition">+{additions.toLocaleString()}</b>
            <b className="deletion">−{deletions.toLocaleString()}</b>
          </span>
        </button>
        <button
          className="environment-panel-row"
          onClick={onOpenTerminal}
          title={cwd}
        >
          <Laptop size={16} />
          <span>{deviceLabel}</span>
          <ChevronDown size={15} />
        </button>
        <button
          className="environment-panel-row"
          onClick={onCopyBranch}
          title={`Copy ${branch}`}
        >
          <GitBranch size={16} />
          <span className="environment-panel-row-label">{branch}</span>
          <ChevronDown size={15} />
        </button>
        <button className="environment-panel-row" onClick={onOpenTerminal}>
          <CircleDot size={16} />
          <span>Commit or push</span>
        </button>
        <button className="environment-panel-row" onClick={onCreatePullRequest}>
          <Github size={16} />
          <span>Create pull request</span>
        </button>
      </div>

      <section className="environment-panel-section">
        <h3>Computer Use</h3>
        <button className="environment-panel-row" onClick={onToggleWorkspace}>
          <MonitorUp size={16} />
          <span>Picture in Picture</span>
          <span className="environment-panel-row-value">
            {workspaceVisible ? "Hide" : "Show"}
          </span>
        </button>
      </section>

      <section className="environment-panel-section environment-sources">
        <div className="environment-panel-section-header">
          <h3>Sources</h3>
          <button
            aria-label="Add source"
            className="environment-panel-icon"
            onClick={onAddSource}
            title="Add sources from the composer"
            type="button"
          >
            <Plus size={17} />
          </button>
        </div>
        {visibleSources.length ? (
          <div className="environment-source-list">
            {visibleSources.map((source, index) => {
              const content = (
                <>
                  <span className="environment-source-icon">
                    <SourceIcon kind={source.kind} />
                  </span>
                  <span>{source.label}</span>
                </>
              );
              return source.path ? (
                <button
                  className="environment-source-row"
                  key={`${source.path}-${index}`}
                  onClick={() => onOpenFile(source.path!)}
                  title={source.path}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <div
                  className="environment-source-row"
                  key={`${source.kind}-${source.label}-${index}`}
                  title={source.label}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="environment-source-empty">No sources attached</p>
        )}
        {sources.length > 3 ? (
          <button
            aria-expanded={showAllSources}
            className="environment-sources-more"
            onClick={() => setShowAllSources((show) => !show)}
            type="button"
          >
            <GitBranch size={14} />
            {showAllSources ? "Show less" : `View all (${sources.length})`}
          </button>
        ) : null}
      </section>
    </aside>
  );
}
