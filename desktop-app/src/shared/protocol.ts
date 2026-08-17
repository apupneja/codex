export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ThreadItem = {
  type: string;
  id?: string;
  text?: string;
  content?: Array<string | { type: string; text?: string; path?: string }>;
  summary?: string[];
  command?: string;
  cwd?: string;
  status?: string;
  aggregatedOutput?: string | null;
  exitCode?: number | null;
  changes?: Array<Record<string, JsonValue>>;
  [key: string]: unknown;
};

export type Turn = {
  id: string;
  items: ThreadItem[];
  status: "completed" | "interrupted" | "failed" | "inProgress";
  startedAt?: number | null;
  completedAt?: number | null;
  error?: { message?: string } | null;
};

export type ThreadTokenUsage = {
  last: { totalTokens: number };
  modelContextWindow: number | null;
  total: { totalTokens: number };
};

export type Thread = {
  id: string;
  preview: string;
  name?: string | null;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  status: { type: string };
  turns: Turn[];
};

export type HostEvent =
  | { kind: "notification"; method: string; params: Record<string, unknown> }
  | {
      kind: "request";
      id: string | number;
      method: string;
      params: Record<string, unknown>;
    }
  | { kind: "runtime"; status: "online" | "offline"; message?: string };
