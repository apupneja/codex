import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopPreferences, Model } from "../../shared/types";
import { Composer } from "./Composer";

const preferences: DesktopPreferences = {
  approvalPolicy: "on-request",
  editorFontSize: 13,
  lastWorkspace: "/repo",
  recentWorkspaces: ["/repo"],
  rightPanelOpen: true,
  sandbox: "workspace-write",
  selectedEffort: "high",
  selectedModel: "gpt-test",
  sidebarOpen: true,
  theme: "dark",
  uiFontSize: 13,
};

const model = {
  id: "gpt-test",
  displayName: "GPT Test",
  isDefault: true,
} as Model;

describe("Composer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits on Enter and keeps Shift+Enter available for multiline input", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={onSubmit}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Describe a task" });
    fireEvent.change(input, { target: { value: "Build the feature" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        attachments: [],
        contexts: [],
        text: "Build the feature",
      }),
    );
    expect(input).toHaveValue("");
  });

  it("keeps the draft when submission is cancelled or fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={onSubmit}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Describe a task" });
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(input).toHaveValue("Keep this draft");
  });

  it("summarizes model and reasoning as one selection", () => {
    const constrainedModel = {
      ...model,
      defaultReasoningEffort: "minimal",
      supportedReasoningEfforts: [
        { reasoningEffort: "minimal", description: "Fastest" },
        { reasoningEffort: "medium", description: "Balanced" },
      ],
    } as Model;
    render(
      <Composer
        active={false}
        models={[constrainedModel]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    expect(screen.getByRole("button", { name: "Model" })).toHaveTextContent(
      "GPT TestMinimal",
    );
    expect(
      screen.queryByRole("button", { name: "Reasoning effort" }),
    ).not.toBeInTheDocument();
  });

  it("updates model and reasoning from the configuration menu", () => {
    const updatePreferences = vi.fn().mockResolvedValue(preferences);
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={updatePreferences}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Effort/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Fast/ }));

    expect(updatePreferences).toHaveBeenCalledWith({
      selectedEffort: "low",
      selectedModel: "gpt-test",
    });
  });

  it("switches models from the model submenu", () => {
    const updatePreferences = vi.fn().mockResolvedValue(preferences);
    const secondModel = {
      ...model,
      displayName: "GPT Other",
      id: "gpt-other",
      isDefault: false,
    } as Model;
    render(
      <Composer
        active={false}
        models={[model, secondModel]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={updatePreferences}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Model GPT Test/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "GPT Other" }));

    expect(updatePreferences).toHaveBeenCalledWith({
      selectedEffort: "high",
      selectedModel: "gpt-other",
    });
  });

  it("uses the single-row conversation controls and swaps voice for send", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <Composer
        active={false}
        compact
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={onSubmit}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Send follow-up" });
    expect(
      screen.getByRole("button", { name: "Add agents, context, tools" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start voice input" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Model" })).toHaveTextContent(
      "GPT TestHigh",
    );

    fireEvent.change(input, { target: { value: "Ship the UI" } });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        attachments: [],
        contexts: [],
        text: "Ship the UI",
      }),
    );
  });

  it("moves compact controls below multiline text", async () => {
    const { container } = render(
      <Composer
        active={false}
        compact
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Send follow-up" }), {
      target: { value: "First line\nSecond line" },
    });

    await waitFor(() =>
      expect(container.querySelector(".compact-composer-row")).toHaveClass(
        "multiline",
      ),
    );
    expect(screen.getAllByRole("button", { name: "Model" })).toHaveLength(1);
  });

  it("moves compact controls before paint when the composer becomes narrow", async () => {
    let resize: (() => void) | null = null;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resize = () => callback([], this as unknown as ResizeObserver);
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const { container } = render(
      <Composer
        active={false}
        compact
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Send follow-up" });
    const row = container.querySelector<HTMLElement>(".compact-composer-row")!;
    const addButton = screen.getByRole("button", {
      name: "Add agents, context, tools",
    });
    const controls = container.querySelector<HTMLElement>(
      ".compact-composer-controls",
    )!;
    let rowWidth = 900;
    vi.spyOn(row, "getBoundingClientRect").mockImplementation(
      () => ({ width: rowWidth }) as DOMRect,
    );
    vi.spyOn(addButton, "getBoundingClientRect").mockReturnValue({
      width: 24,
    } as DOMRect);
    vi.spyOn(controls, "getBoundingClientRect").mockReturnValue({
      width: 200,
    } as DOMRect);
    Object.defineProperties(input, {
      clientWidth: {
        configurable: true,
        get: () => Number.parseFloat(input.style.width) || 700,
      },
      scrollHeight: { configurable: true, get: () => 24 },
      scrollWidth: { configurable: true, get: () => 500 },
    });

    fireEvent.change(input, {
      target: {
        value:
          "A long single-line draft that fits until the thread becomes narrower",
      },
    });
    expect(row).not.toHaveClass("multiline");

    rowWidth = 600;
    act(() => resize?.());

    await waitFor(() => expect(row).toHaveClass("multiline"));
  });

  it("collapses a long paste into reusable context", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={onSubmit}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Describe a task" });
    const context = [
      "A unified operating system",
      "for every sponsor ecosystem",
      "with monitored rules",
      "and connected companies",
      "across relationship teams",
      "with disciplined credit",
      "and human review",
      "at final acceptance.",
    ].join("\n");
    fireEvent.paste(input, {
      clipboardData: { getData: () => context },
    });

    expect(input).toHaveValue("");
    expect(screen.getByLabelText("Pasted context")).toBeVisible();
    expect(screen.getByText("A unified operating system")).toBeVisible();

    fireEvent.change(input, { target: { value: "Identify the ICP" } });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        attachments: [],
        contexts: [{ text: context, title: "A unified operating system" }],
        text: "Identify the ICP",
      }),
    );
  });

  it("can restore collapsed context to the text field for editing", () => {
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={vi.fn()}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Describe a task" });
    const context = Array.from(
      { length: 8 },
      (_, index) => `Context line ${index + 1}`,
    ).join("\n");
    fireEvent.paste(input, {
      clipboardData: { getData: () => context },
    });

    fireEvent.click(screen.getByRole("button", { name: /Show in text field/ }));

    expect(input).toHaveValue(context);
    expect(screen.queryByLabelText("Pasted context")).not.toBeInTheDocument();
  });

  it("opens the agents, context, and tools menu", () => {
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add agents, context, tools" }),
    );
    expect(
      screen.getByRole("menu", { name: "Add agents, context, tools" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Plan/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "File" })).toBeVisible();
  });

  it("keeps the tools and model menus mutually exclusive", () => {
    render(
      <Composer
        active={false}
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={() => undefined}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add agents, context, tools" }),
    );
    expect(
      screen.getByRole("menu", { name: "Add agents, context, tools" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    expect(
      screen.getByRole("menu", { name: "Model configuration" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menu", { name: "Add agents, context, tools" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Add agents, context, tools" }),
    );
    expect(
      screen.getByRole("menu", { name: "Add agents, context, tools" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menu", { name: "Model configuration" }),
    ).not.toBeInTheDocument();
  });

  it("queues a follow-up while preserving the active Stop control", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      <Composer
        active
        compact
        models={[model]}
        onInterrupt={() => undefined}
        onSubmit={onSubmit}
        onToast={() => undefined}
        preferences={preferences}
        updatePreferences={async () => preferences}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Send follow-up" });
    expect(
      screen.getByRole("button", { name: "Stop generation" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Model" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "Run this after the task" } });
    expect(
      screen.getByRole("button", { name: "Stop generation" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Queue prompt" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        attachments: [],
        contexts: [],
        text: "Run this after the task",
      }),
    );
    expect(input).toHaveValue("");
  });

  it("restores an editable queued submission into the composer", async () => {
    const onRestoreRequestHandled = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      <Composer
        active
        compact
        models={[model]}
        onInterrupt={() => undefined}
        onRestoreRequestHandled={onRestoreRequestHandled}
        onSubmit={onSubmit}
        onToast={() => undefined}
        preferences={preferences}
        restoreRequest={{
          requestId: "restore-1",
          submission: {
            attachments: ["/tmp/reference.png"],
            contexts: [{ text: "Queued source", title: "Reference source" }],
            text: "Edit this queued prompt",
          },
        }}
        updatePreferences={async () => preferences}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Send follow-up" }),
      ).toHaveValue("Edit this queued prompt"),
    );
    expect(onRestoreRequestHandled).toHaveBeenCalledWith("restore-1", true);
    expect(screen.getByLabelText("Pasted context")).toBeVisible();
    expect(screen.getByText("reference.png")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Queue prompt" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        attachments: ["/tmp/reference.png"],
        contexts: [{ text: "Queued source", title: "Reference source" }],
        text: "Edit this queued prompt",
      }),
    );
  });
});
