import { useEffect, useMemo, useRef, useState } from "react";

import type { Thread } from "../../shared/types";

const HIDDEN_WORKSPACES_KEY = "codex-hidden-workspaces";
const REPOSITORY_READ_AT_KEY = "codex-repository-read-at";

export type RepositoryMenuState = {
  key: string;
  label: string;
  position: { x: number; y: number };
  threads: Thread[];
  workspaces: string[];
};

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in hardened or ephemeral renderer sessions.
  }
}

function latestThreadActivity(threads: Thread[]): number {
  return Math.max(
    0,
    ...threads.map((thread) => thread.recencyAt ?? thread.updatedAt),
  );
}

export function useRepositorySidebarState({
  onRemoveWorkspaces,
  recentWorkspaces,
  threads,
}: {
  onRemoveWorkspaces(workspaces: string[]): void;
  recentWorkspaces: string[];
  threads: Thread[];
}) {
  const [hiddenWorkspaces, setHiddenWorkspaces] = useState<Set<string>>(
    () => new Set(readStoredValue<string[]>(HIDDEN_WORKSPACES_KEY, [])),
  );
  const [repositoryReadAt, setRepositoryReadAt] = useState<
    Record<string, number>
  >(() => readStoredValue<Record<string, number>>(REPOSITORY_READ_AT_KEY, {}));
  const [repositoryMenu, setRepositoryMenu] =
    useState<RepositoryMenuState | null>(null);
  const previousRecentWorkspaces = useRef(recentWorkspaces);

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !hiddenWorkspaces.has(thread.cwd)),
    [hiddenWorkspaces, threads],
  );
  const visibleRecentWorkspaces = useMemo(
    () =>
      recentWorkspaces.filter((workspace) => !hiddenWorkspaces.has(workspace)),
    [hiddenWorkspaces, recentWorkspaces],
  );

  useEffect(() => {
    const previous = new Set(previousRecentWorkspaces.current);
    const reopened = recentWorkspaces.filter(
      (workspace) =>
        !previous.has(workspace) && hiddenWorkspaces.has(workspace),
    );
    previousRecentWorkspaces.current = recentWorkspaces;
    if (reopened.length === 0) return;
    setHiddenWorkspaces((current) => {
      const next = new Set(current);
      reopened.forEach((workspace) => next.delete(workspace));
      writeStoredValue(HIDDEN_WORKSPACES_KEY, [...next]);
      return next;
    });
  }, [hiddenWorkspaces, recentWorkspaces]);

  const hasUnread = (key: string, repositoryThreads: Thread[]) =>
    latestThreadActivity(repositoryThreads) > (repositoryReadAt[key] ?? 0);

  const markAllRead = () => {
    if (!repositoryMenu) return;
    const next = {
      ...repositoryReadAt,
      [repositoryMenu.key]: latestThreadActivity(repositoryMenu.threads),
    };
    setRepositoryReadAt(next);
    writeStoredValue(REPOSITORY_READ_AT_KEY, next);
    setRepositoryMenu(null);
  };

  const removeRepository = () => {
    if (!repositoryMenu) return;
    setHiddenWorkspaces((current) => {
      const next = new Set(current);
      repositoryMenu.workspaces.forEach((workspace) => next.add(workspace));
      writeStoredValue(HIDDEN_WORKSPACES_KEY, [...next]);
      return next;
    });
    onRemoveWorkspaces(repositoryMenu.workspaces);
    setRepositoryMenu(null);
  };

  return {
    closeRepositoryMenu: () => setRepositoryMenu(null),
    hasUnread,
    markAllRead,
    openRepositoryMenu: setRepositoryMenu,
    removeRepository,
    repositoryMenu,
    visibleRecentWorkspaces,
    visibleThreads,
  };
}
