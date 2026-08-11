import {
  ArrowUp,
  Bug,
  ChevronRight,
  CircleHelp,
  ListTodo,
  LockKeyhole,
  Mic,
  Paperclip,
  Plug,
  Plus,
  Square,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DesktopPreferences, Model } from "../../shared/types";
import { MenuItem, MenuSurface } from "../design-system";
import { ComposerModelControls } from "./ComposerModelControls";

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
};

type RecognitionConstructor = new () => SpeechRecognitionLike;

const MAX_PROMPT_CHARACTERS = 32_768;

type ComposerProps = {
  active: boolean;
  compact?: boolean;
  disabled?: boolean;
  models: Model[];
  onInterrupt(): void;
  onSubmit(
    text: string,
    attachments: string[],
  ): boolean | void | Promise<boolean | void>;
  onToast(message: string): void;
  placeholder?: string;
  preferences: DesktopPreferences;
  updatePreferences(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences>;
};

type ComposerToolsMenuProps = {
  onClose(): void;
  onFile(): void;
  onToast(message: string): void;
};

function ComposerToolsMenu({
  onClose,
  onFile,
  onToast,
}: ComposerToolsMenuProps) {
  const chooseMode = (mode: string) => {
    onToast(`${mode} mode selected for the next task.`);
    onClose();
  };
  return (
    <MenuSurface
      aria-label="Add agents, context, tools"
      className="composer-tools-menu"
    >
      <div className="composer-tools-search">
        <input
          aria-label="Search skills, context, chats"
          placeholder="Search skills, context, chats..."
        />
      </div>
      <div
        aria-label="Add agents, context, tools"
        className="composer-tools-menu-list"
        role="listbox"
      >
        <MenuItem onClick={() => chooseMode("Plan")} role="option">
          <ListTodo aria-hidden="true" size={12} />
          <span>
            Plan <small>Generate an implementation plan</small>
          </span>
        </MenuItem>
        <MenuItem onClick={() => chooseMode("Debug")} role="option">
          <Bug aria-hidden="true" size={12} />
          <span>
            Debug <small>Pinpoint the root cause of an issue</small>
          </span>
        </MenuItem>
        <MenuItem onClick={() => chooseMode("Multitask")} role="option">
          <Workflow aria-hidden="true" size={12} />
          <span>
            Multitask <small>Orchestrate multiple subagents in parallel</small>
          </span>
        </MenuItem>
        <MenuItem onClick={() => chooseMode("Ask")} role="option">
          <CircleHelp aria-hidden="true" size={12} />
          <span>
            Ask <small>Answer questions without making edits</small>
          </span>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onFile();
            onClose();
          }}
          role="option"
        >
          <Paperclip aria-hidden="true" size={12} />
          <span>File</span>
        </MenuItem>
        <MenuItem onClick={() => chooseMode("MCP")} role="option">
          <Plug aria-hidden="true" size={12} />
          <span>MCP</span>
          <ChevronRight
            aria-hidden="true"
            className="composer-tools-menu-trailing"
            size={12}
          />
        </MenuItem>
      </div>
    </MenuSurface>
  );
}

