import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DesktopPreferences, Model } from "../../shared/types";
import type { CodexController } from "../state/useCodexController";
import {
  ConversationComposerDock,
  ScrollToLatestButton,
} from "./ConversationComposerDock";

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

describe("ScrollToLatestButton", () => {
  it("shows animated working dots only while an offscreen turn is active", () => {
    const onScrollToLatest = vi.fn();
    const { container, rerender } = render(
      <ScrollToLatestButton active onScrollToLatest={onScrollToLatest} />,
    );

    const working = screen.getByRole("button", {
      name: "Agent working — scroll to latest",
    });
    expect(
      container.querySelectorAll(".scroll-working-dots > span"),
    ).toHaveLength(3);
    fireEvent.click(working);
    expect(onScrollToLatest).toHaveBeenCalledOnce();

    rerender(
      <ScrollToLatestButton
        active={false}
        onScrollToLatest={onScrollToLatest}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Scroll to latest message" }),
    ).toBeVisible();
    expect(container.querySelector(".scroll-working-dots")).toBeNull();
  });
});

describe("ConversationComposerDock", () => {
  it("keeps Changes without showing a Commit & Push action", () => {
    const controller = {
      account: null,
      activeThread: null,
      activeTurn: null,
      addToast: vi.fn(),
      authLoginPending: false,
      bootstrapped: true,
      interrupt: vi.fn(),
      models: [
        {
          displayName: "GPT Test",
          id: "gpt-test",
          isDefault: true,
        } as Model,
      ],
      plan: [],
      preferences,
      queuedPrompts: [],
      removeQueuedPrompt: vi.fn(),
      requiresAuth: false,
      runtime: { phase: "ready" },
      startLogin: vi.fn(),
      steerQueuedPrompt: vi.fn(),
      submitPrompt: vi.fn(),
      tokenPercent: 0,
      updatePreferences: vi.fn().mockResolvedValue(preferences),
    } as unknown as CodexController;

    const { container } = render(
      <ConversationComposerDock
        atBottom
        changesOpen={false}
        controller={controller}
        deviceLabel="This Mac"
        onScrollToLatest={vi.fn()}
        onShowChanges={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Changes" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Commit & Push/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".change-actions")).toMatchSnapshot();
  });
});
