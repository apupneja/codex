import { useEffect, useState, type ReactNode } from "react";

import type { Thread } from "../../shared/protocol";
import type { Route } from "../state/navigation";
import {
  BottomPanel,
  SidePanel,
  sideChatBusyEvent,
} from "../features/panels/SidePanel";
import { openInAppBrowserEvent } from "../state/link-routing";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";

export function AppShell({
  canGoBack,
  canGoForward,
  children,
  currentThread,
  onBack,
  onForward,
  onNavigate,
  onOpenThread,
  onShowPet,
  route,
  threads,
  title,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  children: ReactNode;
  currentThread: Thread | null;
  onBack(): void;
  onForward(): void;
  onNavigate(route: Route): void;
  onOpenThread(thread: Thread): void;
  onShowPet(): void;
  route: Route;
  threads: Thread[];
  title: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInitialTab, setPanelInitialTab] = useState<
    "chooser" | "files" | "sideChat" | "browser" | "terminal"
  >("chooser");
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomPanelControl, setBottomPanelControl] = useState(
    () => localStorage.getItem("general-show-bottom-panel") !== "false",
  );
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sideChatBusy, setSideChatBusy] = useState(false);
  const [browserRequest, setBrowserRequest] = useState<{
    id: number;
    url: string;
  }>();

  useEffect(() => {
    const openBrowser = (event: Event) => {
      const url = (event as CustomEvent<string>).detail;
      if (!url) return;
      setBrowserRequest({ id: Date.now(), url });
      setPanelInitialTab("browser");
      setPanelOpen(true);
    };
    window.addEventListener(openInAppBrowserEvent, openBrowser);
    return () => window.removeEventListener(openInAppBrowserEvent, openBrowser);
  }, []);

  useEffect(() => {
    const onSettingChanged = (event: Event) => {
      setBottomPanelControl((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener(
      "chatgpt:bottom-panel-setting-changed",
      onSettingChanged,
    );
    return () =>
      window.removeEventListener(
        "chatgpt:bottom-panel-setting-changed",
        onSettingChanged,
      );
  }, []);

  useEffect(() => {
    const onSideChatBusyChanged = (event: Event) => {
      setSideChatBusy((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener(sideChatBusyEvent, onSideChatBusyChanged);
    return () =>
      window.removeEventListener(sideChatBusyEvent, onSideChatBusyChanged);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 760) setSidebarOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && !event.altKey && event.code === "KeyJ") {
        event.preventDefault();
        setBottomPanelOpen((value) => !value);
        return;
      }
      if (command && event.altKey && event.code === "KeyB") {
        event.preventDefault();
        setPanelInitialTab("chooser");
        setPanelOpen((value) => !value);
        return;
      }
      if (command && !event.altKey && event.code === "KeyT") {
        event.preventDefault();
        setBrowserRequest(undefined);
        setPanelInitialTab("browser");
        setPanelOpen(true);
        return;
      }
      if (event.ctrlKey && event.code === "Backquote") {
        event.preventDefault();
        if (localStorage.getItem("general-terminal-location") === "Right") {
          setPanelInitialTab("terminal");
          setPanelOpen(true);
        } else {
          setBottomPanelOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (route.kind === "settings") {
    return <div className="app-shell app-shell--settings">{children}</div>;
  }

  return (
    <div
      className={`app-shell${sidebarOpen ? "" : " app-shell--sidebar-collapsed"}`}
    >
      {sidebarOpen && (
        <Sidebar
          activeThreadBusy={sideChatBusy}
          activeRoute={route}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={onBack}
          onClose={() => setSidebarOpen(false)}
          onForward={onForward}
          onNavigate={onNavigate}
          onOpenQuickChat={() => {
            setPanelInitialTab("sideChat");
            setPanelOpen(true);
          }}
          onOpenThread={onOpenThread}
          onShowPet={onShowPet}
          threads={threads}
        />
      )}
      <section className="app-main">
        <Titlebar
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={onBack}
          onForward={onForward}
          onNewTask={() => onNavigate({ kind: "newTask" })}
          onOpenFiles={() => {
            setPanelInitialTab("files");
            setPanelOpen(true);
            setSummaryOpen(false);
          }}
          onOpenScheduledTask={() => onNavigate({ kind: "automations" })}
          onOpenSideChat={() => {
            setPanelInitialTab("sideChat");
            setPanelOpen(true);
          }}
          onOpenUsageSettings={() =>
            onNavigate({ kind: "settings", section: "usage-billing" })
          }
          onToggleBottom={() => setBottomPanelOpen((value) => !value)}
          onTogglePanel={() => {
            if (panelOpen) setPanelOpen(false);
            else {
              setPanelInitialTab("chooser");
              setPanelOpen(true);
            }
          }}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onToggleSummary={() => setSummaryOpen((value) => !value)}
          bottomPanelOpen={bottomPanelOpen}
          showBottomPanelControl={bottomPanelControl}
          panelOpen={panelOpen}
          route={route}
          showThreadMenu={Boolean(currentThread)}
          sidebarOpen={sidebarOpen}
          summaryOpen={summaryOpen}
          title={title}
        />
        <div className="app-main__content">{children}</div>
        {bottomPanelOpen && (
          <BottomPanel
            onClose={() => setBottomPanelOpen(false)}
            thread={currentThread}
          />
        )}
      </section>
      {panelOpen && (
        <SidePanel
          browserRequest={browserRequest}
          initialTab={panelInitialTab}
          key={panelInitialTab}
          onClose={() => setPanelOpen(false)}
          onToggleBottom={() => setBottomPanelOpen((value) => !value)}
          thread={currentThread}
        />
      )}
    </div>
  );
}
