import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import type { DesktopBridge } from "../../shared/bridge";

const submit = vi.fn();
const interrupt = vi.fn();
const session = {
  account: { type: "chatgpt" },
  activeTurnId: null as string | null,
  current: null,
  editQueuedPrompt: vi.fn(),
  interrupt,
  localProjects: [] as Array<{
    id: string;
    name: string;
    rootPaths: string[];
  }>,
  models: [{ label: "Default", value: "" }],
  permissionMode: "full",
  project: null as string | null,
  queue: [],
  removeQueuedPrompt: vi.fn(),
  selectedProjectId: null as string | null,
  steerQueuedPrompt: vi.fn(),
  submit,
  setPermissionMode: vi.fn(),
};

vi.mock("../state/session", () => ({ useSession: () => session }));
vi.mock("../state/product-mode", () => ({
  useProductMode: () => ({ mode: "chatgpt" }),
}));

import { Composer } from "./Composer";

beforeEach(() => {
  localStorage.clear();
  window.chatgptDesktop = {
    getGitRoot: vi.fn(async () => null),
    openExternal: vi.fn(async () => undefined),
  } as unknown as DesktopBridge;
  submit.mockClear();
  interrupt.mockClear();
  session.activeTurnId = null;
  session.current = null;
  session.localProjects = [];
  session.permissionMode = "full";
  session.project = null;
  session.selectedProjectId = null;
  session.setPermissionMode.mockClear();
});

test("submits from the mapped thread composer", () => {
  render(<Composer />);
  fireEvent.change(screen.getByLabelText("Do anything"), {
    target: { value: "Run the tests" },
  });
  fireEvent.click(screen.getByLabelText("Send"));
  expect(submit).toHaveBeenCalledWith({
    attachments: [],
    effort: "medium",
    model: "",
    text: "Run the tests",
  });
});

test("changes send into a queue action while a turn is active", () => {
  session.activeTurnId = "turn-1";
  localStorage.setItem("general-follow-up-behavior", "Queue");
  render(<Composer />);
  fireEvent.change(screen.getByLabelText("Do anything"), {
    target: { value: "Then lint" },
  });
  expect(screen.getByLabelText("Queue")).toBeEnabled();
});

test("uses the extracted modified shortcut to invert follow-up behavior", () => {
  session.activeTurnId = "turn-1";
  render(<Composer />);
  const composer = screen.getByLabelText("Do anything");
  fireEvent.change(composer, { target: { value: "Try a different approach" } });
  expect(screen.getByLabelText("Steer")).toBeEnabled();
  fireEvent.keyDown(composer, {
    key: "Enter",
    metaKey: true,
    shiftKey: true,
  });
  expect(submit).toHaveBeenCalledWith(
    {
      attachments: [],
      effort: "medium",
      model: "",
      text: "Try a different approach",
    },
    "queue",
  );
});

test("honors the configured extracted Enter behavior", () => {
  localStorage.setItem("chatgpt.composer-enter-behavior", "cmdAlways");
  render(<Composer />);
  const composer = screen.getByLabelText("Do anything");
  fireEvent.change(composer, { target: { value: "Run the tests" } });
  fireEvent.keyDown(composer, { key: "Enter" });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(composer, { key: "Enter", metaKey: true });
  expect(submit).toHaveBeenCalledWith({
    attachments: [],
    effort: "medium",
    model: "",
    text: "Run the tests",
  });
});

test("matches the extracted detailed permissions menu interactions", () => {
  session.permissionMode = "ask";
  const { container } = render(<Composer />);
  const trigger = screen.getByRole("button", { name: "Ask for approval" });
  fireEvent.click(trigger);

  const menu = screen.getByRole("menu", { name: "Permissions" });
  expect(trigger).toHaveAttribute("aria-controls", menu.id);
  expect(
    within(menu).getByRole("menuitemradio", { name: /Ask for approval/ }),
  ).toHaveAttribute("aria-checked", "true");
  const fullAccess = within(menu).getByRole("menuitemradio", {
    name: /Full access/,
  });
  expect(fullAccess).toHaveAttribute("aria-checked", "false");
  expect(menu).toMatchSnapshot();

  fireEvent.click(within(menu).getByRole("button", { name: "Learn more" }));
  expect(window.chatgptDesktop.openExternal).toHaveBeenCalledWith(
    "https://developers.openai.com/codex/security/",
  );

  const ask = within(menu).getByRole("menuitemradio", {
    name: /Ask for approval/,
  });
  ask.focus();
  fireEvent.keyDown(ask, { key: "ArrowDown" });
  expect(fullAccess).toHaveFocus();
  fireEvent.click(fullAccess);
  expect(session.setPermissionMode).toHaveBeenCalledWith("full");
  expect(
    screen.queryByRole("menu", { name: "Permissions" }),
  ).not.toBeInTheDocument();

  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(
    screen.queryByRole("menu", { name: "Permissions" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector(".codex-permissions-menu")).toBeNull();
});

test("matches the extracted project-aware run-location menu", async () => {
  session.project = "/work/codex";
  session.selectedProjectId = "project-1";
  session.localProjects = [
    {
      id: "project-1",
      name: "Codex",
      rootPaths: ["/work/codex", "/work/docs"],
    },
  ];
  window.chatgptDesktop.getGitRoot = vi.fn(async () => "/work/codex");

  render(<Composer variant="codexHome" />);
  fireEvent.click(await screen.findByRole("button", { name: "Local" }));

  const menu = screen.getByRole("menu", { name: "Work in" });
  expect(menu).toMatchSnapshot();
  expect(
    screen.getByRole("menuitem", { name: /New worktree · codex/ }),
  ).toHaveTextContent("Work locally in 1 other folder");
  expect(
    screen.getByRole("menuitem", { name: /Cloud · codex/ }),
  ).toHaveTextContent("No access to 1 other folder");
});
