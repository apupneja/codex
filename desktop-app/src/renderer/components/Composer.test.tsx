import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
};

const model = {
  id: "gpt-test",
  displayName: "GPT Test",
  isDefault: true,
} as Model;

describe("Composer", () => {
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
      expect(onSubmit).toHaveBeenCalledWith("Build the feature", []),
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

  it("only offers reasoning efforts supported by the selected model", () => {
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

    const effort = screen.getByRole("combobox", { name: "Reasoning effort" });
    expect(effort).toHaveValue("minimal");
    expect(
      screen.queryByRole("option", { name: "Deep" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Balanced" })).toBeVisible();
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

    const input = screen.getByRole("textbox", { name: "Describe a task" });
    expect(screen.getByRole("button", { name: "Attach files" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start voice input" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Model" })).toBeVisible();

    fireEvent.change(input, { target: { value: "Ship the UI" } });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Ship the UI", []),
    );
  });
});
