import readline from "node:readline";
import { join } from "node:path";

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
let pendingDesktopTest = null;
const MOCK_THREAD_ID = "019mock0-0000-7000-8000-000000000001";
const workspaceRoot =
  process.env.CODEX_DESKTOP_SMOKE_WORKSPACE_ROOT ?? process.cwd();
const signalArenaWorkspace = join(workspaceRoot, "signal-arena");

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ id, result });
}

function model() {
  return {
    id: "composer-2.5",
    model: "composer-2.5",
    upgrade: null,
    upgradeInfo: null,
    availabilityNux: null,
    displayName: "Composer 2.5",
    description: "Frontier coding model",
    modelSpecialty: "coding",
    hidden: false,
    supportedReasoningEfforts: [
      { reasoningEffort: "low", description: "Fast" },
    ],
    defaultReasoningEffort: "low",
    inputModalities: ["text", "image"],
    supportsPersonality: true,
    multiAgentVersion: null,
    additionalSpeedTiers: [],
    serviceTiers: [],
    defaultServiceTier: null,
    isDefault: true,
  };
}

function userMessage(id, text) {
  return {
    type: "userMessage",
    id,
    clientId: null,
    content: [{ type: "text", text, text_elements: [] }],
  };
}

function completedCommand(id, command, cwd) {
  return {
    type: "commandExecution",
    id,
    pluginId: null,
    scriptPath: null,
    command,
    cwd,
    processId: null,
    source: "agent",
    status: "completed",
    commandActions: [],
    aggregatedOutput: command,
    exitCode: 0,
    durationMs: 480,
  };
}

function populatedTurns(cwd) {
  const now = Math.floor(Date.now() / 1_000);
  return [
    {
      id: "turn-smoke-1",
      itemsView: "full",
      status: "completed",
      error: null,
      startedAt: now - 400,
      completedAt: now - 391,
      durationMs: 9_000,
      items: [
        userMessage("user-smoke-1", "can you open google, and search chatgpt"),
        userMessage("user-smoke-2", "record and show a view of it"),
        {
          type: "agentMessage",
          id: "agent-smoke-1",
          text: "failed—likely a permissions issue. Trying alternate capture paths and fetching the search page as a fallback.",
          phase: "final_answer",
          memoryCitation: null,
        },
        completedCommand(
          "command-smoke-1",
          "Explored google-chatgpt-view.png, ran 1 command",
          cwd,
        ),
      ],
    },
    {
      id: "turn-smoke-2",
      itemsView: "full",
      status: "completed",
      error: null,
      startedAt: now - 300,
      completedAt: now - 164,
      durationMs: 136_000,
      items: [
        userMessage(
          "user-smoke-3",
          "can you change a work on the UI, make a PR, and show me the recording of it",
        ),
        {
          type: "reasoning",
          id: "reasoning-smoke-1",
          summary: [
            "Exploring the project to find a sensible UI change, then I'll branch, open a PR, and capture a recording of the result.",
          ],
          content: [],
        },
        {
          type: "agentMessage",
          id: "agent-smoke-2",
          text: "Exploring the project to find a sensible UI change, then I'll branch, open a PR, and capture a recording of the result.",
          phase: "commentary",
          memoryCitation: null,
        },
        completedCommand(
          "command-smoke-2",
          "Explored 7 files, 4 searches, ran 3 commands",
          cwd,
        ),
        {
          type: "agentMessage",
          id: "agent-smoke-3",
          text: "Making a visible UI word change, then installing dependencies, starting the app, recording it, and opening a PR.",
          phase: "commentary",
          memoryCitation: null,
        },
        completedCommand(
          "command-smoke-3",
          "Edited 3 files, explored 2 files, 1 search, ran 7 commands +27 -2",
          cwd,
        ),
        {
          type: "agentMessage",
          id: "agent-smoke-4",
          text: "The first capture came back blank — I'll retry with a longer wait and check whether the dev server is serving the page correctly.",
          phase: "commentary",
          memoryCitation: null,
        },
        completedCommand(
          "command-smoke-4",
          "Edited capture-ui.mjs, explored 5 files, ran 1 command +8 -7",
          cwd,
        ),
        {
          type: "agentMessage",
          id: "agent-smoke-5",
          text: "The app needs Vite env vars to render — restarting the dev server with those set, then recapturing.",
          phase: "commentary",
          memoryCitation: null,
        },
      ],
    },
  ];
}

