import type { Thread } from "../../../shared/protocol";
import type { LocalProject } from "../../state/session";

function normalizedPath(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

export function projectContainsPath(
  rootPaths: string[],
  candidatePath: string,
): boolean {
  return rootPaths.some((rootPath) => {
    const root = normalizedPath(rootPath);
    return (
      candidatePath === root ||
      candidatePath.startsWith(`${root}/`) ||
      candidatePath.startsWith(`${root}\\`)
    );
  });
}

export function projectThreads(
  project: LocalProject,
  threads: Thread[],
): Thread[] {
  return threads
    .filter((thread) => projectContainsPath(project.rootPaths, thread.cwd))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}
