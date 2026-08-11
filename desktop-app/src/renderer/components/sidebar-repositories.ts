import type { Thread } from "../../shared/types";

import { parseMentionedFilesEnvelope } from "../lib/promptContext";

export type SidebarGrouping =
  | "environment"
  | "repository"
  | "status"
  | "updated"
  | "workspace";

export type SidebarGroup = [
  key: string,
  group: { label: string; threads: Thread[]; workspace: string | null },
];

function repositoryName(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
}

function repositoryIdentity(thread: Thread): [key: string, label: string] {
  const originUrl = thread.gitInfo?.originUrl?.trim();
  if (!originUrl) return [thread.cwd, repositoryName(thread.cwd)];

  const normalizedOrigin = originUrl
    .replace(/^\w+:\/\/(?:[^@/]+@)?([^/]+)\//, "$1/")
    .replace(/^(?:[^@/]+@)?([^:]+):/, "$1/")
    .replace(/[\\/]+$/, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
  const originName = normalizedOrigin.split(/[\\/]/).pop();
  return [
    `repository:${normalizedOrigin}`,
    originName || repositoryName(thread.cwd),
  ];
}

function matchesThread(thread: Thread, query: string): boolean {
  return [
    thread.name,
    thread.preview,
    thread.cwd,
    thread.gitInfo?.branch,
    thread.gitInfo?.originUrl,
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

export function sidebarThreadTitle(thread: Thread): string {
  for (const candidate of [thread.name, thread.preview]) {
    const raw = candidate?.trim();
    if (!raw || /^<system_instruction>/i.test(raw)) continue;
    const visible = parseMentionedFilesEnvelope(raw)
      .text.replace(/<system_instruction>[\s\S]*?<\/system_instruction>/gi, " ")
      .replace(/<\/?(?:user|assistant|developer)(?:\s[^>]*)?>/gi, " ")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    if (visible && !/^\/var\/folders\//.test(visible)) return visible;
  }
  return "Untitled task";
}

export function buildSidebarGroups(
  grouping: SidebarGrouping,
  recentWorkspaces: string[],
  threads: Thread[],
): SidebarGroup[] {
  const entries = new Map<string, SidebarGroup[1]>();
  const repositoryKeyByWorkspace = new Map<string, string>();
  const originRepositoryLabels = new Set<string>();
  for (const thread of threads) {
    const updatedAt = thread.recencyAt ?? thread.updatedAt;
    const elapsedSeconds = Date.now() / 1_000 - updatedAt;
    const [key, label] =
      grouping === "updated"
        ? elapsedSeconds < 86_400
          ? ["updated-today", "Today"]
          : elapsedSeconds < 604_800
            ? ["updated-week", "Previous 7 Days"]
            : ["updated-older", "Older"]
        : grouping === "status"
          ? thread.status.type === "active"
            ? ["status-active", "Active"]
            : thread.status.type === "systemError"
              ? ["status-error", "Needs attention"]
              : ["status-completed", "Completed"]
          : grouping === "environment"
            ? ["environment-local", "This Mac"]
            : grouping === "repository"
              ? repositoryIdentity(thread)
              : [thread.cwd, repositoryName(thread.cwd)];
    if (grouping === "repository") {
      repositoryKeyByWorkspace.set(thread.cwd, key);
      if (thread.gitInfo?.originUrl?.trim()) {
        originRepositoryLabels.add(label.toLocaleLowerCase());
      }
    }
    const groupWorkspace =
      grouping === "repository" || grouping === "workspace" ? thread.cwd : null;
    const current = entries.get(key) ?? {
      label,
      threads: [],
      workspace: groupWorkspace,
    };
    current.workspace ??= groupWorkspace;
    current.threads.push(thread);
    entries.set(key, current);
  }

  if (grouping === "repository" || grouping === "workspace") {
    for (const cwd of recentWorkspaces) {
      const key = repositoryKeyByWorkspace.get(cwd) ?? cwd;
      const label = repositoryName(cwd);
      if (
        grouping === "repository" &&
        !repositoryKeyByWorkspace.has(cwd) &&
        originRepositoryLabels.has(label.toLocaleLowerCase())
      ) {
        const repository = [...entries.values()].find(
          (group) =>
            group.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
        );
        if (repository) repository.workspace = cwd;
        continue;
      }
      const current = entries.get(key);
      if (current) {
        current.workspace ??= cwd;
      } else {
        entries.set(key, { label, threads: [], workspace: cwd });
      }
    }
  }

  return [...entries.entries()];
}

export function filterSidebarGroups(
  groups: SidebarGroup[],
  repositoryFilter: string,
): SidebarGroup[] {
  const query = repositoryFilter.trim().toLocaleLowerCase();
  if (!query) return groups;

  return groups.flatMap<SidebarGroup>(([key, group]) => {
    if (
      group.label.toLocaleLowerCase().includes(query) ||
      key.toLocaleLowerCase().includes(query)
    ) {
      return [[key, group]];
    }
    const matchingThreads = group.threads.filter((thread) =>
      matchesThread(thread, query),
    );
    return matchingThreads.length > 0
      ? [[key, { ...group, threads: matchingThreads }]]
      : [];
  });
}
