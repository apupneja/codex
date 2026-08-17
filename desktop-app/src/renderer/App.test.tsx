import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import type { DesktopBridge } from "../shared/bridge";
import type { HostEvent, Thread } from "../shared/protocol";
import { App } from "./App";

const thread: Thread = {
  createdAt: 1_700_000_000,
  cwd: "/work/codex",
  id: "thread-1",
  name: null,
  preview: "Fix parser edge cases",
  status: { type: "idle" },
  turns: [
    {
      id: "turn-1",
      items: [
        {
          content: [{ text: "Fix the parser", type: "text" }],
          id: "user-1",
          type: "userMessage",
        },
        {
          id: "agent-1",
          text: "I fixed the parser and added coverage.",
          type: "agentMessage",
        },
      ],
      status: "completed",
    },
  ],
  updatedAt: 1_700_000_100,
};
let authenticated = true;
let requestMock: ReturnType<typeof vi.fn>;
let hostEventSubscriber: ((event: HostEvent) => void) | null;

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  localStorage.setItem("chatgpt.migration-complete", "true");
  localStorage.setItem("chatgpt.product-mode", "work");
  authenticated = true;
  hostEventSubscriber = null;
  requestMock = vi.fn(async (method: string) => {
    if (method === "thread/list") return { data: [thread] };
    if (method === "thread/resume") return { thread };
    if (method === "model/list") {
      return { data: [{ displayName: "Test model", id: "gpt-test" }] };
    }
    if (method === "plugin/list") {
      return {
        featuredPluginIds: [],
        marketplaceLoadErrors: [],
        marketplaces: [
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
              },
              {
                enabled: true,
                id: "slack",
                installed: false,
                interface: { displayName: "Slack" },
                name: "slack",
              },
              {
                enabled: true,
                id: "gmail",
                installed: false,
                interface: { displayName: "Gmail" },
                name: "gmail",
              },
            ],
          },
        ],
      };
    }
    if (method === "account/read") {
      return authenticated
        ? { account: { type: "chatgpt" }, requiresOpenaiAuth: true }
        : { account: null, requiresOpenaiAuth: true };
    }
    if (method === "account/login/start") {
      return { authUrl: "https://auth.example", type: "chatgpt" };
    }
    if (method === "thread/start") {
      return {
        thread: {
          ...thread,
          id: "thread-new",
          preview: "",
          turns: [],
        },
      };
    }
    if (method === "thread/fork") {
      return {
        thread: {
          ...thread,
          ephemeral: true,
          id: "thread-side",
          turns: [],
        },
      };
    }
    if (method === "turn/start") {
      return { turn: { id: "turn-new", items: [], status: "inProgress" } };
    }
    return {};
  });
  window.chatgptDesktop = {
    answer: vi.fn(),
    clearBrowserData: vi.fn(async () => undefined),
    closeNotification: vi.fn(async () => undefined),
    installUpdate: vi.fn(async () => undefined),
    getGitRoot: vi.fn(async () => null),
    listSkills: vi.fn(async () => []),
    listLocalThreads: vi.fn(async () => []),
    openExternal: vi.fn(async () => undefined),
    openConfigFile: vi.fn(async () => undefined),
    readAgentsFile: vi.fn(async () => ({
      contents: "",
      path: "/Users/test/.codex/AGENTS.md",
    })),
    ready: vi.fn(async () => undefined),
    request: requestMock,
    revealPath: vi.fn(async () => undefined),
    selectFiles: vi.fn(async () => []),
    selectFolder: vi.fn(async () => null),
    setBrowserDownloadDirectory: vi.fn(async () => undefined),
    setBrowserDownloadPrompt: vi.fn(async () => undefined),
    setMenuBarVisible: vi.fn(async () => undefined),
    setPetOverlay: vi.fn(async () => undefined),
    setPreventSleep: vi.fn(async () => undefined),
    setTheme: vi.fn(async () => undefined),
    showNotification: vi.fn(async () => undefined),
    subscribe: vi.fn((subscriber: (event: HostEvent) => void) => {
      hostEventSubscriber = subscriber;
      return () => undefined;
    }),
    writeAgentsFile: vi.fn(async () => ({
      path: "/Users/test/.codex/AGENTS.md",
    })),
  } as DesktopBridge;
});

async function openSettingsSection(name: string): Promise<void> {
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Settings" })).getByRole(
      "button",
      { name },
    ),
  );
}

test("matches the extracted empty Projects index", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  window.history.pushState({}, "", "/projects");
  const { container } = render(<App />);

  expect(
    await screen.findByRole("heading", { level: 1, name: "Projects" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Create a project to organize chats and give ChatGPT access to folders on your computer.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "New project" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".projects-index-page")).toMatchSnapshot();
});

test("matches the extracted populated Projects row interactions", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  localStorage.setItem(
    "chatgpt.local-projects",
    JSON.stringify({
      "project-reference": {
        createdAt: 1_700_000_000,
        id: "project-reference",
        name: "Reference project",
        rootPaths: ["/work/codex"],
        updatedAt: 1_700_000_100,
      },
    }),
  );
  window.history.pushState({}, "", "/projects");
  const { container } = render(<App />);

  expect(
    await screen.findByPlaceholderText("Search projects"),
  ).toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: "Toggle project" });
  fireEvent.click(toggle);
  expect(
    screen.getByLabelText("Recent chats in Reference project"),
  ).toHaveTextContent("Fix parser edge cases");

  fireEvent.click(screen.getByRole("button", { name: "Project actions" }));
  const menu = screen.getByRole("menu", {
    name: "Reference project actions",
  });
  expect(
    within(menu).getByRole("menuitem", { name: "Edit project" }),
  ).toBeInTheDocument();
  expect(
    within(menu).getByRole("menuitem", { name: "Archive chats" }),
  ).toBeDisabled();
  expect(
    within(menu).getByRole("menuitem", { name: "Remove" }),
  ).toBeInTheDocument();
  expect(
    container.querySelector(".projects-index-page__row-wrapper"),
  ).toMatchSnapshot();

  fireEvent.click(within(menu).getByRole("menuitem", { name: "Remove" }));
  const dialog = screen.getByRole("dialog", {
    name: "Remove Reference project?",
  });
  expect(dialog).toHaveTextContent(
    "This removes the project from the app. Files on your computer and existing chats won't be deleted.",
  );
});

test("renders the extracted Work home shell", async () => {
  const { container } = render(<App />);
  expect(await screen.findByText("Ready when you are.")).toBeInTheDocument();
  expect(screen.getByLabelText("Message ChatGPT")).toBeInTheDocument();
  expect(screen.getByLabelText("Loading chats").children).toHaveLength(5);
  expect(container).toMatchSnapshot();
});

test("shows the observed Codex migration modal on first launch", async () => {
  localStorage.removeItem("chatgpt.migration-complete");
  localStorage.removeItem("chatgpt.product-mode");
  const { container } = render(<App />);
  expect(
    await screen.findByText("Codex is now the ChatGPT app"),
  ).toBeInTheDocument();
  expect(container.querySelector(".migration-modal")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Get started" }));
  expect(
    screen.queryByText("Codex is now the ChatGPT app"),
  ).not.toBeInTheDocument();
  expect(localStorage.getItem("chatgpt.migration-complete")).toBe("true");
  expect(screen.getByText("What should we build?")).toBeInTheDocument();
});

test("switches between the ChatGPT home and Codex workspace", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Switch mode, current mode: ChatGPT",
    }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Codex/ }));
  expect(
    screen.getByRole("button", {
      name: "Switch mode, current mode: Codex",
    }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Ready when you are.")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Ask for approval/ }),
  ).toBeInTheDocument();
});

test("navigates backward and forward through desktop routes", async () => {
  render(<App />);
  const back = await screen.findByRole("button", { name: "Back" });
  const forward = screen.getByRole("button", { name: "Forward" });
  expect(back).toBeDisabled();
  expect(forward).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Scheduled" }));
  expect(
    await screen.findByRole("heading", { name: "Scheduled tasks" }),
  ).toBeInTheDocument();
  expect(back).toBeEnabled();
  fireEvent.click(back);
  expect(await screen.findByText("Ready when you are.")).toBeInTheDocument();
  expect(forward).toBeEnabled();
  fireEvent.click(forward);
  expect(
    await screen.findByRole("heading", { name: "Scheduled tasks" }),
  ).toBeInTheDocument();
});

test("reproduces the extracted scheduled-task creation flows", async () => {
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Scheduled" }));

  const scheduledPage = container.querySelector(".scheduled-page");
  expect(scheduledPage).toMatchSnapshot();
  fireEvent.click(
    screen.getByRole("button", { name: "Create scheduled task options" }),
  );
  const createMenu = screen.getByRole("menu");
  expect(createMenu).toHaveTextContent("Create with ChatGPTSet up manually");
  expect(createMenu).toMatchSnapshot();

  fireEvent.click(screen.getByRole("menuitem", { name: "Set up manually" }));
  const editor = screen.getByRole("complementary", {
    name: "New scheduled task",
  });
  expect(
    screen.getByPlaceholderText("Scheduled task title"),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Describe what ChatGPT should do"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  expect(container.querySelector(".scheduled-page--detail")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(editor).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(
    await screen.findByText("What’s on the agenda today?"),
  ).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message ChatGPT" })).toHaveValue(
    "Let's set up a scheduled task together. First, explain how scheduled tasks work in ChatGPT. Then interview me to figure out what I need scheduled and when it should run.",
  );
});

