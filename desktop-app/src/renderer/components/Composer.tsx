import { Box, ChevronRight, Square } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { LocalAttachment } from "../../shared/bridge";
import { Select } from "../design-system/Select";
import { CodexProjectSelector } from "../features/composer/CodexProjectSelector";
import { ComposerUtilityBar } from "../features/composer/ComposerUtilityBar";
import { ComposerPermissionsMenu } from "../features/composer/ComposerPermissionsMenu";
import { EnvironmentMenu } from "../features/composer/EnvironmentMenu";
import { ProjectMarkerIcon } from "../features/projects/ProjectMarker";
import { useProductMode } from "../state/product-mode";
import { useSession } from "../state/session";
import {
  AddAttachmentIcon,
  AddProjectIcon,
  HandIcon,
  IdeContextCloseIcon,
  IdeContextIcon,
  ModeCheckIcon,
  SearchIcon,
  SendIcon,
  SummaryAddIcon,
  WorkChevronRightIcon,
  WorkCloudIcon,
  WorkPluginsIcon,
  WorkRunIcon,
} from "../ui/AppIcons";
import { PromptQueue } from "./PromptQueue";

function ContextUsageIndicator({
  contextWindow,
  usedTokens,
}: {
  contextWindow: number;
  usedTokens: number;
}) {
  const used = Math.min(contextWindow, Math.max(0, usedTokens));
  const percent = Math.round((used / contextWindow) * 100);
  const remaining = 100 - percent;
  return (
    <span className="composer-context-usage">
      <span aria-label={`Context usage: ${percent}%`} role="img">
        <svg aria-hidden="true" height="12" viewBox="0 0 12 12" width="12">
          <circle cx="6" cy="6" fill="none" opacity="0.16" r="5" />
          <circle
            className="composer-context-usage__progress"
            cx="6"
            cy="6"
            fill="none"
            pathLength="100"
            r="5"
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
          />
        </svg>
      </span>
      <span className="composer-context-usage__tooltip" role="tooltip">
        <strong>Context window:</strong>
        <span>
          {percent >= 50
            ? `${percent}% full`
            : `${percent}% used (${remaining}% left)`}
        </span>
        <span>
          {Math.round(used / 1_000)}k / {Math.round(contextWindow / 1_000)}k
          tokens used
        </span>
      </span>
    </span>
  );
}