function thread(
  cwd = signalArenaWorkspace,
  {
    ageSeconds = 7_200,
    id = MOCK_THREAD_ID,
    name = "Google search for ChatGPT",
    turns = false,
  } = {},
) {
  const now = Math.floor(Date.now() / 1_000);
  return {
    id,
    sessionId: id,
    forkedFromId: null,
    parentThreadId: null,
    preview: name,
    ephemeral: false,
    section: null,
    sectionEnteredAt: null,
    modelProvider: "openai",
    createdAt: now - ageSeconds,
    updatedAt: now - ageSeconds,
    recencyAt: now - ageSeconds,
    status: { type: "idle" },
    path: null,
    cwd,
    cliVersion: "0.0.0-smoke",
    source: "appServer",
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    gitInfo: {
      sha: "deadbeef",
      branch: "apupneja/ui-live-arenas-title",
      originUrl: null,
    },
    name,
    turns: turns ? populatedTurns(cwd) : [],
  };
}

input.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);

  if (!("method" in message)) {
    if (message.id === 73 && pendingDesktopTest !== null) {
      reply(pendingDesktopTest, { received: message.result });
      pendingDesktopTest = null;
    }
    return;
  }
  if (!("id" in message)) return;

  const params = message.params ?? {};
  switch (message.method) {
    case "initialize":
      reply(message.id, {
        userAgent: "codex-app-server/mock",
        codexHome: process.cwd(),
        platformFamily: process.platform === "win32" ? "windows" : "unix",
        platformOs:
          process.platform === "darwin"
            ? "macos"
            : process.platform === "win32"
              ? "windows"
              : "linux",
      });
      break;
    case "thread/list":
      reply(message.id, {
        data: [
          thread(),
          thread(signalArenaWorkspace, {
            ageSeconds: 13_149_000,
            id: "019mock0-0000-7000-8000-000000000002",
            name: "Project overview",
          }),
        ],
        nextCursor: null,
      });
      setTimeout(
        () =>
          send({
            method: "desktop/deepLink",
            params: { url: `codex://threads/${MOCK_THREAD_ID}` },
          }),
        250,
      );
      break;
    case "model/list":
      reply(message.id, { data: [model()], nextCursor: null });
      break;
    case "account/read":
      reply(message.id, {
        account: {
          type: "chatgpt",
          email: "Anirudh Pupneja@example.com",
          planType: "free",
        },
        requiresOpenaiAuth: false,
      });
      break;
    case "thread/start":
      reply(message.id, { thread: thread(params.cwd) });
      break;
    case "thread/read":
    case "thread/resume":
      reply(message.id, {
        thread: thread(undefined, { turns: true }),
        initialTurnsPage: null,
      });
      break;
    case "fs/readDirectory":
      reply(message.id, {
        entries: [
          { fileName: "src", isDirectory: true, isFile: false },
          { fileName: "package.json", isDirectory: false, isFile: true },
        ],
      });
      break;
    case "plugin/list":
      reply(message.id, { marketplaces: [] });
      break;
    case "skills/list":
      reply(message.id, { data: [] });
      break;
    case "app/list":
      reply(message.id, { data: [], nextCursor: null });
      break;
    case "desktop/test/serverRequest":
      pendingDesktopTest = message.id;
      send({
        method: "item/commandExecution/requestApproval",
        id: 73,
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          command: "printf smoke",
          cwd: process.cwd(),
          reason: "Transport test",
          availableDecisions: ["accept", "decline"],
        },
      });
      break;
    case "desktop/test/resolvedServerRequest":
      send({
        method: "item/fileChange/requestApproval",
        id: 91,
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          reason: "Transport test",
        },
      });
      send({
        method: "serverRequest/resolved",
        params: { requestId: 91, threadId: "thread-1" },
      });
      reply(message.id, {});
      break;
    case "desktop/test/delayed":
      setTimeout(
        () => reply(message.id, { delayed: true }),
        Number(params.delayMs ?? 20),
      );
      break;
    default:
      reply(message.id, {});
  }
});
