import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, expect, test } from "vitest";

import { readLocalThreads } from "./local-thread-history";

let temporaryDirectory: string | null = null;

afterEach(() => {
  if (temporaryDirectory)
    rmSync(temporaryDirectory, { force: true, recursive: true });
  temporaryDirectory = null;
});

test("loads visible persisted threads from a Codex state database", () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "codex-thread-history-"));
  const databasePath = join(temporaryDirectory, "state_5.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      cwd TEXT NOT NULL,
      name TEXT,
      preview TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      first_user_message TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_at_ms INTEGER,
      updated_at_ms INTEGER,
      recency_at INTEGER NOT NULL DEFAULT 0,
      recency_at_ms INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      thread_source TEXT
    );
    CREATE TABLE thread_spawn_edges (
      parent_thread_id TEXT NOT NULL,
      child_thread_id TEXT NOT NULL PRIMARY KEY,
      status TEXT NOT NULL
    );
    INSERT INTO threads (
      id, cwd, name, preview, title, created_at, updated_at,
      created_at_ms, updated_at_ms, recency_at_ms, archived, thread_source
    ) VALUES
      ('visible', '/work/dubai', 'Saved chat', 'Stored preview', 'Fallback', 10, 20, 10500, 20500, 30500, 0, 'user'),
      ('archived', '/work/dubai', NULL, '', 'Archived chat', 1, 2, NULL, NULL, 0, 1, 'user'),
      ('child', '/work/dubai', NULL, '', 'Subagent chat', 3, 4, NULL, NULL, 0, 0, 'subagent');
    INSERT INTO thread_spawn_edges VALUES ('visible', 'child', 'completed');
  `);
  database.close();

  expect(readLocalThreads(databasePath)).toEqual([
    {
      createdAt: 10,
      cwd: "/work/dubai",
      id: "visible",
      name: "Saved chat",
      preview: "Fallback",
      status: { type: "idle" },
      turns: [],
      updatedAt: 30,
    },
  ]);
});
