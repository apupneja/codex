import type { JsonObject } from "../shared/types";

const WORKSPACE_CONTEXT_SOURCE = "codex-desktop.workspace";
const WORKSPACE_CONTEXT =
  "The task's selected working directory in <environment_context> is its active codebase. When the user refers to 'the code', 'this repository', or 'the project' without naming a file, inspect that working directory and use its repository context before asking the user for a file or path.";

export function withDesktopWorkspaceContext(
  method: string,
  params: JsonObject | undefined,
): JsonObject | undefined {
  if ((method !== "turn/start" && method !== "turn/steer") || !params) {
    return params;
  }
  return {
    ...params,
    additionalContext: {
      [WORKSPACE_CONTEXT_SOURCE]: {
        kind: "application",
        value: WORKSPACE_CONTEXT,
      },
    },
  };
}
