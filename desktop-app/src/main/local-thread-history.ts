import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import type { Thread } from "../shared/protocol";

type ThreadRow = {
  created_at: number;
  cwd: string;
  id: string;
  name: string | null;
  preview: string;
  updated_at: number;
};

function findStateDatabase(): string | null {
  const explicitPath = process.env.CODEX_DESKTOP_STATE_DB;
  if (explicitPath) return existsSync(explicitPath) ? explicitPath : null;
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  let candidates: string[];
  try {
    candidates = readdirSync(codexHome)
      .filter((name) => /^state_\d+\.sqlite$/.test(name))
      .map((name) => join(codexHome, name));
  } catch {
    return null;
  }
  candidates.sort((left, right) => {
    const version = (path: string) =>
      Number(basename(path).match(/^state_(\d+)\.sqlite$/)?.[1] ?? 0);
    return version(right) - version(left);
  });
  return candidates[0] ?? null;
}

export function readLocalThreads(databasePath: string, limit = 500): Thread[] {
  const nodeSqlite = process.getBuiltinModule("node:sqlite") as
    | typeof import("node:sqlite")
    | undefined;
  if (!nodeSqlite) throw new Error("This runtime does not provide node:sqlite");
  const database = new nodeSqlite.DatabaseSync(databasePath, {
    open: true,
    readOnly: true,
  });
  try {
    const rows = database
      .prepare(
        `
          SELECT
            thread.id,
            thread.cwd,
            NULLIF(thread.name, '') AS name,
            COALESCE(
              NULLIF(thread.title, ''),
              NULLIF(thread.preview, ''),
              NULLIF(thread.first_user_message, ''),
              'New chat'
            ) AS preview,
            COALESCE(
              NULLIF(thread.created_at_ms, 0) / 1000,
              thread.created_at
            ) AS created_at,
            COALESCE(
              NULLIF(thread.recency_at_ms, 0) / 1000,
              NULLIF(thread.updated_at_ms, 0) / 1000,
              NULLIF(thread.recency_at, 0),
              thread.updated_at
            ) AS updated_at
          FROM threads AS thread
          LEFT JOIN thread_spawn_edges AS spawn
            ON spawn.child_thread_id = thread.id
          WHERE thread.archived = 0
            AND spawn.child_thread_id IS NULL
            AND COALESCE(thread.thread_source, 'user') <> 'subagent'
          ORDER BY updated_at DESC, thread.id DESC
          LIMIT ?
        `,
      )
      .all(Math.max(1, Math.min(Math.floor(limit), 2_000))) as ThreadRow[];
    return rows.map((row) => ({
      createdAt: Math.floor(Number(row.created_at)),
      cwd: row.cwd,
      id: row.id,
      name: row.name,
      preview: row.preview,
      status: { type: "idle" },
      turns: [],
      updatedAt: Math.floor(Number(row.updated_at)),
    }));
  } finally {
    database.close();
  }
}

export function listLocalThreads(): Thread[] {
  const databasePath = findStateDatabase();
  if (!databasePath) return [];
  try {
    return readLocalThreads(databasePath);
  } catch {
    return [];
  }
}
