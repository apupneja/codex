import { useEffect, useMemo, useState } from "react";

import type { Thread } from "../../shared/protocol";
import { AutomationsPage } from "../features/automations/AutomationsPage";
import { NewTaskPage } from "../features/home/NewTaskPage";
import { AccessPage } from "../features/onboarding/AccessPage";
import { MigrationModal } from "../features/onboarding/MigrationModal";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { PullRequestsPage } from "../features/review/PullRequestsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SkillsPage } from "../features/skills/SkillsPage";
import { ThreadPage } from "../features/thread/ThreadPage";
import { AppShell } from "../shell/AppShell";
import { applyStoredAppearancePreferences } from "../state/appearance";
import { routeKey, type Route } from "../state/navigation";
import { useSession } from "../state/session";
import { AppProvider } from "./AppProvider";

function routeFromPathname(pathname: string): Route | null {
  return pathname === "/projects" ? { kind: "projects" } : null;
}

function AppContent() {
  const session = useSession();
  const [navigation, setNavigation] = useState<{
    entries: Route[];
    index: number;
  }>(() => ({
    entries: [
      routeFromPathname(window.location.pathname) ?? { kind: "newTask" },
    ],
    index: 0,
  }));
  const route = navigation.entries[navigation.index];
  const [migrationOpen, setMigrationOpen] = useState(
    () => localStorage.getItem("chatgpt.migration-complete") !== "true",
  );
  const [pluginCreatorOpen, setPluginCreatorOpen] = useState(false);
  const [homePrefill, setHomePrefill] = useState<{
    headline?: string;
    text: string;
  }>();

  useEffect(() => {
    applyStoredAppearancePreferences();
    const theme = localStorage.getItem("appearance-theme");
    void window.chatgptDesktop.setTheme(
      theme === "light" || theme === "dark" ? theme : "system",
    );
    void window.chatgptDesktop.setMenuBarVisible(
      localStorage.getItem("general-show-menu-bar") !== "false",
    );
    void window.chatgptDesktop.setPreventSleep(
      localStorage.getItem("general-prevent-sleep") === "true",
    );
    void window.chatgptDesktop.setBrowserDownloadDirectory(
      localStorage.getItem("browser-download-directory"),
    );
    void window.chatgptDesktop.setBrowserDownloadPrompt(
      localStorage.getItem("browser-download-prompt-enabled") === "true",
    );
    if (localStorage.getItem("avatar-overlay-open") === "true") {
      void window.chatgptDesktop.setPetOverlay(
        true,
        localStorage.getItem("avatar-overlay-selected-asset") ?? "codex",
      );
    }
    void window.chatgptDesktop.ready();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const nextRoute = routeFromPathname(window.location.pathname);
      if (nextRoute)
        setNavigation((current) => ({
          entries: [...current.entries.slice(0, current.index + 1), nextRoute],
          index: current.index + 1,
        }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (route.kind === "thread" && !session.current)
      setNavigation((current) => ({
        entries: current.entries.map((entry, index) =>
          index === current.index ? { kind: "newTask" } : entry,
        ),
        index: current.index,
      }));
  }, [route, session.current]);

  useEffect(() => {
    if (route.kind === "newTask" && session.current) {
      const nextRoute: Route = {
        kind: "thread",
        threadId: session.current.id,
      };
      setNavigation((current) => ({
        entries: [...current.entries.slice(0, current.index + 1), nextRoute],
        index: current.index + 1,
      }));
    }
  }, [route.kind, session.current]);

  const navigate = (next: Route) => {
    if (next.kind === "newTask") {
      session.startNewTask();
      setPluginCreatorOpen(false);
      setHomePrefill(undefined);
    }
    setNavigation((current) => {
      if (routeKey(current.entries[current.index]) === routeKey(next))
        return current;
      return {
        entries: [...current.entries.slice(0, current.index + 1), next],
        index: current.index + 1,
      };
    });
  };

  const openThread = async (thread: Thread) => {
    await session.openThread(thread);
    navigate({ kind: "thread", threadId: thread.id });
  };

  const continueFromTurn = async (turnId: string) => {
    if (!session.current) return;
    const result = await window.chatgptDesktop.request<{ thread: Thread }>(
      "thread/fork",
      {
        lastTurnId: turnId,
        threadId: session.current.id,
      },
    );
    await openThread(result.thread);
  };

  const moveInHistory = async (offset: -1 | 1) => {
    const targetIndex = navigation.index + offset;
    const target = navigation.entries[targetIndex];
    if (!target) return;
    if (target.kind === "newTask") session.startNewTask();
    if (target.kind === "thread") {
      const thread = session.threads.find(
        (item) => item.id === target.threadId,
      );
      if (!thread) return;
      await session.openThread(thread);
    }
    setNavigation((current) => ({ ...current, index: targetIndex }));
  };

  const content = useMemo(() => {
    const openPluginCreator = () => {
      navigate({ kind: "newTask" });
      setHomePrefill({
        headline: "What’s on the agenda today?",
        text: "help me create a plugin",
      });
      setPluginCreatorOpen(true);
    };

    const openPetCreator = () => {
      navigate({ kind: "newTask" });
      setHomePrefill({
        text: "$hatch-pet create a pet based on what you know about me",
      });
    };

    switch (route.kind) {
      case "newTask":
        return (
          <NewTaskPage
            headline={homePrefill?.headline}
            pluginCreator={pluginCreatorOpen}
            prefill={homePrefill?.text}
          />
        );
      case "thread":
        return (
          <ThreadPage onContinue={(turnId) => void continueFromTurn(turnId)} />
        );
      case "pullRequests":
        return <PullRequestsPage />;
      case "automations":
        return (
          <AutomationsPage
            onCreateWithChat={(text) => {
              navigate({ kind: "newTask" });
              setHomePrefill({
                headline: "What’s on the agenda today?",
                text,
              });
            }}
          />
        );
      case "skills":
        return (
          <SkillsPage
            onAddServer={() => navigate({ kind: "skills", page: "add-server" })}
            onBackToManage={() => navigate({ kind: "skills", page: "manage" })}
            onCreatePlugin={openPluginCreator}
            onManage={() => navigate({ kind: "skills", page: "manage" })}
            page={route.page}
          />
        );
      case "projects":
        return (
          <ProjectsPage
            onOpenProject={() => navigate({ kind: "newTask" })}
            onOpenThread={(thread) => void openThread(thread)}
          />
        );
      case "settings":
        return (
          <SettingsPage
            initialSection={route.section}
            onAddMcpServer={() =>
              navigate({ kind: "skills", page: "add-server" })
            }
            onBack={() => navigate({ kind: "newTask" })}
            onBrowsePlugins={() => navigate({ kind: "skills" })}
            onCreatePlugin={openPluginCreator}
            onCreatePet={openPetCreator}
          />
        );
    }
  }, [homePrefill, pluginCreatorOpen, route, session.auth]);

  const title =
    route.kind === "thread"
      ? session.current?.name || session.current?.preview || "Chat"
      : route.kind === "newTask"
        ? ""
        : route.kind.charAt(0).toUpperCase() + route.kind.slice(1);

  if (session.auth === "signedOut") return <AccessPage />;

  return (
    <>
      <AppShell
        canGoBack={navigation.index > 0}
        canGoForward={navigation.index < navigation.entries.length - 1}
        currentThread={session.current}
        onBack={() => void moveInHistory(-1)}
        onForward={() => void moveInHistory(1)}
        onNavigate={navigate}
        onOpenThread={(thread) => void openThread(thread)}
        onShowPet={() => {
          const pet =
            localStorage.getItem("avatar-overlay-selected-asset") ?? "codex";
          localStorage.setItem("avatar-overlay-open", "true");
          void window.chatgptDesktop.setPetOverlay(true, pet);
        }}
        route={route}
        threads={session.threads}
        title={title}
      >
        {content}
      </AppShell>
      {migrationOpen && session.auth === "signedIn" && (
        <MigrationModal
          onDismiss={() => {
            localStorage.setItem("chatgpt.migration-complete", "true");
            setMigrationOpen(false);
          }}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
