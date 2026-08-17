import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { Thread } from "../../../shared/protocol";
import { useSession } from "../../state/session";
import { ProjectCreateDialog } from "./ProjectCreateDialog";
import { ProjectRemoveDialog } from "./ProjectRemoveDialog";
import { ProjectRow } from "./ProjectRow";

export function ProjectsPage({
  onOpenProject,
  onOpenThread,
}: {
  onOpenProject(): void;
  onOpenThread(thread: Thread): void;
}) {
  const { localProjects, removeProject, selectProject, threads } = useSession();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [removingProjectId, setRemovingProjectId] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "updated">("updated");
  const [pinnedProjectIds, setPinnedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = useMemo(
    () =>
      [...localProjects]
        .filter((project) => {
          if (!normalizedQuery) return true;
          return `${project.name} ${project.rootPaths.join(" ")}`
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((left, right) => {
          const pinnedDifference =
            Number(pinnedProjectIds.has(right.id)) -
            Number(pinnedProjectIds.has(left.id));
          if (pinnedDifference !== 0) return pinnedDifference;
          return sort === "name"
            ? left.name.localeCompare(right.name)
            : right.updatedAt - left.updatedAt;
        }),
    [localProjects, normalizedQuery, pinnedProjectIds, sort],
  );
  const hasProjects = localProjects.length > 0;
  const editingProject =
    localProjects.find((project) => project.id === editingProjectId) ?? null;
  const removingProject =
    localProjects.find((project) => project.id === removingProjectId) ?? null;

  return (
    <>
      <main className="projects-index-page">
        {hasProjects && (
          <div className="projects-index-page__toolbar">
            <button
              className="projects-index-page__new projects-index-page__new--compact"
              onClick={() => setCreateProjectOpen(true)}
              type="button"
            >
              Create
            </button>
          </div>
        )}
        <div className="projects-index-page__layout">
          <header className="projects-index-page__header">
            <h1>Projects</h1>
            {!hasProjects && (
              <p>
                Create a project to organize chats and give ChatGPT access to
                folders on your computer.
              </p>
            )}
          </header>
          {!hasProjects ? (
            <div className="projects-index-page__empty">
              <button
                className="projects-index-page__new"
                onClick={() => setCreateProjectOpen(true)}
                type="button"
              >
                New project
              </button>
            </div>
          ) : (
            <div className="projects-index-page__catalog">
              <label className="projects-index-page__search">
                <Search aria-hidden="true" />
                <input
                  aria-label="Search projects"
                  id="projects-index-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  type="search"
                  value={query}
                />
              </label>
              <div className="projects-index-page__table" role="list">
                <div
                  className="projects-index-page__columns"
                  data-projects-header
                >
                  <button
                    className={sort === "name" ? "is-active" : ""}
                    onClick={() => setSort("name")}
                    type="button"
                  >
                    <span>Name</span>
                  </button>
                  <button
                    className={`projects-index-page__updated-column${sort === "updated" ? " is-active" : ""}`}
                    onClick={() => setSort("updated")}
                    type="button"
                  >
                    <span>Updated</span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                  <span />
                </div>
                <div data-projects-rows>
                  {visibleProjects.length > 0 ? (
                    visibleProjects.map((project) => (
                      <ProjectRow
                        isPinned={pinnedProjectIds.has(project.id)}
                        key={project.id}
                        onEdit={() => setEditingProjectId(project.id)}
                        onOpenProject={() => {
                          selectProject(project.id);
                          onOpenProject();
                        }}
                        onOpenThread={onOpenThread}
                        onRemove={() => setRemovingProjectId(project.id)}
                        onTogglePinned={() =>
                          setPinnedProjectIds((current) => {
                            const next = new Set(current);
                            if (next.has(project.id)) next.delete(project.id);
                            else next.add(project.id);
                            return next;
                          })
                        }
                        project={project}
                        threads={threads}
                      />
                    ))
                  ) : (
                    <div className="projects-index-page__no-results">
                      No projects
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {createProjectOpen && (
        <ProjectCreateDialog
          onClose={() => setCreateProjectOpen(false)}
          onCreated={onOpenProject}
        />
      )}
      {editingProject && (
        <ProjectCreateDialog
          onClose={() => setEditingProjectId(null)}
          onRemove={() => {
            setEditingProjectId(null);
            setRemovingProjectId(editingProject.id);
          }}
          project={editingProject}
        />
      )}
      {removingProject && (
        <ProjectRemoveDialog
          onClose={() => setRemovingProjectId(null)}
          onConfirm={() => {
            removeProject(removingProject.id);
            setRemovingProjectId(null);
          }}
          projectName={removingProject.name}
        />
      )}
    </>
  );
}
