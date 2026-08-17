import { useEffect, useRef, useState } from "react";

import { useSession } from "../../state/session";
import {
  ModeCheckIcon,
  ProjectClearIcon,
  SearchIcon,
  SummaryAddIcon,
  WorkProjectIcon,
} from "../../ui/AppIcons";
import { useDismissibleLayer } from "../../ui/useDismissibleLayer";
import { ProjectCreateDialog } from "../projects/ProjectCreateDialog";
import { ProjectMarkerIcon } from "../projects/ProjectMarker";

export function CodexProjectSelector({
  variant = "codex",
}: {
  variant?: "codex" | "work";
}) {
  const { localProjects, selectProject, selectedProjectId } = useSession();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  useDismissibleLayer(pickerRef, () => setMenuOpen(false), menuOpen);
  const selectedProject =
    localProjects.find((project) => project.id === selectedProjectId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = normalizedQuery
    ? localProjects.filter((project) =>
        `${project.name} ${project.rootPaths.join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : localProjects;
  const expanded = createProjectOpen || menuOpen;

  const openPicker = () => {
    if (variant === "work") setMenuOpen((value) => !value);
    else if (localProjects.length === 0) setCreateProjectOpen(true);
    else setMenuOpen((value) => !value);
  };

  useEffect(() => {
    if (variant !== "codex") return;
    const openFromHeading = () => {
      if (localProjects.length === 0) setCreateProjectOpen(true);
      else setMenuOpen(true);
    };
    window.addEventListener("codex-open-project-picker", openFromHeading);
    return () =>
      window.removeEventListener("codex-open-project-picker", openFromHeading);
  }, [localProjects.length, variant]);

  return (
    <>
      <div
        className={
          variant === "work" ? "work-project-selector" : "codex-project-strip"
        }
        ref={pickerRef}
      >
        <button
          aria-expanded={expanded}
          aria-haspopup="dialog"
          aria-label={
            selectedProject
              ? `Change project: ${selectedProject.name}`
              : "Choose project"
          }
          className={`${
            variant === "work"
              ? "work-project-trigger"
              : "codex-project-trigger"
          }${selectedProject ? " has-project" : ""}`}
          onClick={openPicker}
          type="button"
        >
          {variant === "work" && !selectedProject ? (
            <WorkProjectIcon aria-hidden="true" />
          ) : (
            <ProjectMarkerIcon appearance={selectedProject?.appearance} />
          )}
          <span>{selectedProject?.name ?? "Choose project"}</span>
        </button>
        {menuOpen && (
          <div className="codex-project-menu" role="dialog">
            <label className="codex-project-menu__search">
              <SearchIcon aria-hidden="true" />
              <input
                aria-label="Search projects"
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                role="combobox"
                value={query}
              />
            </label>
            <div
              aria-label="Suggestions"
              className="codex-project-menu__projects"
              role="listbox"
            >
              {visibleProjects.map((project) => (
                <button
                  aria-selected={project.id === selectedProjectId}
                  className={
                    project.id === selectedProjectId ? "is-selected" : ""
                  }
                  key={project.id}
                  onClick={() => {
                    selectProject(project.id);
                    setMenuOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <ProjectMarkerIcon appearance={project.appearance} />
                  <span>{project.name}</span>
                  {project.id === selectedProjectId && (
                    <ModeCheckIcon aria-hidden="true" />
                  )}
                </button>
              ))}
              {variant === "work" && visibleProjects.length === 0 && (
                <div className="work-project-menu__empty">
                  No projects found
                </div>
              )}
            </div>
            {variant === "codex" && (
              <>
                <div className="codex-project-menu__separator" />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setCreateProjectOpen(true);
                  }}
                  type="button"
                >
                  <SummaryAddIcon aria-hidden="true" />
                  <span>New project</span>
                </button>
              </>
            )}
            {variant === "codex" && selectedProject && (
              <button
                onClick={() => {
                  selectProject(null);
                  setMenuOpen(false);
                }}
                type="button"
              >
                <ProjectClearIcon aria-hidden="true" />
                <span>Don&apos;t work in a project</span>
              </button>
            )}
          </div>
        )}
      </div>
      {createProjectOpen && (
        <ProjectCreateDialog onClose={() => setCreateProjectOpen(false)} />
      )}
    </>
  );
}
