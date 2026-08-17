import { ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { Thread } from "../../../shared/protocol";
import type { LocalProject } from "../../state/session";
import { MoreIcon, NewChatIcon, PinIcon, UnpinIcon } from "../../ui/AppIcons";
import { useDismissibleLayer } from "../../ui/useDismissibleLayer";
import { ProjectMarkerIcon } from "./ProjectMarker";
import { projectThreads } from "./project-paths";

export function ProjectRow({
  isPinned,
  onEdit,
  onOpenProject,
  onOpenThread,
  onRemove,
  onTogglePinned,
  project,
  threads,
}: {
  isPinned: boolean;
  onEdit(): void;
  onOpenProject(): void;
  onOpenThread(thread: Thread): void;
  onRemove(): void;
  onTogglePinned(): void;
  project: LocalProject;
  threads: Thread[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuLayer = useRef<HTMLSpanElement>(null);
  useDismissibleLayer(menuLayer, () => setMenuOpen(false), menuOpen);
  const recentThreads = useMemo(
    () => projectThreads(project, threads),
    [project, threads],
  );
  const updatedAt = Math.max(
    project.updatedAt,
    recentThreads[0]?.updatedAt ? recentThreads[0].updatedAt * 1_000 : 0,
  );

  return (
    <div className="projects-index-page__row-wrapper" data-project-row-wrapper>
      <div
        aria-expanded={expanded}
        className="projects-index-page__row"
        data-project-row
        onClick={(event) => {
          if (event.detail > 1 || (event.target as Element).closest("button"))
            return;
          setExpanded((value) => !value);
        }}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest("button")) return;
          onOpenProject();
        }}
        role="listitem"
      >
        <span className="projects-index-page__name">
          <span className="projects-index-page__marker">
            <ProjectMarkerIcon appearance={project.appearance} />
          </span>
          <span>{project.name}</span>
          <button
            aria-expanded={expanded}
            aria-label="Toggle project"
            className="projects-index-page__chevron"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </span>
        <span className="projects-index-page__updated">
          {formatUpdated(updatedAt)}
        </span>
        <span className="projects-index-page__actions">
          <span className="projects-index-page__action-menu" ref={menuLayer}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Project actions"
              onClick={() => setMenuOpen((value) => !value)}
              type="button"
            >
              <MoreIcon aria-hidden="true" />
            </button>
            {menuOpen && (
              <span
                aria-label={`${project.name} actions`}
                className="projects-index-page__menu"
                role="menu"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  role="menuitem"
                  type="button"
                >
                  Edit project
                </button>
                <button disabled role="menuitem" type="button">
                  Archive chats
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                  role="menuitem"
                  type="button"
                >
                  Remove
                </button>
              </span>
            )}
          </span>
          <button
            aria-label={isPinned ? "Unpin project" : "Pin project"}
            aria-pressed={isPinned}
            onClick={onTogglePinned}
            type="button"
          >
            {isPinned ? (
              <UnpinIcon aria-hidden="true" />
            ) : (
              <PinIcon aria-hidden="true" />
            )}
          </button>
          <button
            aria-label="Start new chat in project"
            onClick={onOpenProject}
            type="button"
          >
            <NewChatIcon aria-hidden="true" />
          </button>
        </span>
      </div>
      {expanded && (
        <div
          aria-label={`Recent chats in ${project.name}`}
          className="projects-index-page__recent"
        >
          {recentThreads.length === 0 ? (
            <p>No chats</p>
          ) : (
            recentThreads.slice(0, 10).map((thread) => (
              <button
                className="projects-index-page__thread"
                key={thread.id}
                onClick={() => onOpenThread(thread)}
                type="button"
              >
                <span>{thread.name?.trim() || thread.preview}</span>
                <span>{formatUpdated(thread.updatedAt)}</span>
                <span>Open chat</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatUpdated(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return "-";
  const elapsed = Math.max(0, Date.now() - date.valueOf());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return `${Math.floor(elapsed / 1_000)}s`;
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d`;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}