export function Composer({
  active,
  compact = false,
  disabled = false,
  models,
  onInterrupt,
  onSubmit,
  onToast,
  placeholder,
  preferences,
  updatePreferences,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const node = textarea.current;
    if (!node) {
      return;
    }
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, compact ? 132 : 180)}px`;
  }, [compact, text]);

  useEffect(
    () => () => {
      const instance = recognition.current;
      if (instance) {
        instance.onend = null;
        instance.onerror = null;
        instance.onresult = null;
        instance.stop();
        recognition.current = null;
      }
    },
    [],
  );

  async function submit(): Promise<void> {
    const prompt = text.trim();
    if (!prompt || disabled || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const sent = await onSubmit(prompt, attachments);
      if (sent !== false) {
        setText("");
        setAttachments([]);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
      textarea.current?.focus();
    }
  }

  function toggleDictation(): void {
    if (recognition.current) {
      recognition.current.stop();
      recognition.current = null;
      setListening(false);
      return;
    }
    const host = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Recognition) {
      onToast("Voice dictation is not available in this system webview.");
      return;
    }
    const instance = new Recognition();
    instance.continuous = true;
    instance.interimResults = false;
    instance.lang = navigator.language || "en-US";
    instance.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setText((current) =>
        `${current}${current ? " " : ""}${transcript}`.slice(
          0,
          MAX_PROMPT_CHARACTERS,
        ),
      );
    };
    instance.onerror = () => {
      setListening(false);
      recognition.current = null;
      onToast("Voice dictation stopped before audio could be recognized.");
    };
    instance.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    recognition.current = instance;
    setListening(true);
    instance.start();
  }

  async function chooseAttachments(): Promise<void> {
    try {
      const paths = await window.codexDesktop.chooseFiles();
      setAttachments((current) =>
        Array.from(new Set([...current, ...paths])).slice(0, 20),
      );
    } catch (error) {
      onToast(error instanceof Error ? error.message : String(error));
    }
  }

  if (compact) {
    return (
      <div className={`composer composer-compact ${active ? "is-active" : ""}`}>
        {attachments.length > 0 ? (
          <div className="attachment-strip" aria-label="Attached files">
            {attachments.map((path) => (
              <button
                className="attachment-chip"
                key={path}
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((item) => item !== path),
                  )
                }
                title="Remove attachment"
              >
                {path.split(/[\\/]/).pop()}
                <span>×</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="compact-composer-row">
          <button
            aria-label="Add agents, context, tools"
            aria-haspopup="menu"
            className="compact-add-button"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((value) => !value)}
            title="Attach files"
          >
            <Plus size={18} />
          </button>
          {toolsOpen ? (
            <ComposerToolsMenu
              onClose={() => setToolsOpen(false)}
              onFile={() => void chooseAttachments()}
              onToast={onToast}
            />
          ) : null}
          <textarea
            ref={textarea}
            aria-label="Send follow-up"
            disabled={disabled || submitting}
            maxLength={MAX_PROMPT_CHARACTERS}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Send follow-up"
            rows={1}
            value={text}
          />
          <div className="compact-composer-controls">
            <ComposerModelControls
              compact
              models={models}
              preferences={preferences}
              updatePreferences={updatePreferences}
            />
            <LockKeyhole aria-hidden="true" size={12} />
            {active ? (
              <button
                aria-label="Stop task"
                className="compact-voice-button stop"
                onClick={onInterrupt}
              >
                <Square fill="currentColor" size={11} />
              </button>
            ) : text.trim() ? (
              <button
                aria-label="Send prompt"
                className="compact-voice-button"
                disabled={disabled || submitting}
                onClick={() => void submit()}
              >
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            ) : (
              <button
                aria-label={
                  listening ? "Stop voice input" : "Start voice input"
                }
                className={`compact-voice-button ${listening ? "listening" : ""}`}
                onClick={toggleDictation}
                title="Voice input"
              >
                <Mic size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`composer ${compact ? "composer-compact" : ""} ${active ? "is-active" : ""}`}
    >
      {attachments.length > 0 ? (
        <div className="attachment-strip" aria-label="Attached files">
          {attachments.map((path) => (
            <button
              className="attachment-chip"
              key={path}
              onClick={() =>
                setAttachments((current) =>
                  current.filter((item) => item !== path),
                )
              }
              title="Remove attachment"
            >
              {path.split(/[\\/]/).pop()}
              <span>×</span>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={textarea}
        aria-label={
          active ? "Send follow-up" : (placeholder ?? "Describe a task")
        }
        autoFocus={!compact}
        disabled={disabled || submitting}
        maxLength={MAX_PROMPT_CHARACTERS}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={
          placeholder ??
          (active ? "Send follow-up" : "Plan, build, or ask anything")
        }
        rows={1}
        value={text}
      />
      <div className="composer-toolbar">
        <div className="composer-tools">
          <button
            aria-label="Add agents, context, tools"
            aria-haspopup="menu"
            className="composer-add-button"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((value) => !value)}
            title="Attach files"
          >
            <Plus size={16} />
          </button>
          {toolsOpen ? (
            <ComposerToolsMenu
              onClose={() => setToolsOpen(false)}
              onFile={() => void chooseAttachments()}
              onToast={onToast}
            />
          ) : null}
          <ComposerModelControls
            models={models}
            preferences={preferences}
            updatePreferences={updatePreferences}
          />
          <LockKeyhole aria-hidden="true" size={11} />
        </div>
        <div className="composer-actions">
          {active ? (
            <button
              aria-label="Stop task"
              className="send-button stop"
              onClick={onInterrupt}
            >
              <Square fill="currentColor" size={11} />
            </button>
          ) : text.trim() ? (
            <button
              aria-label="Send prompt"
              className="send-button"
              disabled={disabled || submitting}
              onClick={() => void submit()}
            >
              <ArrowUp size={17} strokeWidth={2.4} />
            </button>
          ) : (
            <button
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={`composer-voice-button ${listening ? "listening" : ""}`}
              onClick={toggleDictation}
              title="Voice input"
            >
              <Mic size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
