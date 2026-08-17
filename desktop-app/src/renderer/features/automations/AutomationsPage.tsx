import {
  AlertCircle,
  Bell,
  FileSearch,
  MessageCircle,
  NotebookTabs,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { SidebarChevronIcon } from "../../ui/AppIcons";

const suggestions = [
  {
    description:
      "Start each weekday with a summary of your calendar, unread email, and priorities",
    icon: Bell,
    schedule: "Weekdays at 8:00 AM",
    title: "Daily brief",
  },
  {
    description:
      "Turn your recent work into a concise status update every Friday",
    icon: NotebookTabs,
    schedule: "Fridays at 4:00 PM",
    title: "Weekly review",
  },
  {
    description:
      "Review recent email and calendar activity and flag anything that needs your attention",
    icon: FileSearch,
    schedule: "Weekdays at 9:00 AM",
    title: "Follow-up monitor",
  },
] as const;

const scheduledTaskPrompt =
  "Let's set up a scheduled task together. First, explain how scheduled tasks work in ChatGPT. Then interview me to figure out what I need scheduled and when it should run.";

type DetailMenu =
  | "chat"
  | "notifications"
  | "repeat"
  | "runs-in"
  | "runs-on"
  | "time";

export function AutomationsPage({
  onCreateWithChat,
}: {
  onCreateWithChat?(prefill: string): void;
}) {
  const [query, setQuery] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSuggestions = suggestions.filter(
    ({ description, schedule, title }) =>
      [description, schedule, title].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      ),
  );

  const createWithChat = () => {
    setCreateMenuOpen(false);
    onCreateWithChat?.(scheduledTaskPrompt);
  };
  const retry = () => {
    setRetrying(true);
    window.setTimeout(() => setRetrying(false), 350);
  };

  return (
    <>
      <main
        className={`codex-route-page scheduled-page${manualOpen ? " scheduled-page--detail" : ""}`}
      >
        {!manualOpen && (
          <div className="route-titlebar-actions scheduled-titlebar-actions">
            <button
              aria-label="Create"
              className="route-titlebar-primary"
              onClick={createWithChat}
              type="button"
            >
              <span>Create</span>
            </button>
            <div className="scheduled-create-anchor">
              <button
                aria-expanded={createMenuOpen}
                aria-haspopup="menu"
                aria-label="Create scheduled task options"
                className="route-titlebar-split"
                onClick={() => setCreateMenuOpen((value) => !value)}
                type="button"
              >
                <SidebarChevronIcon aria-hidden="true" />
              </button>
              {createMenuOpen && (
                <div className="scheduled-create-menu" role="menu">
                  <button
                    onClick={createWithChat}
                    role="menuitem"
                    type="button"
                  >
                    <MessageCircle aria-hidden="true" />
                    Create with ChatGPT
                  </button>
                  <button
                    onClick={() => {
                      setCreateMenuOpen(false);
                      setManualOpen(true);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Pencil aria-hidden="true" />
                    Set up manually
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <section className="scheduled-page__list">
          <header className="codex-route-page__header">
            <h1>Scheduled tasks</h1>
            {!manualOpen && (
              <p>
                Ask ChatGPT to schedule tasks, set reminders, or monitor for
                updates.
              </p>
            )}
          </header>

          <label className="route-search">
            <Search aria-hidden="true" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search scheduled tasks"
              value={query}
            />
          </label>

          <div className="scheduled-error" role="status">
            <span>Cloud scheduled tasks could not be loaded</span>
            <button aria-busy={retrying} onClick={retry} type="button">
              Try again
            </button>
          </div>

          <section className="scheduled-suggestions">
            <h2>Suggestions</h2>
            {visibleSuggestions.map(
              ({ description, icon: Icon, schedule, title }) => (
                <article className="scheduled-suggestion" key={title}>
                  <button
                    aria-label={title}
                    className="scheduled-suggestion__row-action"
                    onClick={() => setErrorOpen(true)}
                    type="button"
                  />
                  <button
                    aria-label={`Add ${title} scheduled task`}
                    className="scheduled-suggestion__icon"
                    onClick={() => setErrorOpen(true)}
                    type="button"
                  >
                    <Icon aria-hidden="true" />
                  </button>
                  <div className="scheduled-suggestion__copy">
                    <div>
                      <h3>{title}</h3>
                      <span>{schedule}</span>
                    </div>
                    <p>{description}</p>
                  </div>
                </article>
              ),
            )}
          </section>
        </section>

        {manualOpen && (
          <ManualAutomationEditor onClose={() => setManualOpen(false)} />
        )}
      </main>
      {errorOpen &&
        createPortal(
          <div className="scheduled-fatal-error" role="alert">
            <AlertCircle aria-hidden="true" />
            <p>Oops, an error has occurred</p>
            <button onClick={() => setErrorOpen(false)} type="button">
              Try again
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function ManualAutomationEditor({ onClose }: { onClose(): void }) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [openMenu, setOpenMenu] = useState<DetailMenu>();
  const [runsOn, setRunsOn] = useState("This device");
  const [runsIn, setRunsIn] = useState("Existing chat");
  const [chat, setChat] = useState("Choose a pinned chat");
  const [repeat, setRepeat] = useState("Daily");
  const [time, setTime] = useState("9:00 AM");
  const [notifications, setNotifications] = useState("Important updates");

  return (
    <aside aria-label="New scheduled task" className="scheduled-detail-panel">
      <div className="scheduled-detail-panel__topline">
        <span>New</span>
        <button aria-label="Cancel" onClick={onClose} type="button">
          <X aria-hidden="true" />
        </button>
      </div>
      <input
        aria-label="Name"
        className="scheduled-detail-panel__title"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Scheduled task title"
        value={title}
      />
      <div className="scheduled-detail-panel__prompt">
        <textarea
          aria-label="Prompt"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe what ChatGPT should do"
          value={prompt}
        />
      </div>

      <AutomationFieldGroup label="Details">
        <AutomationSelect
          label="Runs on"
          menu="runs-on"
          onOpen={setOpenMenu}
          onSelect={setRunsOn}
          openMenu={openMenu}
          options={["This device"]}
          value={runsOn}
        />
        <AutomationSelect
          label="Runs in"
          menu="runs-in"
          onOpen={setOpenMenu}
          onSelect={setRunsIn}
          openMenu={openMenu}
          options={["Existing chat", "New chat"]}
          value={runsIn}
        />
        <AutomationSelect
          label="Chat"
          menu="chat"
          onOpen={setOpenMenu}
          onSelect={setChat}
          openMenu={openMenu}
          options={["Choose a pinned chat"]}
          value={chat}
        />
      </AutomationFieldGroup>

      <AutomationFieldGroup label="Frequency">
        <AutomationSelect
          label="Repeat"
          menu="repeat"
          onOpen={setOpenMenu}
          onSelect={setRepeat}
          openMenu={openMenu}
          options={["Daily", "Weekdays", "Weekly", "Monthly"]}
          value={repeat}
        />
        <AutomationSelect
          label="At"
          menu="time"
          onOpen={setOpenMenu}
          onSelect={setTime}
          openMenu={openMenu}
          options={["8:00 AM", "9:00 AM", "4:00 PM"]}
          value={time}
        />
        <AutomationSelect
          label="Notifications"
          menu="notifications"
          onOpen={setOpenMenu}
          onSelect={setNotifications}
          openMenu={openMenu}
          options={["Important updates", "Every update", "Off"]}
          value={notifications}
        />
      </AutomationFieldGroup>

      <footer className="scheduled-detail-panel__footer">
        <button disabled={!title.trim() || !prompt.trim()} type="button">
          Create
        </button>
      </footer>
    </aside>
  );
}

function AutomationFieldGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section className="scheduled-field-group">
      <h2>{label}</h2>
      <div>{children}</div>
    </section>
  );
}

function AutomationSelect({
  label,
  menu,
  onOpen,
  onSelect,
  openMenu,
  options,
  value,
}: {
  label: string;
  menu: DetailMenu;
  onOpen(menu: DetailMenu | undefined): void;
  onSelect(value: string): void;
  openMenu: DetailMenu | undefined;
  options: readonly string[];
  value: string;
}) {
  const open = openMenu === menu;
  return (
    <div className="scheduled-field-row">
      <span>{label}</span>
      <button
        aria-label={
          menu === "runs-on"
            ? `Runs on: ${value}`
            : menu === "chat"
              ? "Target chat"
              : menu === "repeat"
                ? "Repeat schedule"
                : menu === "time"
                  ? "Time"
                  : menu === "notifications"
                    ? "Notifications"
                    : undefined
        }
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          menu === "runs-on" || menu === "notifications" ? "is-small" : ""
        }
        onClick={() => onOpen(open ? undefined : menu)}
        type="button"
      >
        {value}
        <SidebarChevronIcon aria-hidden="true" />
      </button>
      {open && (
        <div className="scheduled-field-menu" role="menu">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onSelect(option);
                onOpen(undefined);
              }}
              role="menuitem"
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