test("reproduces the extracted scheduled suggestion error boundary", async () => {
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Scheduled" }));
  fireEvent.click(screen.getByRole("button", { name: "Daily brief" }));

  const error = screen.getByRole("alert");
  expect(error).toHaveTextContent("Oops, an error has occurredTry again");
  expect(error).toMatchSnapshot();
  fireEvent.click(within(error).getByRole("button", { name: "Try again" }));
  expect(container.querySelector(".scheduled-page")).toBeInTheDocument();
});

test("reproduces the extracted Plugins, Skills, marketplace, and MCP flows", async () => {
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Plugins" }));
  expect(
    await screen.findByRole("heading", { level: 1, name: "Plugins" }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Skills" }));
  expect(await screen.findByText("No skills found")).toBeInTheDocument();
  expect(window.chatgptDesktop.listSkills).toHaveBeenCalled();
  expect(container.querySelector(".plugins-page")).toMatchSnapshot();

  fireEvent.click(
    within(container.querySelector(".route-titlebar-tabs")!).getByRole(
      "button",
      { name: "Plugins" },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(screen.getByRole("menu")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("menuitem", { name: "Add a marketplace" }));
  const marketplace = screen.getByRole("dialog", {
    name: "Add plugin marketplace",
  });
  expect(marketplace).toMatchSnapshot();
  expect(
    screen.getByRole("button", { name: "Add marketplace" }),
  ).toBeDisabled();
  fireEvent.change(
    screen.getByPlaceholderText(
      "openai/plugins or git@github.com:org/repo.git",
    ),
    { target: { value: "openai/plugins" } },
  );
  expect(screen.getByRole("button", { name: "Add marketplace" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Add marketplace" }));
  await waitFor(() => {
    expect(requestMock).toHaveBeenCalledWith("marketplace/add", {
      refName: null,
      source: "openai/plugins",
      sparsePaths: [],
    });
  });

  fireEvent.click(screen.getByRole("button", { name: "Manage" }));
  expect(
    await screen.findByText("No MCP servers connected"),
  ).toBeInTheDocument();
  expect(container.querySelector(".plugins-manage-page")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Add server" }));
  expect(
    await screen.findByRole("heading", { name: "Connect to a custom MCP" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".mcp-server-page")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Streamable HTTP" }));
  fireEvent.change(screen.getByPlaceholderText("MCP server name"), {
    target: { value: "reference-server" },
  });
  fireEvent.change(screen.getByPlaceholderText("https://example.com/mcp"), {
    target: { value: "https://example.com/mcp" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => {
    expect(requestMock).toHaveBeenCalledWith("config/value/write", {
      keyPath: "mcp_servers.reference-server",
      mergeStrategy: "replace",
      value: { url: "https://example.com/mcp" },
    });
    expect(requestMock).toHaveBeenCalledWith("config/mcpServer/reload");
  });
  expect(
    await screen.findByText("No MCP servers connected"),
  ).toBeInTheDocument();
});

test("starts the extracted Plugin Creator composer flow", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Plugins" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Create plugin" }));

  expect(await screen.findByText("Plugin Creator")).toBeInTheDocument();
  expect(screen.getAllByText("help me create a plugin")).toHaveLength(2);
  expect(screen.getByRole("textbox", { name: "Message ChatGPT" })).toHaveValue(
    "help me create a plugin",
  );
});

test("opens the extracted project creation flow from the Codex composer", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Choose project" }),
  );

  expect(
    screen.getByRole("dialog", { name: "Create project" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Project name")).toHaveFocus();
  expect(screen.getByText("Source folders")).toBeInTheDocument();
});

test("prefills the observed subagent prompt from the Codex announcement", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Try now" }));

  expect(screen.queryByText("Subagents in Codex")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Do anything")).toHaveValue(
    "Spawn a subagent to explore this repo.",
  );
  expect(container.querySelector(".codex-home")).toMatchSnapshot();
});

test("creates, persists, selects, and clears a local project", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  window.chatgptDesktop.selectFolder = vi.fn(async () => "/work/parser");
  render(<App />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Choose project" }),
  );
  fireEvent.change(screen.getByLabelText("Project name"), {
    target: { value: "Parser tooling" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Change marker for Parser tooling" }),
  );
  const markerPicker = screen.getByRole("dialog", { name: "Project marker" });
  expect(
    within(markerPicker).getByRole("group", { name: "Project color" }),
  ).toBeInTheDocument();
  expect(
    within(markerPicker).getByRole("group", { name: "Project icon" }),
  ).toBeInTheDocument();
  expect(markerPicker).toMatchSnapshot();
  fireEvent.click(
    within(markerPicker).getByRole("button", { name: "Use Red" }),
  );
  fireEvent.click(
    within(markerPicker).getByRole("button", { name: "Use Paw" }),
  );
  fireEvent.click(within(markerPicker).getByRole("button", { name: "Done" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Choose source folders" }),
  );
  expect(await screen.findByText("parser")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));

  expect(
    await screen.findByRole("heading", {
      name: "What should we work on in Parser tooling?",
    }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Projects")).toHaveTextContent(
    "Parser toolingNo chats",
  );
  const persisted = JSON.parse(
    localStorage.getItem("chatgpt.local-projects") ?? "{}",
  ) as Record<
    string,
    {
      appearance: { color: string; marker: string };
      name: string;
      rootPaths: string[];
    }
  >;
  expect(Object.values(persisted)).toEqual([
    expect.objectContaining({
      appearance: { color: "red", marker: "paw" },
      name: "Parser tooling",
      rootPaths: ["/work/parser"],
    }),
  ]);

  fireEvent.click(
    screen.getByRole("button", { name: "Change project: Parser tooling" }),
  );
  const picker = screen.getByRole("dialog");
  expect(within(picker).getByPlaceholderText("Search projects")).toHaveFocus();
  expect(picker).toHaveTextContent(
    "Parser toolingNew projectDon't work in a project",
  );
  expect(picker).toMatchSnapshot();
  fireEvent.click(
    within(picker).getByRole("button", {
      name: "Don't work in a project",
    }),
  );
  expect(screen.getByText("What should we build?")).toBeInTheDocument();
  expect(localStorage.getItem("chatgpt.selected-project")).toBeNull();
});

test("opens and persists the extracted sidebar organization menu", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Project sidebar options" }),
  );

  expect(screen.getByText("Organize sidebar")).toBeInTheDocument();
  expect(
    screen.getByRole("menuitemradio", { name: "By project" }),
  ).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Last updated" }));
  expect(localStorage.getItem("chatgpt.sidebar.projects.sort")).toBe(
    "updated_at",
  );
});

test("loads persisted SQLite chats into their sidebar project", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  localStorage.setItem("chatgpt.selected-project", "project-dubai");
  localStorage.setItem(
    "chatgpt.local-projects",
    JSON.stringify({
      "project-dubai": {
        createdAt: 1_700_000_000_000,
        id: "project-dubai",
        name: "dubai",
        rootPaths: ["/work/codex"],
        updatedAt: 1_700_000_100_000,
      },
    }),
  );
  window.chatgptDesktop.listLocalThreads = vi.fn(async () => [
    {
      ...thread,
      cwd: "/work/codex/desktop-app",
      id: "thread-local",
      name: "Reimplement ChatGPT desktop app",
      preview: "Reimplement ChatGPT desktop app",
      turns: [],
      updatedAt: 1_700_000_200,
    },
  ]);
  const { container } = render(<App />);

  const projectChats = await screen.findByLabelText("Chats in dubai");
  expect(projectChats).toHaveTextContent("Reimplement ChatGPT desktop app");
  expect(window.chatgptDesktop.listLocalThreads).toHaveBeenCalledOnce();
  expect(
    within(screen.getByLabelText("Recent chats")).queryByText(
      "Reimplement ChatGPT desktop app",
    ),
  ).not.toBeInTheDocument();
  expect(
    container.querySelector(".sidebar-section--projects"),
  ).toMatchSnapshot();

  fireEvent.click(screen.getByRole("button", { name: "New chat in dubai" }));
  expect(
    await screen.findByRole("heading", {
      name: "What should we work on in dubai?",
    }),
  ).toBeInTheDocument();
});

test("backs the terminal tab with a streaming app-server PTY", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  fireEvent.click(
    await screen.findByRole("button", { name: "Toggle side panel" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Terminal/ }));

  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      "command/exec",
      expect.objectContaining({
        cwd: "/work/codex",
        processId: expect.any(String),
        tty: true,
      }),
    ),
  );
  const terminalRequest = requestMock.mock.calls.find(
    ([method]) => method === "command/exec",
  );
  const processId = terminalRequest?.[1]?.processId as string;
  act(() =>
    hostEventSubscriber?.({
      kind: "notification",
      method: "command/exec/outputDelta",
      params: {
        capReached: false,
        deltaBase64: btoa("terminal ready"),
        processId,
        stream: "stdout",
      },
    }),
  );
  expect(await screen.findByText("terminal ready")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Terminal input" }), {
    code: "Enter",
    key: "Enter",
    keyCode: 13,
    which: 13,
  });
  expect(requestMock).toHaveBeenCalledWith("command/exec/write", {
    deltaBase64: btoa("\r"),
    processId,
  });
});

test("edits the latest user message in the extracted inline editor", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
  const editor = screen.getByRole("textbox", { name: "Edit message" });
  expect(editor).toHaveValue("Fix the parser");
  expect(container.querySelector(".user-message-editor")).toMatchSnapshot();

  fireEvent.change(editor, { target: { value: "Fix the parser safely" } });
  fireEvent.click(
    within(container.querySelector(".user-message-editor")!).getByRole(
      "button",
      { name: "Send" },
    ),
  );
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      "turn/start",
      expect.objectContaining({
        input: [{ text: "Fix the parser safely", type: "text" }],
        threadId: "thread-1",
      }),
    ),
  );
  expect(
    screen.queryByRole("textbox", { name: "Edit message" }),
  ).not.toBeInTheDocument();
});

test("creates and closes integrated bottom terminal tabs", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  fireEvent.click(
    await screen.findByRole("button", { name: "Toggle bottom panel" }),
  );

  expect(screen.getByRole("tab", { name: "codex" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "New terminal tab" }));
  expect(screen.getByRole("tab", { name: "codex 2" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Close codex 2 tab" }));
  expect(
    screen.queryByRole("tab", { name: "codex 2" }),
  ).not.toBeInTheDocument();
});

test("opens the observed Work attachment menu", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Add files and more" }),
  );
  expect(screen.getByText("Add photos & files")).toBeInTheDocument();
  expect(screen.getByText("Create image")).toBeInTheDocument();
  expect(screen.getByText("Web search")).toBeInTheDocument();
  expect(screen.getByText("Work in a project")).toBeInTheDocument();
  expect(screen.getByText("Start a chat in a project")).toBeInTheDocument();
});

test("matches the Work surface controls and Temporary Chat flow", async () => {
  const { container } = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Work" }));

  expect(screen.getByText("What should we work on?")).toBeInTheDocument();
  expect(screen.getByLabelText("Work with ChatGPT")).toBeInTheDocument();
  expect(container.querySelector(".work-task-page")).toMatchSnapshot();

  fireEvent.click(screen.getByRole("button", { name: "Choose project" }));
  expect(screen.getByText("No projects found")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toMatchSnapshot();
  expect(
    screen.getByRole("listbox", { name: "Suggestions" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose project" }));

  fireEvent.click(screen.getByRole("button", { name: "Connect plugins" }));
  const pluginsMenu = screen.getByRole("menu", { name: "Plugins" });
  expect(pluginsMenu).toHaveTextContent("No connected pluginsConnect plugins");
  expect(pluginsMenu).toMatchSnapshot();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Connect plugins" })[0],
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Choose where to run this chat" }),
  );
  const runMenu = screen.getByRole("menu", {
    name: "Where should this chat run?",
  });
  expect(runMenu).toHaveTextContent(
    "On your computerRead and edit local files with permissionIn the cloudCan't access local files unless attached",
  );
  expect(runMenu).toMatchSnapshot();

  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Turn on temporary chat" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Temporary Chat" });
  expect(dialog).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(dialog).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Turn off temporary chat" }),
  ).toBeInTheDocument();
});

test("selects a local project from the observed Work project submenu", async () => {
  localStorage.setItem(
    "chatgpt.local-projects",
    JSON.stringify({
      "project-reference": {
        appearance: { color: "pink", marker: "heart" },
        createdAt: 1786847000000,
        id: "project-reference",
        name: "Reference project",
        rootPaths: ["/work/reference"],
        updatedAt: 1786848000000,
      },
    }),
  );
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Add files and more" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Work in a project/ }));

  const menu = screen.getByRole("menu", { name: "Work in a project" });
  expect(menu).toHaveTextContent("Reference project");
  expect(
    within(menu)
      .getByRole("menuitem", { name: "Reference project" })
      .querySelector("svg"),
  ).toHaveStyle({ color: "#f579b4" });
  expect(menu).toMatchSnapshot();
  fireEvent.click(
    within(menu).getByRole("menuitem", { name: "Reference project" }),
  );

  expect(container.querySelector(".home-project-menu")).not.toBeInTheDocument();
  expect(localStorage.getItem("chatgpt.selected-project")).toBe(
    "project-reference",
  );
});

test("opens the separate General settings shell", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  expect(
    screen.getByRole("heading", { level: 1, name: "General" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Show in menu bar")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to app" }));
  expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
});

