import { ExternalLink } from "lucide-react";

import type { CodexController } from "../state/useCodexController";

type UtilityProps = { controller: CodexController };

export function AutomationsView({ controller }: UtilityProps) {
  return (
    <main className="utility-view automations-view">
      <header className="utility-page-header">
        <div>
          <h1>Automations</h1>
          <p>
            Automate repetitive tasks with always-on agents and configure
            Cursor&apos;s built-in agents for your team.
          </p>
        </div>
        <button
          aria-label="IDE"
          className="utility-ide-link"
          onClick={() => controller.setView("new")}
        >
          IDE <ExternalLink size={12} />
        </button>
      </header>
      <section className="automation-upgrade">
        <div>
          <p>
            Upgrade for Automations, unlimited completions, MAX Mode, and more
          </p>
          <button
            className="button-primary"
            onClick={() =>
              void window.codexDesktop.openExternal(
                "https://www.cursor.com/pricing",
              )
            }
          >
            Upgrade
          </button>
        </div>
      </section>
    </main>
  );
}
