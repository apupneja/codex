import readline from "node:readline";

const lines = readline.createInterface({ input: process.stdin });
let approvalSent = false;
let streamingStarted = false;
const writeNotification = (method, params) => {
  process.stdout.write(
    `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`,
  );
};
const thread = {
  id: "smoke-thread",
  name: "Settings reimplementation",
  preview: "Settings reimplementation",
  cwd: "/Users/reference/project",
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
  status: { type: "idle" },
  turns: [
    {
      id: "smoke-turn",
      status: "completed",
      items: [
        {
          type: "userMessage",
          id: "smoke-user",
          content: [
            {
              type: "text",
              text: "Build the settings page",
            },
          ],
        },
        {
          type: "reasoning",
          id: "smoke-reasoning",
          summary: ["Inspecting the existing settings structure"],
          content: [],
        },
        {
          type: "commandExecution",
          id: "smoke-command",
          command: "pnpm run build",
          cwd: "/Users/reference/project",
          status: "completed",
          aggregatedOutput: "Build completed successfully",
          exitCode: 0,
        },
        {
          type: "agentMessage",
          id: "smoke-agent",
          text: "I matched the settings shell and added the route-specific screens.",
        },
      ],
    },
  ],
};

const itemSmokeView = process.env.CODEX_DESKTOP_SMOKE_VIEW;
if (itemSmokeView === "thread-compressed") {
  thread.name = "Reimplement ChatGPT desktop app";
  thread.preview = thread.name;
  thread.cwd = "/Users/apupneja/dubai";
  thread.turns[0].items[0].content.push({
    path: "/tmp/codex-clipboard-77d5957f-acd4-4e2f-b08c-297ab911e7fe.png",
    type: "localImage",
  });
  thread.turns[0].items.splice(-1, 0, {
    id: "smoke-reference-search",
    query: "Codex desktop app",
    type: "webSearch",
  });
  thread.turns[0].items.splice(-1, 0, {
    additions: 49570,
    changes: [],
    deletions: 36333,
    id: "smoke-reference-changes",
    status: "completed",
    type: "fileChange",
  });
  for (let index = 0; index < 6; index += 1) {
    thread.turns[0].items.splice(-1, 0, {
      command: `background-process-${index + 1}`,
      id: `smoke-background-${index + 1}`,
      status: "inProgress",
      type: "commandExecution",
    });
  }
}
const itemSmokeBase = [
  {
    clientId: null,
    content: [{ text: "Investigate the release", type: "text" }],
    id: "smoke-item-user",
    type: "userMessage",
  },
];
const itemSmokeAgent = {
  id: "smoke-item-agent",
  memoryCitation: null,
  phase: "finalAnswer",
  text: "The requested work is complete.",
  type: "agentMessage",
};
if (itemSmokeView?.startsWith("thread-main-chat")) {
  const isTableAudit = itemSmokeView.includes("table");
  const isCitationAudit = itemSmokeView.includes("citations");
  const mainChatUserText = isCitationAudit
    ? "Which self-hosted document and knowledge-base app should I use?"
    : isTableAudit
      ? "document and kb is the most important and needs first class citizen"
      : itemSmokeView.includes("overflow")
        ? "Please inspect the complete conversation lifecycle after sending several messages. Verify streaming updates, persisted local SQLite history, project-scoped new-chat controls, compact-window behavior, the final response hierarchy, Markdown rendering, and every spacing and typography detail in the main chat before calling this complete."
        : "[https://www.linkedin.com/in/nassim-benoussaid/](https://www.linkedin.com/in/nassim-benoussaid/)";
  const tableAuditItems = [
    {
      id: "smoke-main-user",
      text: mainChatUserText,
      type: "userMessage",
    },
    {
      id: "smoke-main-commentary-one",
      phase: "commentary",
      text: "That changes the ranking: I’d prioritize dedicated RAG/knowledge-base platforms over general chat UIs. I’m checking which projects treat ingestion, retrieval, citations, connectors, and permissions as core features.",
      type: "agentMessage",
    },
    { id: "smoke-main-search", type: "webSearch" },
    {
      id: "smoke-main-final",
      phase: "finalAnswer",
      text: [
        "Then I’d change the recommendation:",
        "",
        "| Rank | Project | Best fit |",
        "| --- | --- | --- |",
        "| **1** | **[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)** | Best overall for chatting with private documents |",
        "| **2** | **[Onyx](https://github.com/onyx-dot-app/onyx)** | Best for an organization-wide knowledge base |",
        "| **3** | **[RAGFlow](https://github.com/infiniflow/ragflow)** | Best for complex PDFs, scans, tables, slides, and citations |",
        "| **4** | **[Dify](https://github.com/langgenius/dify)** | Best if you want to build custom apps/workflows around a KB |",
        "| **5** | **[Open WebUI](https://github.com/open-webui/open-webui)** | Good general chat UI, but documents are less central |",
        "",
        "My default choice for you would be **AnythingLLM**. It organizes documents into workspaces, supports multiple document formats, citations, vector search, local/cloud models, and multi-user deployments. It is also relatively easy to run and MIT licensed. citeturn4view3turn5search7turn8view1",
        "",
        "Choose **Onyx** instead if your knowledge base spans Drive, Slack, Notion, or other systems. citeturn6view0",
      ].join("\n"),
      type: "agentMessage",
    },
  ];
  const citationAuditItems = [
    {
      id: "smoke-main-user",
      text: mainChatUserText,
      type: "userMessage",
    },
    {
      id: "smoke-main-commentary-one",
      phase: "commentary",
      text: "I’m comparing the document ingestion, retrieval, deployment, and permissions models now.",
      type: "agentMessage",
    },
    { id: "smoke-main-search", type: "webSearch" },
    {
      id: "smoke-main-final",
      phase: "finalAnswer",
      text: [
        "My default choice is **AnythingLLM**. It supports documents, vector search, local/cloud models, and multi-user deployments. It is MIT licensed. citeturn4view3turn5search7turn8view1",
        "",
        "Choose **Onyx** when enterprise search and permissions matter most. citeturn6view0",
        "",
        "Choose **RAGFlow** when retrieval quality matters enough to justify more operational work. citeturn7view1",
      ].join("\n"),
      type: "agentMessage",
    },
  ];
  thread.name = "Main chat detail audit";
  thread.preview = thread.name;
  thread.turns[0] = {
    completedAt: Math.floor(Date.now() / 1000),
    id: "smoke-turn-main-chat",
    items: isCitationAudit
      ? citationAuditItems
      : isTableAudit
        ? tableAuditItems
        : [
            {
              id: "smoke-main-user",
              text: mainChatUserText,
              type: "userMessage",
            },
            {
              id: "smoke-main-commentary-one",
              phase: "commentary",
              text: "I’ll review the LinkedIn profile and corroborate it with any public sources I can find, then summarize the initiative themes in plain English. I’m using the Chrome-control skill because LinkedIn often hides profile details unless viewed in an existing signed-in session.",
              type: "agentMessage",
            },
            {
              appContext: { appName: "node_repl" },
              id: "smoke-main-tool-one",
              type: "mcpToolCall",
            },
            {
              appContext: { appName: "node_repl" },
              id: "smoke-main-tool-two",
              type: "mcpToolCall",
            },
            {
              appContext: { appName: "node_repl" },
              id: "smoke-main-tool-three",
              type: "mcpToolCall",
            },
            { id: "smoke-main-search", type: "webSearch" },
            {
              id: "smoke-main-commentary-two",
              phase: "commentary",
              text: "The profile points to two consistent tracks: AI-led research transformation inside a large industrial company, and inclusion/accessibility ventures outside it. I’m checking the named programs now so I can distinguish his direct work from things he merely reposts or supports.",
              type: "agentMessage",
            },
            {
              id: "smoke-main-final",
              phase: "finalAnswer",
              text: [
                "Nassim Benoussaid works mainly at the intersection of **AI, scientific innovation, and social inclusion.**",
                "",
                "- **AI-powered scientific R&D:** As Data Science & AI Lead at Syensqo, he helps redesign research workflows using scientific data platforms and specialized AI agents for literature research, simulations, and machine learning.",
                "- **Enterprise AI adoption:** He focuses on getting AI used across an organization—not merely building models. His approach emphasizes broad access, small value-producing experiments, human trust, and capability-building.",
              ].join("\n"),
              type: "agentMessage",
            },
          ],
    startedAt:
      Math.floor(Date.now() / 1000) -
      (isTableAudit ? 57 : isCitationAudit ? 42 : 84),
    status: "completed",
  };
} else if (itemSmokeView === "thread-items-reasoning") {
  thread.turns[0].items = [
    ...itemSmokeBase,
    {
      content: ["The route is backed by the desktop shell."],
      id: "smoke-item-reasoning",
      summary: [
        "**Checking the implementation**\nI’m tracing the relevant components and comparing behavior.",
      ],
      type: "reasoning",
    },
    {
      aggregatedOutput:
        "desktop-app/src/shared/protocol.ts:9:export type ThreadItem",
      command: 'rg -n "ThreadItem" desktop-app/src',
      cwd: thread.cwd,
      durationMs: 1420,
      exitCode: 0,
      id: "smoke-item-command",
      status: "completed",
      type: "commandExecution",
    },
    itemSmokeAgent,
  ];
} else if (itemSmokeView === "thread-items-tools") {
  thread.turns[0].items = [
    ...itemSmokeBase,
    {
      appContext: { appName: "GitHub", connectorId: "github" },
      arguments: { query: "desktop UI" },
      durationMs: 430,
      id: "smoke-item-mcp",
      result: { content: [{ text: "Found 3 issues", type: "text" }] },
      server: "github",
      status: "completed",
      tool: "search_issues",
      type: "mcpToolCall",
    },
    {
      action: {
        queries: null,
        query: "OpenAI Codex desktop app",
        type: "search",
      },
      id: "smoke-item-search",
      query: "OpenAI Codex desktop app",
      results: null,
      type: "webSearch",
    },
    {
      arguments: { title: "Build health" },
      contentItems: [
        { text: "Chart rendered successfully", type: "inputText" },
      ],
      durationMs: 820,
      id: "smoke-item-dynamic",
      namespace: "visualize",
      status: "completed",
      success: true,
      tool: "render_chart",
      type: "dynamicToolCall",
    },
    itemSmokeAgent,
  ];
} else if (itemSmokeView === "thread-items-files") {
  thread.turns[0].items = [
    ...itemSmokeBase,
    {
      changes: [
        {
          diff: "@@ -1 +1 @@\n-old\n+new",
          kind: { move_path: null, type: "update" },
          path: "desktop-app/src/renderer/App.tsx",
        },
        {
          diff: "+content",
          kind: { type: "add" },
          path: "desktop-app/src/renderer/new.tsx",
        },
      ],
      id: "smoke-item-files",
      status: "completed",
      type: "fileChange",
    },
    itemSmokeAgent,
  ];
} else if (itemSmokeView === "thread-items-plan") {
  thread.turns[0].items = [
    ...itemSmokeBase,
    {
      id: "smoke-item-plan",
      text: "# Implementation plan\n\n1. Audit the existing shell\n2. Match the extracted UI\n3. Verify every state",
      type: "plan",
    },
    itemSmokeAgent,
  ];
} else if (itemSmokeView === "thread-items-misc") {
  thread.turns[0].items = [
    ...itemSmokeBase,
    { id: "smoke-item-compaction", type: "contextCompaction" },
    {
      id: "smoke-item-review-start",
      review: "Review the desktop implementation",
      type: "enteredReviewMode",
    },
    { durationMs: 3500, id: "smoke-item-sleep", type: "sleep" },
    {
      id: "smoke-item-image-view",
      path: "/Users/reference/project/mockup.png",
      type: "imageView",
    },
    itemSmokeAgent,
  ];
}
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id == null) return;
  let result = {};
  if (message.method === "initialize") result = { userAgent: "codex-smoke" };
  if (message.method === "thread/list")
    result = {
      data: [thread],
      nextCursor: null,
      backwardsCursor: null,
    };
  if (message.method === "thread/fork")
    result = {
      thread: {
        ...thread,
        ephemeral: true,
        id: "smoke-side-thread",
        turns: [],
      },
    };
  if (message.method === "thread/start")
    result = {
      thread: {
        ...thread,
        id: "smoke-new-thread",
        name: null,
        preview: "",
        turns: [],
      },
    };
  if (message.method === "turn/start")
    result = {
      turn: {
        completedAt: null,
        error: null,
        id: "smoke-side-turn",
        items: [
          {
            content: message.params?.input ?? [],
            id: "smoke-side-user",
            type: "userMessage",
          },
        ],
        startedAt:
          Math.floor(Date.now() / 1000) -
          (process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-compressed"
            ? 43
            : 0),
        status: "inProgress",
      },
    };
  if (message.method === "thread/resume" || message.method === "thread/read")
    result = { thread };
  if (message.method === "model/list")
    result = {
      data: [{ id: "gpt-smoke", displayName: "Codex" }],
      nextCursor: null,
    };
  if (message.method === "plugin/list")
    result = {
      featuredPluginIds: [],
      marketplaceLoadErrors: [],
      marketplaces: process.env.CODEX_DESKTOP_SMOKE_VIEW?.startsWith(
        "thread-context-picker",
      )
        ? [
            {
              name: "openai-curated",
              path: null,
              plugins: [
                {
                  enabled: true,
                  id: "google-drive",
                  installed: false,
                  interface: { displayName: "Google Drive" },
                  name: "google-drive",
                  remotePluginId: "google-drive",
                  source: { type: "remote" },
                },
                {
                  enabled: true,
                  id: "slack",
                  installed: false,
                  interface: { displayName: "Slack" },
                  name: "slack",
                  remotePluginId: "slack",
                  source: { type: "remote" },
                },
                {
                  enabled: true,
                  id: "gmail",
                  installed: false,
                  interface: { displayName: "Gmail" },
                  name: "gmail",
                  remotePluginId: "gmail",
                  source: { type: "remote" },
                },
              ],
            },
          ]
        : [],
    };
  if (message.method === "account/read")
    result = process.env.CODEX_DESKTOP_SMOKE_VIEW?.startsWith("access")
      ? { account: null, requiresOpenaiAuth: true }
      : {
          account: {
            email: "reference@example.com",
            planType:
              process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-compressed"
                ? undefined
                : process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-usage"
                  ? "business"
                  : "ChatGPT Pro",
            type: "chatgpt",
          },
          requiresOpenaiAuth: true,
        };
  process.stdout.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`,
  );
  if (
    !streamingStarted &&
    ["thread-compressed", "thread-streaming"].includes(
      process.env.CODEX_DESKTOP_SMOKE_VIEW,
    ) &&
    message.method === "turn/start"
  ) {
    streamingStarted = true;
    const threadId = String(message.params?.threadId ?? thread.id);
    const turnId = "smoke-side-turn";
    setTimeout(
      () =>
        writeNotification("item/started", {
          item: {
            content: [],
            id: "smoke-stream-reasoning",
            summary: [],
            type: "reasoning",
          },
          threadId,
          turnId,
        }),
      20,
    );
    setTimeout(
      () =>
        writeNotification("item/reasoning/summaryTextDelta", {
          delta: "Checking the existing conversation",
          itemId: "smoke-stream-reasoning",
          summaryIndex: 0,
          threadId,
          turnId,
        }),
      70,
    );
    setTimeout(
      () =>
        writeNotification("item/started", {
          item: {
            id: "smoke-stream-agent",
            text: "",
            type: "agentMessage",
          },
          threadId,
          turnId,
        }),
      130,
    );
    setTimeout(
      () =>
        writeNotification("item/agentMessage/delta", {
          delta: "After each message, the response streams into this turn ",
          itemId: "smoke-stream-agent",
          threadId,
          turnId,
        }),
      190,
    );
    setTimeout(
      () => {
        const text =
          "After each message, the response streams into this turn as it arrives.";
        writeNotification("item/agentMessage/delta", {
          delta: "as it arrives.",
          itemId: "smoke-stream-agent",
          threadId,
          turnId,
        });
        writeNotification("turn/completed", {
          threadId,
          turn: {
            completedAt: Math.floor(Date.now() / 1000),
            error: null,
            id: turnId,
            items: [
              {
                id: "smoke-stream-agent",
                text,
                type: "agentMessage",
              },
            ],
            startedAt: Math.floor(Date.now() / 1000),
            status: "completed",
          },
        });
      },
      process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-compressed"
        ? 3_000
        : 1_200,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-approval" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-approval",
        method: "item/commandExecution/requestApproval",
        params: {
          availableDecisions: ["accept", "decline"],
          command: "pnpm run build",
          commandActions: [],
          cwd: thread.cwd,
          environmentId: null,
          itemId: "smoke-command",
          proposedExecpolicyAmendment: ["pnpm", "run", "build"],
          reason: null,
          startedAtMs: Date.now(),
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-question" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-question",
        method: "item/tool/requestUserInput",
        params: {
          autoResolutionMs: null,
          isBlocking: true,
          itemId: "smoke-question-item",
          questions: [
            {
              header: "Database",
              id: "database",
              isOther: true,
              isSecret: false,
              options: [
                {
                  description: "Use a relational database",
                  label: "PostgreSQL",
                },
                {
                  description: "Keep everything in one local file",
                  label: "SQLite",
                },
              ],
              question: "Which database should I use?",
            },
            {
              header: "Hosting",
              id: "hosting",
              isOther: true,
              isSecret: false,
              options: [
                {
                  description: "Deploy as a managed web app",
                  label: "Vercel",
                },
                {
                  description: "Do not configure deployment",
                  label: "Local only",
                },
              ],
              question: "Where should I deploy it?",
            },
          ],
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-option-picker" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-option-picker",
        method: "item/tool/requestOptionPicker",
        params: {
          allowMultiple: true,
          itemId: "smoke-option-picker-item",
          options: [
            { label: "GitHub" },
            { label: "Slack" },
            { label: "Notion" },
          ],
          question: "Which integrations should I configure?",
          skipLabel: "Not now",
          submitLabel: "Continue",
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW?.startsWith("thread-context-picker") &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-context-picker",
        method: "item/tool/requestSetupCodexContextPicker",
        params: {
          itemId: "smoke-context-picker-item",
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-mcp-form" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-mcp-form",
        method: "mcpServer/elicitation/request",
        params: {
          _meta: null,
          message: "Configure the deployment",
          mode: "form",
          requestedSchema: {
            properties: {
              environment: {
                description: "Choose a deployment environment",
                enum: ["staging", "production"],
                enumNames: ["Staging", "Production"],
                title: "Environment",
                type: "string",
              },
              region: {
                description: "Cloud region",
                title: "Region",
                type: "string",
              },
              replicas: {
                default: 2,
                maximum: 10,
                minimum: 1,
                title: "Replicas",
                type: "integer",
              },
              confirm: {
                default: false,
                title: "Confirm deployment",
                type: "boolean",
              },
            },
            required: ["environment", "region"],
            type: "object",
          },
          serverName: "deployment",
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW?.startsWith("thread-mcp-url") &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-mcp-url",
        method: "mcpServer/elicitation/request",
        params: {
          _meta: null,
          elicitationId: "github-auth-reference",
          message: "Authorize GitHub to continue",
          mode: "url",
          serverName: "github",
          threadId: thread.id,
          turnId: thread.turns[0].id,
          url: "https://github.com/login/oauth/authorize?client_id=reference",
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-mcp-tool" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-mcp-tool",
        method: "mcpServer/elicitation/request",
        params: {
          _meta: {
            codex_approval_kind: "mcp_tool_call",
            connector_id: "github",
            connector_name: "GitHub",
            persist: ["session", "always"],
            tool_name: "create_issue",
            tool_params: {
              repo: "openai/codex",
              title: "Improve desktop UI fidelity",
            },
          },
          message: 'Allow GitHub to run tool "create_issue"?',
          mode: "form",
          requestedSchema: { properties: {}, type: "object" },
          serverName: "github",
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-mcp-suggestion" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-mcp-suggestion",
        method: "mcpServer/elicitation/request",
        params: {
          _meta: {
            codex_approval_kind: "tool_suggestion",
            install_url: "https://chatgpt.com/apps/github",
            suggest_reason:
              "Use GitHub to search repositories and manage issues.",
            suggest_type: "install",
            tool_id: "github",
            tool_name: "GitHub",
            tool_type: "connector",
          },
          message: "Install GitHub?",
          mode: "form",
          requestedSchema: { properties: {}, type: "object" },
          serverName: "codex_apps",
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-mcp-connector-auth" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-mcp-connector-auth",
        method: "mcpServer/elicitation/request",
        params: {
          _meta: {
            _codex_apps: {
              connector_auth_failure: {
                auth_reason: "missing_link",
                connector_id: "github",
                connector_name: "GitHub",
                install_url: "https://chatgpt.com/apps/github",
                is_auth_failure: true,
              },
            },
          },
          elicitationId: "github-connect-reference",
          message: "Connect GitHub to continue",
          mode: "url",
          serverName: "codex_apps",
          threadId: thread.id,
          turnId: thread.turns[0].id,
          url: "https://chatgpt.com/apps/github",
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW?.startsWith("thread-openai-form") &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=";
    const imagePicker = {
      items: [
        { id: "minimal", image, title: "Minimal" },
        { id: "editorial", image, title: "Editorial" },
        { id: "bold", image, title: "Bold" },
      ],
      title: "Choose a template",
      type: "openai/imagePicker",
    };
    const view = process.env.CODEX_DESKTOP_SMOKE_VIEW;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: `smoke-${view}`,
        method: "mcpServer/elicitation/request",
        params: {
          _meta: null,
          message: "Configure your design",
          mode: "openai/form",
          requestedSchema:
            view === "thread-openai-form-unsupported"
              ? {
                  properties: {
                    layout: { type: "openai/unknownPicker" },
                  },
                  type: "object",
                }
              : {
                  properties:
                    view === "thread-openai-form-image"
                      ? { template: imagePicker }
                      : {
                          projectName: {
                            description: "Name your new project",
                            title: "Project name",
                            type: "string",
                          },
                          template: imagePicker,
                        },
                  required:
                    view === "thread-openai-form-image"
                      ? ["template"]
                      : ["projectName", "template"],
                  type: "object",
                },
          serverName: "design-tools",
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
  if (
    !approvalSent &&
    process.env.CODEX_DESKTOP_SMOKE_VIEW === "thread-permission" &&
    message.method === "thread/resume"
  ) {
    approvalSent = true;
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "smoke-permission",
        method: "item/permissions/requestApproval",
        params: {
          cwd: thread.cwd,
          environmentId: null,
          itemId: "smoke-permission-item",
          permissions: {
            fileSystem: {
              entries: [
                {
                  access: "write",
                  path: {
                    path: "/Users/reference/Shared/output",
                    type: "path",
                  },
                },
              ],
              globScanMaxDepth: null,
            },
            network: null,
          },
          reason: "The build needs access to generated files.",
          startedAtMs: Date.now(),
          threadId: thread.id,
          turnId: thread.turns[0].id,
        },
      })}\n`,
    );
  }
});