test("runs the extracted archived error recovery actions", async () => {
  const { container } = render(<App />);
  await openSettingsSection("Archived chats");

  const error = container.querySelector(".settings-error");
  expect(error).toHaveTextContent(
    "Oops, an error has occurred Update ChatGPTTry again",
  );
  expect(error).toMatchSnapshot();

  fireEvent.click(screen.getByRole("button", { name: "Update ChatGPT" }));
  expect(window.chatgptDesktop.installUpdate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("button", { name: "Open profile menu" }),
  ).toBeInTheDocument();
});

test("opens and returns from the extracted open-source licenses route", async () => {
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  const licensesRow = screen
    .getByText("Open source licenses")
    .closest(".settings-card__row");
  expect(licensesRow).not.toBeNull();
  fireEvent.click(within(licensesRow as HTMLElement).getByRole("button"));
  expect(
    screen.getByRole("heading", { level: 1, name: "Open source licenses" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("No third-party notices were found."),
  ).toBeInTheDocument();
  expect(
    container.querySelector(".settings-open-source-licenses"),
  ).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(
    screen.getByRole("heading", { level: 1, name: "General" }),
  ).toBeInTheDocument();
});

test("opens and persists the extracted General setting menus", async () => {
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));

  fireEvent.click(screen.getByRole("button", { name: "Auto detect" }));
  const languageMenu = screen.getByRole("dialog");
  expect(
    within(languageMenu).getByPlaceholderText("Search languages"),
  ).toHaveFocus();
  expect(container.querySelector(".settings-dropdown__menu")).toMatchSnapshot();
  fireEvent.change(
    within(languageMenu).getByPlaceholderText("Search languages"),
    {
      target: { value: "deut" },
    },
  );
  fireEvent.click(
    within(languageMenu).getByRole("option", { name: "Deutsch" }),
  );
  expect(localStorage.getItem("chatgpt.locale-override")).toBe("de-DE");
  expect(screen.getByRole("button", { name: "Deutsch" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "⌘ + Enter always" }));
  expect(localStorage.getItem("chatgpt.composer-enter-behavior")).toBe(
    "cmdAlways",
  );

  fireEvent.click(screen.getByRole("button", { name: "Only when unfocused" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Always" }));
  expect(localStorage.getItem("chatgpt.turn-notifications")).toBe("always");
});

test("persists the extracted General switches and segmented controls", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));

  fireEvent.click(
    screen.getByRole("switch", { name: "Show Full access in the composer" }),
  );
  fireEvent.click(screen.getByRole("link", { name: "Learn more" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://developers.openai.com/codex/config-basic",
  );
  fireEvent.click(
    screen.getByRole("switch", { name: "Show ChatGPT in the menu bar" }),
  );
  fireEvent.click(screen.getByRole("switch", { name: "Bottom panel" }));
  fireEvent.click(
    screen.getByRole("switch", { name: "Prevent sleep while running" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Right" }));
  fireEvent.click(screen.getByRole("button", { name: "Queue" }));

  expect(localStorage.getItem("general-show-full-access")).toBe("false");
  expect(localStorage.getItem("general-show-menu-bar")).toBe("false");
  expect(localStorage.getItem("general-show-bottom-panel")).toBe("false");
  expect(localStorage.getItem("general-prevent-sleep")).toBe("true");
  expect(localStorage.getItem("general-terminal-location")).toBe("Right");
  expect(localStorage.getItem("general-follow-up-behavior")).toBe("Queue");
  expect(window.chatgptDesktop.setPreventSleep).toHaveBeenLastCalledWith(true);
  expect(window.chatgptDesktop.setMenuBarVisible).toHaveBeenLastCalledWith(
    false,
  );

  fireEvent.click(screen.getByRole("button", { name: "Back to app" }));
  expect(
    screen.queryByRole("button", { name: "Toggle bottom panel" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ask for approval" }));
  const permissions = screen.getByRole("menu", { name: "Permissions" });
  expect(
    within(permissions).queryByRole("menuitemradio", { name: "Full access" }),
  ).not.toBeInTheDocument();
});

test("adds a project and saves the extracted local environment editor", async () => {
  localStorage.setItem(
    "chatgpt.local-projects",
    JSON.stringify({
      "project-parser": {
        createdAt: 1,
        id: "project-parser",
        name: "Parser",
        rootPaths: ["/work/parser"],
        updatedAt: 1,
      },
    }),
  );
  const { container } = render(<App />);
  await openSettingsSection("Environments");

  fireEvent.click(screen.getByRole("link", { name: "Learn more" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://developers.openai.com/codex/app/local-environments",
  );

  const projectList = screen.getByRole("list", { name: "Available projects" });
  expect(projectList).toHaveTextContent("Parser/work/parser");
  fireEvent.click(
    within(projectList).getByRole("button", {
      name: "Add environment to Parser",
    }),
  );

  expect(
    screen.getByRole("heading", { level: 1, name: "Edit local environment" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Setup script")).toHaveFocus();
  expect(container.querySelector(".environment-editor")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Variables" }));
  const variables = screen.getByRole("dialog", {
    name: "Setup script environment variables",
  });
  expect(variables).toHaveTextContent(
    "Source workspace pathCODEX_SOURCE_TREE_PATHNew worktree pathCODEX_WORKTREE_PATH",
  );
  expect(variables).toMatchSnapshot();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(
    screen.queryByRole("dialog", {
      name: "Setup script environment variables",
    }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Setup script"), {
    target: { value: "pnpm install" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Advanced options" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "development" },
  });
  fireEvent.change(screen.getByLabelText("Cleanup script"), {
    target: { value: "pnpm clean" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set up project" }));

  expect(
    JSON.parse(localStorage.getItem("chatgpt.local-environments") ?? "{}"),
  ).toEqual({
    "project-parser": {
      actions: [],
      cleanupScript: "pnpm clean",
      name: "development",
      setupScript: "pnpm install",
    },
  });
  expect(
    screen.getByRole("heading", { level: 1, name: "Environments" }),
  ).toBeInTheDocument();

  window.chatgptDesktop.selectFolder = vi.fn(async () => "/work/new-project");
  fireEvent.click(screen.getByRole("button", { name: "Add project" }));
  expect(await screen.findByText("new-project")).toBeInTheDocument();
});

test("reloads hooks from the active configuration", async () => {
  render(<App />);
  await openSettingsSection("Hooks");
  fireEvent.click(screen.getByRole("link", { name: "Learn more" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://developers.openai.com/codex/hooks",
  );
  requestMock.mockClear();

  fireEvent.click(screen.getByRole("button", { name: "Reload hooks" }));
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("config/read", {
      cwd: null,
      includeLayers: true,
    }),
  );
});

test("persists the extracted worktree controls", async () => {
  render(<App />);
  await openSettingsSection("Worktrees");

  const root = screen.getByLabelText("Worktree root");
  fireEvent.change(root, { target: { value: "/tmp/worktrees" } });
  fireEvent.blur(root);
  expect(localStorage.getItem("git-worktree-root")).toBe("/tmp/worktrees");

  const cleanup = screen.getByRole("switch", {
    name: "Automatically delete old worktrees",
  });
  fireEvent.click(cleanup);
  expect(localStorage.getItem("worktree-auto-cleanup-enabled")).toBe("false");
  expect(screen.getByLabelText("Auto-delete limit")).toBeDisabled();
  expect(
    screen.getByText(/Automatic deletion is disabled/),
  ).toBeInTheDocument();

  fireEvent.click(cleanup);
  const limit = screen.getByLabelText("Auto-delete limit");
  fireEvent.change(limit, { target: { value: "0" } });
  fireEvent.blur(limit);
  expect(limit).toHaveValue("1");
  expect(localStorage.getItem("worktree-keep-count")).toBe("1");
});

test("persists the extracted Git controls and instructions", async () => {
  render(<App />);
  await openSettingsSection("Git");

  const prefix = screen.getByLabelText("Branch prefix");
  fireEvent.change(prefix, { target: { value: "feature/" } });
  fireEvent.blur(prefix);
  expect(localStorage.getItem("git-branch-prefix")).toBe("feature/");

  fireEvent.click(screen.getByRole("switch", { name: "Always force push" }));
  fireEvent.click(
    screen.getByRole("switch", { name: "Create draft pull requests" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Detached" }));
  expect(localStorage.getItem("git-always-force-push")).toBe("true");
  expect(localStorage.getItem("git-create-pull-request-as-draft")).toBe(
    "false",
  );
  expect(localStorage.getItem("reviewDelivery")).toBe("detached");

  fireEvent.change(screen.getByLabelText("Commit instructions"), {
    target: { value: "Use imperative subjects" },
  });
  const commitSection = screen
    .getByText("Commit instructions")
    .closest(".settings-route-section");
  fireEvent.click(
    within(commitSection as HTMLElement).getByRole("button", { name: "Save" }),
  );
  expect(localStorage.getItem("git-commit-instructions")).toBe(
    "Use imperative subjects",
  );

  fireEvent.change(screen.getByLabelText("Pull request instructions"), {
    target: { value: "Include a test plan" },
  });
  const pullRequestSection = screen
    .getByText("Pull request instructions")
    .closest(".settings-route-section");
  fireEvent.click(
    within(pullRequestSection as HTMLElement).getByRole("button", {
      name: "Save",
    }),
  );
  expect(localStorage.getItem("git-pr-instructions")).toBe(
    "Include a test plan",
  );
});

test("reads and writes the extracted Configuration controls", async () => {
  render(<App />);
  await openSettingsSection("Configuration");

  fireEvent.click(screen.getByRole("link", { name: "Learn more" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://developers.openai.com/codex/config-basic",
  );

  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("config/read", {
      cwd: null,
      includeLayers: true,
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "User config" }));
  const scopeMenu = screen.getByRole("menu");
  expect(scopeMenu).toHaveTextContent("Global configUser config");
  fireEvent.click(screen.getByRole("menuitem", { name: "User config" }));
  fireEvent.click(screen.getByRole("button", { name: "Open config.toml" }));
  expect(window.chatgptDesktop.openConfigFile).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Approval policy" }));
  const approvalMenu = screen.getByRole("menu");
  expect(approvalMenu).toHaveTextContent(
    "UntrustedAlways ask before taking actionOn requestAsk when escalation is requestedNever ask for approvalBlocked actions fail instead of requesting approval",
  );
  expect(approvalMenu).toMatchSnapshot();
  fireEvent.click(
    screen.getByRole("menuitem", { name: /Never ask for approval/ }),
  );
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("config/value/write", {
      cwd: null,
      keyPath: "approval_policy",
      mergeStrategy: "replace",
      value: "never",
    }),
  );
  expect(
    screen.getByRole("button", { name: "Approval policy" }),
  ).toHaveTextContent("Never ask for approval");

  fireEvent.click(screen.getByRole("button", { name: "Output detail" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /High/ }));
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("config/value/write", {
      cwd: null,
      keyPath: "model_verbosity",
      mergeStrategy: "replace",
      value: "high",
    }),
  );
});

test("loads, saves, and retries the extracted Personalization instructions", async () => {
  window.chatgptDesktop.readAgentsFile = vi.fn(async () => ({
    contents: "Keep answers direct.",
    path: "/Users/test/.codex/AGENTS.md",
  }));
  render(<App />);
  await openSettingsSection("Personalization");

  const editor = await screen.findByLabelText("Custom instructions");
  expect(editor).toHaveValue("Keep answers direct.");
  fireEvent.change(editor, { target: { value: "Prefer small diffs." } });
  const saveButton = screen.getByRole("button", { name: "Save" });
  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);

  await waitFor(() =>
    expect(window.chatgptDesktop.writeAgentsFile).toHaveBeenCalledWith(
      "Prefer small diffs.",
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Saved agents.md",
  );

  window.chatgptDesktop.readAgentsFile = vi
    .fn()
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValueOnce({
      contents: "Recovered",
      path: "/Users/test/.codex/AGENTS.md",
    });
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Settings" })).getByRole(
      "button",
      { name: "Appearance" },
    ),
  );
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Settings" })).getByRole(
      "button",
      { name: "Personalization" },
    ),
  );
  expect(await screen.findByText("Unable to load agents.md.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Custom instructions")).toHaveValue(
    "Recovered",
  );
});

test("persists the extracted Personalization personality and shortcut save", async () => {
  render(<App />);
  await openSettingsSection("Personalization");
  const editor = await screen.findByLabelText("Custom instructions");
  fireEvent.change(editor, { target: { value: "Use a pragmatic tone." } });
  fireEvent.keyDown(window, { key: "s", metaKey: true });
  await waitFor(() =>
    expect(window.chatgptDesktop.writeAgentsFile).toHaveBeenCalledWith(
      "Use a pragmatic tone.",
    ),
  );

  fireEvent.click(screen.getByRole("button", { name: "Personality" }));
  const menu = screen.getByRole("menu");
  expect(menu).toHaveTextContent(
    "FriendlyWarm, collaborative, and helpfulPragmaticConcise, task-focused, and direct",
  );
  expect(menu).toMatchSnapshot();
  fireEvent.click(within(menu).getByRole("menuitem", { name: /Pragmatic/ }));
  expect(localStorage.getItem("personalization-personality")).toBe("pragmatic");
  expect(screen.getByRole("button", { name: "Personality" })).toHaveTextContent(
    "Pragmatic",
  );
});

test("opens the extracted Usage and billing destinations", async () => {
  render(<App />);
  await openSettingsSection("Usage & billing");

  fireEvent.click(screen.getByRole("link", { name: "settings on Web" }));
  fireEvent.click(screen.getByRole("button", { name: "View plans" }));
  fireEvent.click(screen.getByRole("button", { name: "Buy credits" }));
  fireEvent.click(screen.getByRole("link", { name: "billing" }));

  expect(window.chatgptDesktop.openExternal).toHaveBeenNthCalledWith(
    1,
    "https://chatgpt.com/#settings/Billing",
  );
  expect(window.chatgptDesktop.openExternal).toHaveBeenNthCalledWith(
    2,
    "https://chatgpt.com/pricing",
  );
  expect(window.chatgptDesktop.openExternal).toHaveBeenNthCalledWith(
    3,
    "https://chatgpt.com/settings/usage?credit_modal=true",
  );
  expect(window.chatgptDesktop.openExternal).toHaveBeenNthCalledWith(
    4,
    "https://chatgpt.com/#settings/Billing",
  );
});

test("reproduces the extracted Plugins settings Add menu and destinations", async () => {
  const { container } = render(<App />);
  await openSettingsSection("Plugins");

  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  const menu = screen.getByRole("menu");
  expect(menu).toHaveTextContent(
    "Create pluginAdd a marketplaceAdd MCP server",
  );
  expect(menu).toMatchSnapshot();

  fireEvent.click(
    within(menu).getByRole("menuitem", { name: "Add a marketplace" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Add plugin marketplace" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Add MCP server" }));
  expect(
    await screen.findByRole("heading", { name: "Connect to a custom MCP" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".mcp-server-page")).toBeInTheDocument();
});

test("opens the plugin directory from Plugins settings", async () => {
  render(<App />);
  await openSettingsSection("Plugins");
  fireEvent.click(screen.getByRole("button", { name: "Browse directory" }));
  expect(
    await screen.findByRole("heading", { level: 1, name: "Plugins" }),
  ).toBeInTheDocument();
});

test("persists pet selection and controls the native pet overlay", async () => {
  render(<App />);
  await openSettingsSection("Pets");

  const deweyRow = screen.getByText("Dewey").closest(".settings-route-row");
  fireEvent.click(
    within(deweyRow as HTMLElement).getByRole("button", { name: "Select" }),
  );
  expect(localStorage.getItem("avatar-overlay-selected-avatar")).toBe("Dewey");
  expect(localStorage.getItem("avatar-overlay-selected-asset")).toBe("dewey");

  fireEvent.click(screen.getByRole("button", { name: "Wake Pet" }));
  expect(window.chatgptDesktop.setPetOverlay).toHaveBeenCalledWith(
    true,
    "dewey",
  );
  expect(
    screen.getByRole("button", { name: "Tuck Away Pet" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tuck Away Pet" }));
  expect(window.chatgptDesktop.setPetOverlay).toHaveBeenCalledWith(
    false,
    "dewey",
  );

  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() =>
    expect(window.chatgptDesktop.listSkills).toHaveBeenCalled(),
  );

  fireEvent.click(screen.getByRole("button", { name: "Create your own pet" }));
  expect(
    await screen.findByRole("textbox", { name: "Message ChatGPT" }),
  ).toHaveValue("$hatch-pet create a pet based on what you know about me");
});

test("persists and executes the extracted Browser settings actions", async () => {
  window.chatgptDesktop.selectFolder = vi.fn(async () => "/work/downloads");
  const { container } = render(<App />);
  await openSettingsSection("Browser");

  expect(container.querySelector(".browser-settings")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Default browser" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "ChatGPT" }));
  expect(localStorage.getItem("open-link-in-target-preference")).toBe(
    "in-app-browser",
  );

  fireEvent.click(screen.getByRole("button", { name: "Always include" }));
  fireEvent.click(
    screen.getByRole("menuitemradio", { name: "Only on drag selection" }),
  );
  expect(localStorage.getItem("browser-annotation-screenshots-mode")).toBe(
    "necessary",
  );

  fireEvent.click(screen.getByRole("button", { name: "Clear browsing data" }));
  await waitFor(() =>
    expect(window.chatgptDesktop.clearBrowserData).toHaveBeenCalledWith([
      "cookies",
      "siteData",
      "cache",
      "downloads",
      "history",
    ]),
  );

  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  await waitFor(() =>
    expect(
      window.chatgptDesktop.setBrowserDownloadDirectory,
    ).toHaveBeenCalledWith("/work/downloads"),
  );
  expect(screen.getByText("/work/downloads")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("switch", { name: "Ask where to save downloads" }),
  );
  expect(localStorage.getItem("browser-download-prompt-enabled")).toBe("true");
  expect(window.chatgptDesktop.setBrowserDownloadPrompt).toHaveBeenCalledWith(
    true,
  );

  fireEvent.click(screen.getByRole("button", { name: "Import…" }));
  const importDialog = screen.getByRole("dialog", {
    name: "Import from your browser",
  });
  expect(importDialog).toHaveTextContent(
    "Choose data to bring over to the built-in browser",
  );
  expect(importDialog).toHaveTextContent("No profiles found");
  expect(
    within(importDialog).getByRole("button", { name: "Import" }),
  ).toBeDisabled();
  fireEvent.click(within(importDialog).getByRole("button", { name: "Cancel" }));

  const passwordRow = screen
    .getByText("Password manager")
    .closest(".settings-route-row");
  fireEvent.click(within(passwordRow as HTMLElement).getByRole("button"));
  const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(breadcrumb).toHaveTextContent("SettingsBrowserPassword manager");
  fireEvent.click(within(breadcrumb).getByRole("button", { name: "Browser" }));

  fireEvent.click(
    screen.getByRole("button", { name: "Manage download history" }),
  );
  const downloadError = screen
    .getByText("Oops, an error has occurred")
    .closest(".settings-error");
  expect(downloadError).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Update ChatGPT" }));
  expect(window.chatgptDesktop.installUpdate).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    screen.getByRole("heading", { level: 1, name: "Browser" }),
  ).toBeInTheDocument();
});

test("matches the extracted appearance route structure", async () => {
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
  expect(screen.getByText("Dark theme")).toBeInTheDocument();
  expect(screen.getByText("Preferences")).toBeInTheDocument();
  expect(container.querySelector(".appearance-settings")).toMatchSnapshot();
});

test("filters settings navigation and applies appearance controls", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  fireEvent.change(screen.getByPlaceholderText("Search settings…"), {
    target: { value: "browser" },
  });
  expect(screen.getByRole("button", { name: "Browser" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Appearance" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Search settings…"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
  fireEvent.click(screen.getByRole("radio", { name: "Light" }));
  expect(window.chatgptDesktop.setTheme).toHaveBeenCalledWith("light");
  fireEvent.click(screen.getByRole("button", { name: "Import Light theme" }));
  expect(
    screen.getByRole("dialog", { name: "Import theme" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.queryByRole("dialog", { name: "Import theme" }),
  ).not.toBeInTheDocument();
});

test("persists the extracted Appearance preferences and theme import", async () => {
  render(<App />);
  await openSettingsSection("Appearance");

  fireEvent.click(screen.getByRole("switch", { name: "Use pointer cursors" }));
  expect(localStorage.getItem("appearance-use-pointer-cursors")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "On" }));
  expect(localStorage.getItem("appearance-reduce-motion")).toBe("On");

  const uiFontSize = screen.getByLabelText("Sans font size");
  fireEvent.change(uiFontSize, { target: { value: "99" } });
  fireEvent.blur(uiFontSize);
  expect(uiFontSize).toHaveValue(16);
  expect(localStorage.getItem("appearance-ui-font-size")).toBe("16");
  expect(
    document.documentElement.style.getPropertyValue("--font-size-label"),
  ).toBe("16px");

  fireEvent.click(
    screen.getByRole("button", { name: "Plus / minus diff markers" }),
  );
  expect(localStorage.getItem("appearance-diff-markers")).toBe("+/-");
  fireEvent.click(screen.getByRole("switch", { name: "Font smoothing" }));
  expect(localStorage.getItem("appearance-font-smoothing")).toBe("false");
  expect(
    document.documentElement.style.getPropertyValue("--font-smoothing"),
  ).toBe("auto");

  fireEvent.click(screen.getByRole("button", { name: "Light code theme" }));
  const codeThemeMenu = screen.getByRole("menu");
  expect(codeThemeMenu).toHaveTextContent(
    "AaAbsolutelyAaCatppuccinAaCodexAaEverforestAaGitHubAaGruvboxAaLinearAaNotionAaOneAaProofAaRaycastAaRose PineAaSolarizedAaVercelAaVS Code PlusAaXcode",
  );
  expect(codeThemeMenu).toMatchSnapshot();
  fireEvent.click(
    within(codeThemeMenu).getByRole("menuitem", { name: /Xcode/ }),
  );
  expect(localStorage.getItem("appearance-light-code-theme")).toBe("Xcode");
  expect(
    screen.getByRole("button", { name: "Light code theme" }),
  ).toHaveTextContent("Xcode");

  fireEvent.click(screen.getByRole("button", { name: "Import Light theme" }));
  fireEvent.change(screen.getByLabelText("Light theme share string"), {
    target: {
      value: JSON.stringify({
        colors: { Accent: "#ff00aa" },
        contrast: 72,
        fonts: {},
        mode: "Light",
        translucentSidebar: false,
      }),
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Import theme" }));
  expect(screen.getByLabelText("Light accent color")).toHaveValue("#ff00aa");
  expect(screen.getByLabelText("Light contrast")).toHaveValue("72");
  expect(
    screen.getByRole("switch", { name: "Light translucent sidebar" }),
  ).toHaveAttribute("aria-checked", "false");
});

test("renders and filters the complete extracted shortcut catalog", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
  expect(document.querySelectorAll(".shortcut-row")).toHaveLength(106);
  fireEvent.change(screen.getByPlaceholderText("Search shortcuts"), {
    target: { value: "trace recording" },
  });
  expect(document.querySelectorAll(".shortcut-row")).toHaveLength(1);
  expect(screen.getByText("Start Trace Recording")).toBeInTheDocument();
});

test("captures, persists, and clears keyboard shortcut bindings", async () => {
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

  const newChatRow = screen
    .getByText("New chat")
    .closest(".settings-route-row");
  expect(newChatRow).not.toBeNull();
  fireEvent.click(
    within(newChatRow as HTMLElement).getAllByRole("button", {
      name: "Change shortcut for New chat",
    })[0],
  );
  const capture = screen.getByRole("textbox", {
    name: "Shortcut capture for New chat",
  });
  expect(capture).toHaveValue("Press shortcut");
  expect(container.querySelector(".shortcut-capture")).toMatchSnapshot();
  fireEvent.keyDown(capture, { key: "k", metaKey: true });
  expect(
    within(newChatRow as HTMLElement).getAllByRole("button", {
      name: "Change shortcut for New chat",
    }),
  ).toHaveLength(2);
  expect(
    JSON.parse(localStorage.getItem("chatgpt.keyboard-shortcuts") ?? "{}")[
      "New chat"
    ],
  ).toEqual(["⌘K", "⇧⌘O"]);

  fireEvent.click(
    within(newChatRow as HTMLElement).getAllByRole("button", {
      name: "Clear shortcut for New chat",
    })[0],
  );
  expect(within(newChatRow as HTMLElement).queryByText("⌘K")).toBeNull();

  fireEvent.click(
    screen.getByRole("button", {
      name: "Set shortcut for Open in new window",
    }),
  );
  fireEvent.keyDown(
    screen.getByRole("textbox", {
      name: "Shortcut capture for Open in new window",
    }),
    { altKey: true, key: "w", metaKey: true },
  );
  expect(screen.getByText("⌥⌘W")).toBeInTheDocument();
});

test("includes the complete browser settings hierarchy", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open profile menu" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /Settings/ }));
  fireEvent.click(screen.getByRole("button", { name: "Browser" }));
  expect(screen.getByText("Downloads")).toBeInTheDocument();
  expect(screen.getByText("Download history")).toBeInTheDocument();
  expect(screen.getByText("Permissions")).toBeInTheDocument();
  expect(screen.getByText("Site settings")).toBeInTheDocument();
});

test("opens a catalog thread in the conversation route", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await waitFor(() => {
    expect(
      screen.getByText("I fixed the parser and added coverage."),
    ).toBeInTheDocument();
  });
  expect(
    screen.getByRole("button", { name: "Toggle side panel" }),
  ).toBeInTheDocument();
});

test("matches the compressed thread chrome and restores its sidebar", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
  const titlebar = container.querySelector(".titlebar--sidebar-collapsed");
  const collapsedControls = titlebar?.querySelector(".titlebar__left");
  expect(container.querySelector(".sidebar")).toBeNull();
  expect(
    within(collapsedControls as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Show sidebar", "Back", "Forward", "New chat"]);
  expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
  expect(titlebar).toMatchSnapshot();

  fireEvent.click(screen.getByRole("button", { name: "Toggle summary" }));
  const summary = screen.getByRole("dialog", { name: "Environment" });
  expect(summary).toHaveTextContent(
    "EnvironmentChanges+0 -0Localwork/codexCommit or pushCreate pull requestBackground processesComputer UsePicture in PictureHideSourcesWeb searchView all",
  );
  expect(summary).toMatchSnapshot();

  fireEvent(window, new Event("resize"));
  expect(
    screen.getByRole("button", { name: "Show sidebar" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
  expect(
    screen.getByRole("button", { name: "Hide sidebar" }),
  ).toBeInTheDocument();

  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 720,
  });
  fireEvent(window, new Event("resize"));
  expect(
    screen.getByRole("button", { name: "Show sidebar" }),
  ).toBeInTheDocument();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  fireEvent(window, new Event("resize"));
  expect(
    screen.getByRole("button", { name: "Show sidebar" }),
  ).toBeInTheDocument();
});

test("matches the extracted thread overflow menu", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  fireEvent.click(screen.getByRole("button", { name: "Chat actions" }));
  const menu = screen.getByRole("menu", { name: "Chat actions" });
  expect(menu).toHaveTextContent(
    "Pin chat⌥⌘PRename chat⌥⌘RArchive chat⇧⌘AOpen side chat⌥⌘SCopyContinue in…Add scheduled task…",
  );
  expect(menu).toMatchSnapshot();
});

test("matches the extracted thread copy submenu", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  fireEvent.click(screen.getByRole("button", { name: "Chat actions" }));
  fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "Copy" }));
  const submenu = screen.getByRole("menu", { name: "Copy" });
  expect(submenu).toHaveTextContent(
    "Copy working directory⇧⌘CCopy session ID⌥⌘CCopy deeplink⌥⌘LCopy as Markdown",
  );
  expect(submenu).toMatchSnapshot();
});

test("matches the extracted rename chat dialog", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  fireEvent.click(screen.getByRole("button", { name: "Chat actions" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /Rename chat/ }));
  const dialog = screen.getByRole("dialog", { name: "Rename chat" });
  expect(screen.getByLabelText("Chat title")).toHaveAttribute(
    "placeholder",
    "Add a title…",
  );
  expect(dialog).toMatchSnapshot();
});

test("renders the extracted conversation activity and artifact groups", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  const completeItem = (item: Record<string, unknown>) => {
    act(() => {
      hostEventSubscriber?.({
        kind: "notification",
        method: "item/completed",
        params: { item, threadId: thread.id, turnId: thread.turns[0].id },
      });
    });
  };
  completeItem({
    appContext: { appName: "GitHub", connectorId: "github" },
    arguments: { query: "desktop UI" },
    id: "tool-1",
    result: { content: [{ text: "Found 3 issues", type: "text" }] },
    server: "github",
    status: "completed",
    tool: "search_issues",
    type: "mcpToolCall",
  });
  completeItem({
    action: { query: "Codex desktop", type: "search" },
    id: "search-1",
    query: "Codex desktop",
    type: "webSearch",
  });
  completeItem({
    arguments: { title: "Build health" },
    id: "dynamic-1",
    namespace: "visualize",
    status: "completed",
    success: true,
    tool: "render_chart",
    type: "dynamicToolCall",
  });
  completeItem({ id: "compaction-1", type: "contextCompaction" });
  completeItem({
    id: "image-view-1",
    path: "/work/codex/mockup.png",
    type: "imageView",
  });
  completeItem({
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
    id: "files-1",
    status: "completed",
    type: "fileChange",
  });
  completeItem({
    id: "plan-1",
    text: "# Implementation plan\n\n1. Audit the shell\n2. Match the UI",
    type: "plan",
  });

  expect(screen.getByText("Edited 2 files")).toBeInTheDocument();
  expect(screen.getByText("Implementation plan")).toBeInTheDocument();
  expect(container.querySelector(".thread-timeline")).toMatchSnapshot();
});

test("routes conversation links through the extracted browser preference", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  localStorage.setItem("open-link-in-target-preference", "in-app-browser");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/completed",
      params: {
        item: {
          id: "agent-1",
          text: "Read the [documentation](https://example.com/docs).",
          type: "agentMessage",
        },
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  fireEvent.click(await screen.findByRole("link", { name: "documentation" }));
  expect(screen.getByRole("tab", { name: "New tab" })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Enter a URL")).toHaveValue(
    "https://example.com/docs",
  );
  expect(document.querySelector("webview")).toHaveAttribute(
    "src",
    "https://example.com/docs",
  );
  expect(window.chatgptDesktop.openExternal).not.toHaveBeenCalledWith(
    "https://example.com/docs",
  );
});

test("opens the terminal shortcut in the configured extracted location", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  localStorage.setItem("general-terminal-location", "Bottom");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  fireEvent.keyDown(window, { code: "Backquote", ctrlKey: true });
  expect(
    screen.getByRole("button", { name: "Close bottom panel" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close bottom panel" }));

  localStorage.setItem("general-terminal-location", "Right");
  fireEvent.keyDown(window, { code: "Backquote", ctrlKey: true });
  expect(screen.getByRole("tab", { name: "codex" })).toBeInTheDocument();
});

test("renders extracted live context usage in the thread composer", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  localStorage.setItem("general-show-context-usage", "true");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "thread/tokenUsage/updated",
      params: {
        threadId: thread.id,
        tokenUsage: {
          last: { totalTokens: 40_000 },
          modelContextWindow: 200_000,
          total: { totalTokens: 50_000 },
        },
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(
    screen.getByRole("img", { name: "Context usage: 20%" }),
  ).toBeInTheDocument();
  const indicator = container.querySelector(
    ".composer-context-usage",
  ) as HTMLElement;
  expect(within(indicator).getByRole("tooltip")).toHaveTextContent(
    "Context window:20% used (80% left)40k / 200k tokens used",
  );
  expect(indicator).toMatchSnapshot();
});

test("steers an active turn using the extracted follow-up default", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");
  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "turn/started",
      params: {
        threadId: thread.id,
        turn: { id: "turn-live", items: [], status: "inProgress" },
      },
    });
  });

  fireEvent.change(screen.getByLabelText("Do anything"), {
    target: { value: "Focus on the parser" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Steer" }));
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("turn/steer", {
      expectedTurnId: "turn-live",
      input: [{ text: "Focus on the parser", type: "text" }],
      threadId: thread.id,
    }),
  );
});

test("streams a follow-up turn incrementally and settles its actions", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  const startedAt = Date.now() - 43_000;
  requestMock.mockResolvedValueOnce({
    turn: {
      id: "turn-new",
      items: [],
      startedAt,
      status: "inProgress",
    },
  });

  fireEvent.change(screen.getByLabelText("Do anything"), {
    target: { value: "Show the streaming lifecycle" },
  });
  fireEvent.click(screen.getByLabelText("Send"));
  expect(
    await screen.findByText("Show the streaming lifecycle"),
  ).toBeInTheDocument();
  expect(screen.getByText("Planning next moves")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Stop generating" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Working for 43s/)).toBeInTheDocument();
  expect(container.querySelector(".work-status-divider")).toMatchSnapshot();

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/started",
      params: {
        item: { id: "reasoning-live", summary: [], type: "reasoning" },
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/reasoning/summaryTextDelta",
      params: {
        delta: "Inspecting the existing conversation",
        itemId: "reasoning-live",
        summaryIndex: 0,
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
  });
  expect(
    screen.getByText("Inspecting the existing conversation"),
  ).toBeInTheDocument();

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/started",
      params: {
        item: { id: "plan-live", text: "", type: "plan" },
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/plan/delta",
      params: {
        delta: "1. Inspect the project history",
        itemId: "plan-live",
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/started",
      params: {
        item: { id: "agent-live", text: "", type: "agentMessage" },
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/agentMessage/delta",
      params: {
        delta: "Streaming",
        itemId: "agent-live",
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
  });
  expect(screen.getByText("Inspect the project history")).toBeInTheDocument();
  expect(screen.queryByText("Planning next moves")).not.toBeInTheDocument();
  const liveMessage = screen.getByText("Streaming").closest("article");
  expect(liveMessage).toHaveAttribute("aria-busy", "true");
  expect(
    liveMessage
      ?.closest(".agent-message-group")
      ?.querySelector(".agent-message-actions"),
  ).toBeNull();

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "item/agentMessage/delta",
      params: {
        delta: " response complete.",
        itemId: "agent-live",
        threadId: thread.id,
        turnId: "turn-new",
      },
    });
  });
  expect(screen.getByText("Streaming response complete.")).toBeInTheDocument();
  expect(
    container.querySelector('[data-turn-status="inProgress"]'),
  ).toMatchSnapshot();

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "turn/completed",
      params: {
        threadId: thread.id,
        turn: {
          completedAt: startedAt + 43_000,
          id: "turn-new",
          items: [
            {
              id: "agent-live",
              text: "Streaming response complete.",
              type: "agentMessage",
            },
          ],
          status: "completed",
        },
      },
    });
  });
  const completedMessage = screen
    .getByText("Streaming response complete.")
    .closest("article");
  expect(completedMessage).toHaveAttribute("aria-busy", "false");
  expect(
    completedMessage
      ?.closest(".agent-message-group")
      ?.querySelector(".agent-message-actions"),
  ).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Stop generating" })).toBeNull();
  expect(screen.getByText("Worked for 43s")).toBeInTheDocument();
});

test("renders and resolves the extracted inline command approval card", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "approval-1",
      kind: "request",
      method: "item/commandExecution/requestApproval",
      params: {
        command: "pnpm run build",
        itemId: "command-1",
        proposedExecpolicyAmendment: ["pnpm", "run", "build"],
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(
    screen.getByText("Allow ChatGPT to run this command?"),
  ).toBeInTheDocument();
  expect(screen.getByText("pnpm run build")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
  expect(
    container.querySelector("[data-codex-approval-surface]"),
  ).toMatchSnapshot();
  expect(window.chatgptDesktop.showNotification).toHaveBeenCalledWith({
    body: "Approval required",
    id: "approval-approval-1",
    title: "Command approval",
  });

  fireEvent.click(screen.getByRole("button", { name: "Deny" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith("approval-1", {
    decision: "decline",
  });
  expect(
    screen.queryByText("Allow ChatGPT to run this command?"),
  ).not.toBeInTheDocument();
});

test("sends extracted desktop completion and question notifications", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  localStorage.setItem("chatgpt.turn-notifications", "always");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");
  vi.mocked(window.chatgptDesktop.showNotification).mockClear();

  act(() => {
    hostEventSubscriber?.({
      kind: "notification",
      method: "turn/completed",
      params: { threadId: thread.id, turn: thread.turns[0] },
    });
  });
  expect(window.chatgptDesktop.showNotification).toHaveBeenCalledWith({
    body: "I fixed the parser and added coverage.",
    id: "turn-turn-1",
    title: "Fix parser edge cases",
  });

  vi.mocked(window.chatgptDesktop.showNotification).mockClear();
  act(() => {
    hostEventSubscriber?.({
      id: "question-1",
      kind: "request",
      method: "item/tool/requestUserInput",
      params: {
        questions: [
          { id: "database", question: "Which database?" },
          { id: "hosting", question: "Which hosting provider?" },
        ],
        threadId: "thread-background",
        turnId: "turn-background",
      },
    });
  });
  expect(window.chatgptDesktop.showNotification).toHaveBeenCalledWith({
    body: "Answer 2 questions to proceed.",
    id: "question-question-1",
    title: "Need your input",
  });

  vi.mocked(window.chatgptDesktop.showNotification).mockClear();
  act(() => {
    hostEventSubscriber?.({
      id: "option-background",
      kind: "request",
      method: "item/tool/requestOptionPicker",
      params: {
        allowMultiple: true,
        options: [{ label: "GitHub" }],
        question: "Which integrations?",
        threadId: "thread-background",
        turnId: "turn-background",
      },
    });
  });
  expect(window.chatgptDesktop.showNotification).toHaveBeenCalledWith({
    body: "Answer a question to proceed.",
    id: "question-option-background",
    title: "Need your input",
  });
});

test("renders and answers the extracted user-input question card", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "question-current",
      kind: "request",
      method: "item/tool/requestUserInput",
      params: {
        questions: [
          {
            id: "database",
            isOther: true,
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
        ],
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(screen.getByText("Asking questions")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "PostgreSQL" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(
    container.querySelector("[data-codex-composer-request-navigation]"),
  ).toMatchSnapshot();

  fireEvent.click(screen.getByRole("radio", { name: "SQLite" }));
  await waitFor(() =>
    expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
      "question-current",
      {
        answers: {
          database: { answers: ["SQLite"] },
        },
      },
    ),
  );
  expect(
    screen.queryByText("Which database should I use?"),
  ).not.toBeInTheDocument();
});

test("renders and resolves the extracted filesystem permission card", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");
  const permissions = {
    fileSystem: {
      entries: [
        {
          access: "write",
          path: { path: "/Users/reference/Shared/output", type: "path" },
        },
      ],
      globScanMaxDepth: null,
    },
    network: null,
  };

  act(() => {
    hostEventSubscriber?.({
      id: "permission-current",
      kind: "request",
      method: "item/permissions/requestApproval",
      params: {
        permissions,
        reason: "The build needs access to generated files.",
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(screen.getByText("Permissions")).toBeInTheDocument();
  expect(screen.getByTitle("/Users/reference/Shared/output")).toHaveTextContent(
    "output",
  );
  expect(
    screen.getByText("The build needs access to generated files."),
  ).toBeInTheDocument();
  expect(
    container.querySelector("[data-codex-approval-surface]"),
  ).toMatchSnapshot();

  fireEvent.click(screen.getByRole("button", { name: "Approval options" }));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Allow this conversation" }),
  );
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "permission-current",
    {
      permissions,
      scope: "session",
      strictAutoReview: false,
    },
  );
});

test("renders and answers the extracted option picker", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "option-current",
      kind: "request",
      method: "item/tool/requestOptionPicker",
      params: {
        allowMultiple: true,
        options: [{ label: "GitHub" }, { label: "Slack" }, { label: "Notion" }],
        question: "Which integrations should I configure?",
        skipLabel: "Not now",
        submitLabel: "Continue",
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(
    screen.getByRole("heading", {
      name: "Which integrations should I configure?",
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "GitHub" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(container.querySelector(".option-picker-card")).toMatchSnapshot();

  fireEvent.click(screen.getByRole("checkbox", { name: "GitHub" }));
  fireEvent.change(screen.getByPlaceholderText("Something else"), {
    target: { value: "Linear" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith("option-current", {
    action: "submit",
    freeformAnswer: "Linear",
    selectedOptions: ["GitHub"],
  });
  expect(
    screen.queryByText("Which integrations should I configure?"),
  ).not.toBeInTheDocument();
});

test("renders and answers the extracted setup context picker", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "context-current",
      kind: "request",
      method: "item/tool/requestSetupCodexContextPicker",
      params: {
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(
    await screen.findByRole("heading", {
      name: "Where can we pull context from?",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText("Google Drive")).toBeInTheDocument();
  expect(
    screen.getByText("Read decisions and team context"),
  ).toBeInTheDocument();
  expect(container.querySelector(".setup-context-card")).toMatchSnapshot();

  const slack = screen
    .getByText("Slack")
    .closest(".setup-context-card__source");
  expect(slack).not.toBeNull();
  fireEvent.click(
    within(slack as HTMLElement).getByRole("button", { name: "Connect" }),
  );
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("plugin/install", {
      pluginName: "slack",
      remoteMarketplaceName: "openai-curated",
    }),
  );
  expect(
    within(slack as HTMLElement).getByRole("button", { name: "Connected" }),
  ).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith("context-current", {
    action: "continue",
    selectedSources: ["slack"],
    step: "context",
  });
});

test("renders and answers the extracted MCP form elicitation", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "mcp-form-current",
      kind: "request",
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
    });
  });

  expect(
    screen.getByRole("heading", { name: "Configure the deployment" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Staging" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(
    container.querySelector(".mcp-elicitation-form-card"),
  ).toMatchSnapshot();

  fireEvent.click(screen.getByRole("radio", { name: "Staging" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Region/ }), {
    target: { value: "us-east-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "mcp-form-current",
    {
      _meta: null,
      action: "accept",
      content: {
        confirm: false,
        environment: "staging",
        region: "us-east-1",
        replicas: 2,
      },
    },
  );
});

test("renders and resolves the extracted MCP URL elicitation", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "mcp-url-current",
      kind: "request",
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
    });
  });

  expect(screen.getByText("Action required")).toBeInTheDocument();
  expect(container.querySelector(".mcp-url-card")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Open link ⏎" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://github.com/login/oauth/authorize?client_id=reference",
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue ⏎" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith("mcp-url-current", {
    _meta: null,
    action: "accept",
    content: {},
  });
});

test("routes and answers an extracted MCP tool-call approval", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "mcp-tool-current",
      kind: "request",
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
    });
  });

  expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
  expect(screen.getByText("openai/codex")).toBeInTheDocument();
  expect(container.querySelector(".mcp-tool-approval-card")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Always allow" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "mcp-tool-current",
    {
      _meta: { persist: "always" },
      action: "accept",
      content: {},
    },
  );
});

test("routes and opens an extracted MCP tool suggestion", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "mcp-suggestion-current",
      kind: "request",
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
    });
  });

  expect(screen.getByText("Install GitHub?")).toBeInTheDocument();
  expect(container.querySelector(".mcp-suggestion-card")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Install ⏎" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://chatgpt.com/apps/github",
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue ⏎" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "mcp-suggestion-current",
    { _meta: null, action: "accept", content: {} },
  );
});

test("routes and opens an extracted connector authorization", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "mcp-connector-auth-current",
      kind: "request",
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
    });
  });

  expect(screen.getByText("Connect GitHub")).toBeInTheDocument();
  expect(
    screen.getByText(
      "ChatGPT needs access to GitHub to help with this request",
    ),
  ).toBeInTheDocument();
  expect(container.querySelector(".mcp-suggestion-card")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Connect ⏎" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://chatgpt.com/apps/github",
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue ⏎" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "mcp-connector-auth-current",
    { _meta: null, action: "accept", content: {} },
  );
});

const openAIFormImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=";

const openAIImagePicker = {
  items: [
    { id: "minimal", image: openAIFormImage, title: "Minimal" },
    { id: "editorial", image: openAIFormImage, title: "Editorial" },
    { id: "bold", image: openAIFormImage, title: "Bold" },
  ],
  title: "Choose a template",
  type: "openai/imagePicker",
};

test("renders and answers the extracted extended OpenAI form", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "openai-form-current",
      kind: "request",
      method: "mcpServer/elicitation/request",
      params: {
        _meta: null,
        message: "Configure your design",
        mode: "openai/form",
        requestedSchema: {
          properties: {
            projectName: {
              description: "Name your new project",
              title: "Project name",
              type: "string",
            },
            template: openAIImagePicker,
          },
          required: ["projectName", "template"],
          type: "object",
        },
        serverName: "design-tools",
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(
    screen.getByText("design-tools requests information"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(container.querySelector(".openai-form-card")).toMatchSnapshot();
  fireEvent.change(screen.getByRole("textbox", { name: /Project name/ }), {
    target: { value: "Launch" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "Minimal" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "openai-form-current",
    {
      _meta: null,
      action: "accept",
      content: { projectName: "Launch", template: "minimal" },
    },
  );
});

test("matches the extracted image-picker-only OpenAI form", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "openai-image-current",
      kind: "request",
      method: "mcpServer/elicitation/request",
      params: {
        _meta: null,
        message: "Configure your design",
        mode: "openai/form",
        requestedSchema: {
          properties: { template: openAIImagePicker },
          required: ["template"],
          type: "object",
        },
        serverName: "design-tools",
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(screen.queryByText("Configure your design")).not.toBeInTheDocument();
  expect(container.querySelector(".openai-form-card")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("radio", { name: "Editorial" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "openai-image-current",
    {
      _meta: null,
      action: "accept",
      content: { template: "editorial" },
    },
  );
});

test("matches and skips an unsupported extracted OpenAI form", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "openai-unsupported-current",
      kind: "request",
      method: "mcpServer/elicitation/request",
      params: {
        _meta: null,
        message: "Configure your design",
        mode: "openai/form",
        requestedSchema: {
          properties: { layout: { type: "openai/unknownPicker" } },
          type: "object",
        },
        serverName: "design-tools",
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(
    screen.getByText("This version of ChatGPT can’t show this request yet"),
  ).toBeInTheDocument();
  expect(container.querySelector(".openai-form-unsupported")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "openai-unsupported-current",
    { _meta: null, action: "decline", content: null },
  );
});

test("auto-denies an empty extracted permission profile", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");

  act(() => {
    hostEventSubscriber?.({
      id: "permission-empty",
      kind: "request",
      method: "item/permissions/requestApproval",
      params: {
        permissions: { fileSystem: { entries: [] }, network: null },
        threadId: thread.id,
        turnId: thread.turns[0].id,
      },
    });
  });

  expect(window.chatgptDesktop.answer).toHaveBeenCalledWith(
    "permission-empty",
    { permissions: {}, scope: "turn" },
  );
  expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
});

test("matches the extracted create-project dialog", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Add new project" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Create project" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".project-create-dialog")).toMatchSnapshot();
});

test("keeps side-panel tabs while opening the extracted new-tab menu", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  const { container } = render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");
  fireEvent.click(screen.getByRole("button", { name: "Toggle side panel" }));
  fireEvent.click(screen.getByRole("button", { name: /Side chat/ }));
  fireEvent.click(screen.getByTitle("Open side panel tab"));

  expect(screen.getByRole("menu")).toHaveTextContent(
    "Files⌘PSide chat⌥⌘SBrowser⌘TTerminal",
  );
  expect(container.querySelector(".side-panel")).toMatchSnapshot();

  fireEvent.click(screen.getByRole("menuitem", { name: /Browser/ }));
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Side chat",
    "New tab",
  ]);
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  expect(screen.getByRole("tabpanel", { name: "New tab" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Side chat" }));
  const sideChat = screen.getByRole("tabpanel", { name: "Side chat" });
  fireEvent.change(within(sideChat).getByLabelText("Do anything"), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(screen.getByRole("tab", { name: "New tab" }));
  fireEvent.click(screen.getByRole("tab", { name: "Side chat" }));
  expect(
    within(screen.getByRole("tabpanel", { name: "Side chat" })).getByLabelText(
      "Do anything",
    ),
  ).toHaveValue("Keep this draft");
  const activeSideChat = screen.getByRole("tabpanel", { name: "Side chat" });

  fireEvent.click(
    within(activeSideChat).getByRole("button", { name: /Ask for approval/ }),
  );
  expect(
    within(activeSideChat).getByRole("menu", { name: "Permissions" }),
  ).toHaveTextContent("How should ChatGPT actions be approved?");
  fireEvent.click(
    within(activeSideChat).getByRole("menuitemradio", {
      name: /Full access/,
    }),
  );
  expect(
    within(activeSideChat).getByRole("button", { name: /Full access/ }),
  ).toBeInTheDocument();

  fireEvent.click(
    activeSideChat.querySelector(".codex-composer-model-trigger")!,
  );
  expect(
    within(activeSideChat).getByRole("menu", { name: "Model and effort" }),
  ).toHaveTextContent("ModelGPT-5.2 CodexEffortMedium");
  fireEvent.click(
    within(activeSideChat).getByRole("button", {
      name: "Turn off IDE context",
    }),
  );
  expect(
    within(activeSideChat).queryByRole("button", {
      name: "Turn off IDE context",
    }),
  ).not.toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole("tabpanel", { name: "Side chat" })).getByLabelText(
      "Send",
    ),
  );
  await waitFor(() => {
    expect(requestMock).toHaveBeenCalledWith("thread/fork", {
      cwd: thread.cwd,
      ephemeral: true,
      excludeTurns: true,
      threadId: thread.id,
    });
    expect(requestMock).toHaveBeenCalledWith(
      "thread/inject_items",
      expect.objectContaining({ threadId: "thread-side" }),
    );
    expect(requestMock).toHaveBeenCalledWith(
      "turn/start",
      expect.objectContaining({ threadId: "thread-side" }),
    );
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Close Keep this draft tab" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Close side chat?" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".side-chat-close-dialog")).toMatchSnapshot();
  fireEvent.click(screen.getByRole("checkbox", { name: "Don’t ask again" }));
  fireEvent.click(screen.getByRole("button", { name: "Close side chat" }));
  expect(localStorage.getItem("skip-side-chat-close-confirmation")).toBe(
    "true",
  );
  expect(
    screen.queryByRole("tab", { name: "Side chat" }),
  ).not.toBeInTheDocument();
  expect(requestMock).toHaveBeenCalledWith("thread/archive", {
    threadId: "thread-side",
  });
});

test("routes unauthenticated users through the ChatGPT sign-in flow", async () => {
  authenticated = false;
  render(<App />);
  await screen.findByRole("heading", { name: "Sign in to ChatGPT" });
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Continue to sign in" }),
  );
  await waitFor(() => {
    expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
      "https://auth.example",
    );
  });
});

test("applies the selected access policy to new chats and turns", async () => {
  localStorage.setItem("chatgpt.product-mode", "codex");
  render(<App />);
  fireEvent.click(await screen.findByText("Fix parser edge cases"));
  await screen.findByText("I fixed the parser and added coverage.");
  fireEvent.click(
    await screen.findByRole("button", { name: /Ask for approval/ }),
  );
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Full access/ }));
  fireEvent.change(screen.getByLabelText("Do anything"), {
    target: { value: "Inspect this project" },
  });
  fireEvent.click(screen.getByLabelText("Send"));
  await waitFor(() => {
    expect(requestMock).toHaveBeenCalledWith(
      "turn/start",
      expect.objectContaining({
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
      }),
    );
  });
});
