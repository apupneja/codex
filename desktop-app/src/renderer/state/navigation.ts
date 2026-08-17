export type SettingsSection =
  | "general"
  | "appearance"
  | "configuration"
  | "personalization"
  | "pets"
  | "keyboard-shortcuts"
  | "usage-billing"
  | "account"
  | "plugins"
  | "browser"
  | "computer-use"
  | "hooks"
  | "git"
  | "environments"
  | "worktrees"
  | "archived-chats";

export type Route =
  | { kind: "newTask" }
  | { kind: "thread"; threadId: string }
  | { kind: "pullRequests" }
  | { kind: "automations" }
  | { kind: "skills"; page?: "add-server" | "manage" }
  | { kind: "projects" }
  | { kind: "settings"; section?: SettingsSection };

export function routeKey(route: Route): string {
  if (route.kind === "thread") return `thread:${route.threadId}`;
  if (route.kind === "settings")
    return `settings:${route.section ?? "general"}`;
  if (route.kind === "skills") return `skills:${route.page ?? "directory"}`;
  return route.kind;
}
