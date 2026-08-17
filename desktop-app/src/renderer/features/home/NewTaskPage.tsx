import { AlertCircle, WifiOff, X } from "lucide-react";
import { useState } from "react";

import { Composer } from "../../components/Composer";
import { useProductMode } from "../../state/product-mode";
import { useSession } from "../../state/session";
import { SubagentsIcon } from "../../ui/AppIcons";

function StatusBanners({
  error,
  offline,
}: {
  error: string | null;
  offline: boolean;
}) {
  return (
    <>
      {offline && (
        <div className="home-banner">
          <WifiOff aria-hidden="true" />
          <span>Codex is offline. Check the local app-server.</span>
        </div>
      )}
      {error && (
        <div className="home-banner home-banner--error">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

export function NewTaskPage({
  headline,
  pluginCreator = false,
  prefill,
}: {
  headline?: string;
  pluginCreator?: boolean;
  prefill?: string;
}) {
  const { chatGptMode, mode, temporaryChat } = useProductMode();
  const { error, runtime } = useSession();

  if (mode === "codex") {
    return <CodexHome error={error} offline={runtime === "offline"} />;
  }

  if (chatGptMode === "work") {
    return (
      <main aria-label="Main content" className="new-task-page work-task-page">
        <div className="new-task-page__center work-task-page__center">
          <h1>What should we work on?</h1>
          <Composer variant="workHome" />
          <StatusBanners error={error} offline={runtime === "offline"} />
        </div>
      </main>
    );
  }

  return (
    <main aria-label="Main content" className="new-task-page">
      <div className="new-task-page__center">
        <h1>
          {temporaryChat
            ? "Temporary Chat"
            : (headline ?? "Ready when you are.")}
        </h1>
        {temporaryChat && (
          <p className="new-task-page__temporary-copy">
            This chat won&apos;t appear in your conversation history
          </p>
        )}
        <Composer
          pluginCreator={pluginCreator}
          prefill={pluginCreator ? "help me create a plugin" : prefill}
          variant="home"
        />
        <StatusBanners error={error} offline={runtime === "offline"} />
      </div>
    </main>
  );
}

function CodexMark() {
  return (
    <svg
      aria-hidden="true"
      className="codex-home__mark"
      fill="none"
      viewBox="149 149 418 418"
    >
      <path
        d="M247.429 247.43C257.73 208.911 292.871 180.543 334.638 180.543C359.555 180.543 382.115 190.64 398.449 206.964C405.906 204.97 413.743 203.905 421.829 203.905C471.681 203.906 512.096 244.32 512.096 294.173C512.096 302.259 511.031 310.096 509.037 317.553C525.361 333.887 535.458 356.446 535.458 381.364C535.458 423.131 507.09 458.271 468.571 468.572C458.271 507.091 423.131 535.459 381.364 535.459C356.446 535.459 333.886 525.362 317.552 509.037C310.095 511.031 302.258 512.097 294.172 512.097C244.319 512.097 203.906 471.682 203.906 421.829C203.906 413.743 204.969 405.905 206.963 398.448C190.639 382.115 180.543 359.555 180.543 334.638C180.543 292.871 208.91 257.73 247.429 247.43Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="20.5"
      />
      <path
        d="M436.706 408.738H370.021"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="24"
      />
      <path
        d="M276.533 309.154L303.468 357.831C304.433 359.575 304.412 361.698 303.414 363.423L276.533 409.854"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="24"
      />
    </svg>
  );
}

function CodexHome({
  error,
  offline,
}: {
  error: string | null;
  offline: boolean;
}) {
  const [bannerOpen, setBannerOpen] = useState(true);
  const [subagentPrompt, setSubagentPrompt] = useState<string>();
  const { localProjects, selectedProjectId } = useSession();
  const selectedProject = localProjects.find(
    (project) => project.id === selectedProjectId,
  );

  return (
    <main aria-label="Main content" className="codex-home">
      {bannerOpen && (
        <section className="codex-home__banner">
          <span className="codex-home__banner-icon">
            <SubagentsIcon aria-hidden="true" />
          </span>
          <div className="codex-home__banner-copy">
            <strong>Subagents in Codex</strong>
            <span>
              Delegate work to subagents that work in parallel. Note: may
              increase token usage.
            </span>
          </div>
          <button
            className="codex-home__try"
            onClick={() => {
              setSubagentPrompt("Spawn a subagent to explore this repo.");
              setBannerOpen(false);
            }}
            type="button"
          >
            Try now
          </button>
          <button
            aria-label="Dismiss subagent banner"
            className="codex-home__dismiss"
            onClick={() => setBannerOpen(false)}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </section>
      )}
      <section className="codex-home__hero">
        <CodexMark />
        <h1>
          {selectedProject ? (
            <>
              What should we work on in{" "}
              <button
                onClick={() =>
                  window.dispatchEvent(new Event("codex-open-project-picker"))
                }
                type="button"
              >
                {selectedProject.name}?
              </button>
            </>
          ) : (
            "What should we build?"
          )}
        </h1>
      </section>
      <div className="codex-home__composer">
        <StatusBanners error={error} offline={offline} />
        <Composer prefill={subagentPrompt} variant="codexHome" />
      </div>
    </main>
  );
}
