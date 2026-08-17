import { useMemo } from "react";

import type { Thread } from "../../shared/protocol";
import { ProjectMarkerIcon } from "../features/projects/ProjectMarker";
import { projectThreads } from "../features/projects/project-paths";
import type { Route } from "../state/navigation";
import type { LocalProject } from "../state/session";
import { MoreIcon, NewChatIcon } from "../ui/AppIcons";
import { SidebarThreadRow } from "./SidebarThreadRow";

export function SidebarProjects({
  activeThreadBusy,
  activeRoute,
  onNavigate,
  onOpenThread,
  projects,
  selectedProjectId,
  selectProject,
  threads,
}: {
  activeThreadBusy: boolean;
  activeRoute: Route;
  onNavigate(route: Route): void;
  onOpenThread(thread: Thread): void;
  projects: LocalProject[];
  selectedProjectId: string | null;
  selectProject(projectId: string | null): void;
  threads: Thread[];
}) {
  const threadsByProject = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          project.id,
          projectThreads(project, threads),
        ]),
      ),
    [projects, threads],
  );

  return (
    <div aria-label="Projects" className="sidebar-projects">
      {projects.map((project) => {
        const selected = project.id === selectedProjectId;
        const chats = threadsByProject.get(project.id) ?? [];
        const startNewChat = () => {
          selectProject(project.id);
          onNavigate({ kind: "newTask" });
        };
        return (
          <div className="sidebar-project" key={project.id}>
            <div
              className={`sidebar-project__row${selected && activeRoute.kind !== "projects" ? " is-active" : ""}`}
            >
              <button
                className="sidebar-project__main"
                onClick={startNewChat}
                type="button"
              >
                <span className="sidebar-projects__icon">
                  <ProjectMarkerIcon appearance={project.appearance} />
                </span>
                <span className="sidebar-project__name">{project.name}</span>
              </button>
              <span className="sidebar-project__actions">
                <button
                  aria-label={`Open ${project.name} project`}
                  onClick={() => {
                    selectProject(project.id);
                    onNavigate({ kind: "projects" });
                  }}
                  type="button"
                >
                  <MoreIcon aria-hidden="true" />
                </button>
                <button
                  aria-label={`New chat in ${project.name}`}
                  onClick={startNewChat}
                  type="button"
                >
                  <NewChatIcon aria-hidden="true" />
                </button>
              </span>
            </div>
            {selected && (
              <div
                aria-label={`Chats in ${project.name}`}
                className="sidebar-project__threads sidebar-threads"
              >
                {chats.length === 0 ? (
                  <p className="sidebar-projects__empty">No chats</p>
                ) : (
                  chats.map((thread) => (
                    <SidebarThreadRow
                      activeRoute={activeRoute}
                      busy={
                        activeThreadBusy &&
                        activeRoute.kind === "thread" &&
                        activeRoute.threadId === thread.id
                      }
                      key={thread.id}
                      onOpenThread={onOpenThread}
                      thread={thread}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