export function Composer({
  pluginCreator = false,
  prefill,
  variant = "thread",
}: {
  pluginCreator?: boolean;
  prefill?: string;
  variant?: "codexHome" | "home" | "thread" | "workHome";
}) {
  const { mode } = useProductMode();
  const {
    activeTurnId,
    editQueuedPrompt,
    interrupt,
    localProjects,
    models,
    permissionMode,
    queue,
    removeQueuedPrompt,
    selectProject,
    setPermissionMode,
    steerQueuedPrompt,
    submit,
    tokenUsage,
  } = useSession();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("medium");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelSubmenu, setModelSubmenu] = useState<"effort" | "model" | null>(
    null,
  );
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false);
  const permissionMenuId = useId();
  const [ideContextEnabled, setIdeContextEnabled] = useState(true);
  const [workProjectMenuOpen, setWorkProjectMenuOpen] = useState(false);
  const [workPluginMenuOpen, setWorkPluginMenuOpen] = useState(false);
  const [workRunMenuOpen, setWorkRunMenuOpen] = useState(false);
  const [workRunLocation, setWorkRunLocation] = useState<"cloud" | "local">(
    "local",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder =
    variant === "codexHome" || variant === "thread"
      ? "Do anything"
      : variant === "workHome"
        ? "Work with ChatGPT"
        : mode === "codex"
          ? "Ask Codex"
          : "Message ChatGPT";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (prefill === undefined) return;
    setText(prefill);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [prefill]);

  const addAttachments = (items: LocalAttachment[]) => {
    setAttachments((current) => [
      ...current,
      ...items.filter(
        (item) => !current.some((existing) => existing.path === item.path),
      ),
    ]);
  };

  const send = (followUpBehavior?: "queue" | "steer") => {
    const value = text.trim();
    if (!value && !attachments.length) return;
    const draft = { attachments, effort, model, text: value };
    if (followUpBehavior) submit(draft, followUpBehavior);
    else submit(draft);
    setText("");
    setAttachments([]);
  };

  const editor = (
    <textarea
      aria-label={placeholder}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        const enterBehavior =
          localStorage.getItem("chatgpt.composer-enter-behavior") ?? "enter";
        const modifierPressed = event.metaKey || event.ctrlKey;
        const shouldSend =
          enterBehavior === "enter" ||
          (enterBehavior === "cmdIfMultiline" &&
            (!text.includes("\n") || modifierPressed)) ||
          (enterBehavior === "cmdAlways" && modifierPressed);
        if (event.key === "Enter" && !event.shiftKey && shouldSend) {
          event.preventDefault();
          send();
        } else if (
          event.key === "Enter" &&
          event.shiftKey &&
          modifierPressed &&
          activeTurnId
        ) {
          event.preventDefault();
          const configured =
            localStorage.getItem("general-follow-up-behavior") === "Queue"
              ? "queue"
              : "steer";
          send(configured === "queue" ? "steer" : "queue");
        }
      }}
      placeholder={placeholder}
      ref={textareaRef}
      rows={1}
      value={text}
    />
  );

  const submitButton =
    activeTurnId &&
    activeTurnId !== "starting" &&
    !text.trim() &&
    !attachments.length ? (
      <button
        aria-label="Stop generating"
        className="composer-submit"
        onClick={() => void interrupt()}
        type="button"
      >
        <Square aria-hidden="true" fill="currentColor" />
      </button>
    ) : activeTurnId ? (
      <button
        aria-label={
          localStorage.getItem("general-follow-up-behavior") === "Queue"
            ? "Queue"
            : "Steer"
        }
        className="composer-submit"
        disabled={!text.trim() && !attachments.length}
        onClick={() => send()}
        type="button"
      >
        <SendIcon aria-hidden="true" />
      </button>
    ) : (
      <button
        aria-label="Send"
        className="composer-submit"
        disabled={!text.trim() && !attachments.length}
        onClick={() => send()}
        type="button"
      >
        <SendIcon aria-hidden="true" />
      </button>
    );

  if (
    variant === "codexHome" ||
    variant === "thread" ||
    variant === "workHome"
  ) {
    const isThread = variant === "thread";
    const isWorkHome = variant === "workHome";
    return (
      <div
        className={
          isThread
            ? "thread-composer-region"
            : isWorkHome
              ? "work-home-composer-region"
              : "codex-home-composer-region"
        }
      >
        {isThread && (
          <PromptQueue
            onEdit={(index) => {
              const draft = editQueuedPrompt(index);
              if (draft) setText(draft.text);
            }}
            onRemove={removeQueuedPrompt}
            onSteer={(index) => void steerQueuedPrompt(index)}
            prompts={queue}
          />
        )}
        {!isThread && !isWorkHome && <CodexProjectSelector />}
        <div
          className={`composer ${
            isThread
              ? "composer--thread-dock"
              : isWorkHome
                ? "composer--work-home"
                : "composer--codex-home"
          }`}
        >
          {editor}
          <div className="codex-composer-footer">
            <div className="codex-composer-footer__left">
              <button
                aria-expanded={addMenuOpen}
                aria-haspopup="menu"
                aria-label="Add files and more"
                className="codex-composer-icon-button"
                onClick={() => setAddMenuOpen((value) => !value)}
                type="button"
              >
                <SummaryAddIcon aria-hidden="true" />
              </button>
              {!isWorkHome && (
                <EnvironmentMenu placement={isThread ? "thread" : "home"} />
              )}
              <button
                aria-controls={
                  permissionMenuOpen ? permissionMenuId : undefined
                }
                aria-expanded={permissionMenuOpen}
                aria-haspopup="menu"
                className="codex-composer-control"
                onClick={() => {
                  setPermissionMenuOpen((value) => !value);
                  setAddMenuOpen(false);
                  setModelMenuOpen(false);
                }}
                type="button"
              >
                <HandIcon aria-hidden="true" />
                <span>
                  {permissionMode === "full"
                    ? "Full access"
                    : permissionMode === "read"
                      ? "Read only"
                      : "Ask for approval"}
                </span>
              </button>
            </div>
            <div className="codex-composer-footer__right">
              {isThread &&
                localStorage.getItem("general-show-context-usage") === "true" &&
                tokenUsage?.modelContextWindow != null &&
                tokenUsage.modelContextWindow > 0 && (
                  <ContextUsageIndicator
                    contextWindow={tokenUsage.modelContextWindow}
                    usedTokens={tokenUsage.last.totalTokens}
                  />
                )}
              <div className="thread-composer-context-group">
                <button
                  aria-expanded={modelMenuOpen}
                  aria-haspopup="menu"
                  className="codex-composer-model-trigger"
                  onClick={() => {
                    setModelMenuOpen((value) => !value);
                    setModelSubmenu(null);
                  }}
                  type="button"
                >
                  <span>5.2 Codex</span>
                  <span>Medium</span>
                </button>
                {isThread && ideContextEnabled && (
                  <>
                    <span
                      aria-hidden="true"
                      className="thread-composer-context-divider"
                    />
                    <button
                      aria-label="Turn off IDE context"
                      className="thread-composer-context"
                      onClick={() => setIdeContextEnabled(false)}
                      type="button"
                    >
                      <IdeContextIcon
                        aria-hidden="true"
                        className="thread-composer-context__default-icon"
                      />
                      <IdeContextCloseIcon
                        aria-hidden="true"
                        className="thread-composer-context__hover-icon"
                      />
                      <span>IDE context</span>
                    </button>
                  </>
                )}
              </div>
              {submitButton}
            </div>
          </div>
          {addMenuOpen && (
            <div
              aria-label="Add files and more"
              className="codex-add-menu"
              role="menu"
            >
              <button
                onClick={() => {
                  setAddMenuOpen(false);
                  void window.chatgptDesktop.selectFiles().then(addAttachments);
                }}
                role="menuitem"
                type="button"
              >
                <AddAttachmentIcon aria-hidden="true" />
                <span>Add files or photos</span>
              </button>
            </div>
          )}
          {modelMenuOpen && (
            <div aria-label="Model" className="codex-model-menu" role="menu">
              <button
                aria-label="Model GPT-5.2 Codex"
                aria-expanded={modelSubmenu === "model"}
                onClick={() =>
                  setModelSubmenu((value) =>
                    value === "model" ? null : "model",
                  )
                }
                role="menuitem"
                type="button"
              >
                <span>Model</span>
                <span className="codex-model-menu__value">GPT-5.2 Codex</span>
                <WorkChevronRightIcon aria-hidden="true" />
              </button>
              <button
                aria-expanded={modelSubmenu === "effort"}
                aria-label="Effort Medium"
                onClick={() =>
                  setModelSubmenu((value) =>
                    value === "effort" ? null : "effort",
                  )
                }
                role="menuitem"
                type="button"
              >
                <span>Effort</span>
                <span className="codex-model-menu__value">Medium</span>
                <WorkChevronRightIcon aria-hidden="true" />
              </button>
              {modelSubmenu === "model" && (
                <div
                  aria-label="Model options"
                  className="codex-model-submenu codex-model-submenu--model"
                  role="menu"
                >
                  <div className="codex-model-submenu__title">Model</div>
                  <button
                    onClick={() => {
                      setModelSubmenu(null);
                      setModelMenuOpen(false);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span>GPT-5.2 Codex</span>
                    <ModeCheckIcon aria-hidden="true" />
                  </button>
                </div>
              )}
              {modelSubmenu === "effort" && (
                <div
                  aria-label="Effort options"
                  className="codex-model-submenu codex-model-submenu--effort"
                  role="menu"
                >
                  <div className="codex-model-submenu__title">Effort</div>
                  {(
                    [
                      ["low", "Light"],
                      ["medium", "Medium"],
                      ["high", "High"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      aria-checked={effort === value}
                      key={value}
                      onClick={() => {
                        setEffort(value);
                        setModelSubmenu(null);
                        setModelMenuOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      <span>{label}</span>
                      {effort === value && <ModeCheckIcon aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {permissionMenuOpen && (
            <ComposerPermissionsMenu
              id={permissionMenuId}
              onDismiss={() => setPermissionMenuOpen(false)}
              onSelect={(nextMode) => {
                setPermissionMode(nextMode);
                setPermissionMenuOpen(false);
              }}
              permissionMode={permissionMode}
              showFullAccess={
                localStorage.getItem("general-show-full-access") !== "false"
              }
            />
          )}
        </div>
        {isWorkHome && (
          <div className="work-home-context-strip">
            <div className="work-home-context-strip__left">
              <CodexProjectSelector variant="work" />
              <div className="work-home-control">
                <button
                  aria-expanded={workPluginMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Connect plugins"
                  className="work-home-context-button"
                  onClick={() => {
                    setWorkPluginMenuOpen((value) => !value);
                    setWorkRunMenuOpen(false);
                  }}
                  type="button"
                >
                  <WorkPluginsIcon aria-hidden="true" />
                  <span>Connect plugins</span>
                </button>
                {workPluginMenuOpen && (
                  <div
                    aria-label="Plugins"
                    className="work-control-menu work-control-menu--plugins"
                    role="menu"
                  >
                    <label className="work-control-menu__search">
                      <SearchIcon aria-hidden="true" />
                      <input
                        aria-label="Search plugins"
                        autoFocus
                        placeholder="Search plugins..."
                      />
                    </label>
                    <div className="work-control-menu__empty">
                      No connected plugins
                    </div>
                    <div className="work-control-menu__separator" />
                    <button
                      onClick={() => setWorkPluginMenuOpen(false)}
                      role="menuitem"
                      type="button"
                    >
                      <WorkPluginsIcon aria-hidden="true" />
                      <span>Connect plugins</span>
                      <WorkChevronRightIcon aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="work-home-control work-home-control--run">
              <button
                aria-expanded={workRunMenuOpen}
                aria-haspopup="menu"
                aria-label="Choose where to run this chat"
                className="work-home-run-trigger"
                onClick={() => {
                  setWorkRunMenuOpen((value) => !value);
                  setWorkPluginMenuOpen(false);
                }}
                type="button"
              >
                {workRunLocation === "local" ? (
                  <WorkRunIcon aria-hidden="true" />
                ) : (
                  <WorkCloudIcon aria-hidden="true" />
                )}
              </button>
              {workRunMenuOpen && (
                <div
                  aria-label="Where should this chat run?"
                  className="work-control-menu work-control-menu--run"
                  role="menu"
                >
                  <p>Where should this chat run?</p>
                  <button
                    onClick={() => {
                      setWorkRunLocation("local");
                      setWorkRunMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <WorkRunIcon aria-hidden="true" />
                    <span>
                      <strong>On your computer</strong>
                      <small>Read and edit local files with permission</small>
                    </span>
                    {workRunLocation === "local" && (
                      <ModeCheckIcon aria-hidden="true" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setWorkRunLocation("cloud");
                      setWorkRunMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <WorkCloudIcon aria-hidden="true" />
                    <span>
                      <strong>In the cloud</strong>
                      <small>
                        Can&apos;t access local files unless attached
                      </small>
                    </span>
                    {workRunLocation === "cloud" && (
                      <ModeCheckIcon aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "home") {
    return (
      <div className="composer-region composer-region--home">
        <div
          className={`composer composer--home${attachments.length ? " has-attachments" : ""}${pluginCreator ? " has-plugin-creator" : ""}${text.trim() && !pluginCreator ? " has-prefill" : ""}`}
        >
          {attachments.length > 0 && (
            <div
              className="composer-attachments composer-attachments--home"
              aria-label="Attachments"
            >
              {attachments.map((attachment) => (
                <button
                  aria-label={`Remove ${attachment.name}`}
                  key={attachment.path}
                  onClick={() =>
                    setAttachments((items) =>
                      items.filter((item) => item.path !== attachment.path),
                    )
                  }
                  type="button"
                >
                  {attachment.name}
                </button>
              ))}
            </div>
          )}
          <button
            aria-expanded={addMenuOpen}
            aria-haspopup="menu"
            aria-label="Add files and more"
            className="home-composer-button home-composer-add"
            onClick={() => {
              setAddMenuOpen((value) => !value);
              setModelMenuOpen(false);
              setWorkProjectMenuOpen(false);
            }}
            type="button"
          >
            <SummaryAddIcon aria-hidden="true" />
          </button>
          {pluginCreator && text === "help me create a plugin" && (
            <div className="home-composer-plugin-prefill" aria-hidden="true">
              <span>
                <Box />
                Plugin Creator
              </span>
              <span>help me create a plugin</span>
            </div>
          )}
          {pluginCreator && text === "help me create a plugin" ? (
            <div className="home-composer-plugin-input">{editor}</div>
          ) : (
            editor
          )}
          <button
            aria-label="Select ChatGPT model"
            aria-expanded={modelMenuOpen}
            aria-haspopup="menu"
            className="home-composer-model"
            onClick={() => {
              setModelMenuOpen((value) => !value);
              setModelSubmenu(null);
              setAddMenuOpen(false);
              setWorkProjectMenuOpen(false);
            }}
            type="button"
          >
            <span>Auto</span>
          </button>
          {submitButton}
          {addMenuOpen && (
            <div aria-label="Add" className="home-add-menu" role="menu">
              <button
                autoFocus
                onClick={() => {
                  setAddMenuOpen(false);
                  void window.chatgptDesktop.selectFiles().then(addAttachments);
                }}
                role="menuitem"
                type="button"
              >
                <span className="home-add-menu__row-content">
                  <AddAttachmentIcon aria-hidden="true" />
                  <span>Add photos &amp; files</span>
                </span>
              </button>
              <button
                onClick={() => {
                  setAddMenuOpen(false);
                  setWorkProjectMenuOpen(true);
                }}
                role="menuitem"
                type="button"
              >
                <span className="home-add-menu__row-content">
                  <AddProjectIcon aria-hidden="true" />
                  <span>Work in a project</span>
                  <small>Start a chat in a project</small>
                </span>
              </button>
              <div className="home-add-menu__disabled">Create image</div>
              <div className="home-add-menu__disabled">Web search</div>
            </div>
          )}
          {workProjectMenuOpen && (
            <div
              aria-label="Work in a project"
              className="home-project-menu"
              role="menu"
            >
              {localProjects.length === 0 ? (
                <div className="home-project-menu__empty">No projects</div>
              ) : (
                localProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      selectProject(project.id);
                      setWorkProjectMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <ProjectMarkerIcon appearance={project.appearance} />
                    <span>{project.name}</span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))
              )}
            </div>
          )}
          {modelMenuOpen && (
            <div aria-label="Model" className="home-model-menu" role="menu">
              <button
                aria-expanded={modelSubmenu === "effort"}
                aria-label="Effort Auto"
                onClick={() =>
                  setModelSubmenu((value) =>
                    value === "effort" ? null : "effort",
                  )
                }
                role="menuitem"
                type="button"
              >
                <span>Effort</span>
                <span className="home-model-menu__value">Auto</span>
                <WorkChevronRightIcon aria-hidden="true" />
              </button>
              {modelSubmenu === "effort" && (
                <div
                  aria-label="Effort options"
                  className="home-model-submenu"
                  role="menu"
                >
                  <div className="home-model-submenu__title">Effort</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="composer-region">
      <PromptQueue
        onEdit={(index) => {
          const draft = editQueuedPrompt(index);
          if (draft) {
            setText(draft.text);
            setModel(draft.model);
            setEffort(draft.effort);
            setAttachments(draft.attachments ?? []);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }
        }}
        onRemove={removeQueuedPrompt}
        onSteer={(index) => void steerQueuedPrompt(index)}
        prompts={queue}
      />
      <div className="composer">
        {attachments.length > 0 && (
          <div className="composer-attachments" aria-label="Attachments">
            {attachments.map((attachment) => (
              <button
                aria-label={`Remove ${attachment.name}`}
                key={attachment.path}
                onClick={() =>
                  setAttachments((items) =>
                    items.filter((item) => item.path !== attachment.path),
                  )
                }
                type="button"
              >
                {attachment.name}
              </button>
            ))}
          </div>
        )}
        {editor}
        <div className="composer__footer">
          <ComposerUtilityBar onAttach={addAttachments} />
          <div className="composer__submit-row">
            <div className="composer-model">
              <Select
                label="Model"
                onChange={setModel}
                options={models}
                value={model}
              />
            </div>
            <div className="composer-effort">
              <Select
                label="Reasoning effort"
                onChange={setEffort}
                options={[
                  { label: "Low", value: "low" },
                  { label: "Medium", value: "medium" },
                  { label: "High", value: "high" },
                ]}
                value={effort}
              />
            </div>
            {submitButton}
          </div>
        </div>
      </div>
    </div>
  );
}
