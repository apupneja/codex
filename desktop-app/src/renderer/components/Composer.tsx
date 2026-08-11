import {
  ArrowUp,
  Bug,
  ChevronRight,
  CircleHelp,
  ListTodo,
  Mic,
  Paperclip,
  Plug,
  Plus,
  Square,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";

import type {
  ComposerContextBlock,
  DesktopPreferences,
  Model,
  PromptSubmission,
} from "../../shared/types";
import { MenuItem, MenuSurface } from "../design-system";
import { contextTitle, isLongContext } from "../lib/promptContext";
import { ComposerModelControls } from "./ComposerModelControls";
import { ComposerContextCard } from "./ContextBlock";
import { useCompactComposerLayout } from "./useCompactComposerLayout";

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
  onRestoreRequestHandled?(requestId: string, restored: boolean): void;
  onSubmit(
    submission: PromptSubmission,
  ): boolean | void | Promise<boolean | void>;
  onToast(message: string): void;
  placeholder?: string;
  preferences: DesktopPreferences;
  restoreRequest?: ComposerRestoreRequest | null;
  updatePreferences(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences>;
};

export type ComposerRestoreRequest = {
  requestId: string;
  submission: PromptSubmission;
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
  onRestoreRequestHandled,
  onSubmit,
  onToast,
  placeholder,
  preferences,
  restoreRequest = null,
  updatePreferences,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [contexts, setContexts] = useState<
    Array<ComposerContextBlock & { id: string }>
  >([]);
  const [listening, setListening] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const nextContextId = useRef(0);
  const lastRestoreRequest = useRef<string | null>(null);
  const {
    controlsRef: compactControlsRef,
    multiline: compactMultiline,
    rowRef: compactRowRef,
    textareaRef: textarea,
  } = useCompactComposerLayout(compact, text);

  useEffect(() => {
    if (
      !restoreRequest ||
      lastRestoreRequest.current === restoreRequest.requestId
    ) {
      return;
    }
    lastRestoreRequest.current = restoreRequest.requestId;
    if (text.trim() || attachments.length > 0 || contexts.length > 0) {
      onToast(
        "Finish or clear the current draft before editing a queued prompt.",
      );
      onRestoreRequestHandled?.(restoreRequest.requestId, false);
      return;
    }
    setText(restoreRequest.submission.text);
    setAttachments([...restoreRequest.submission.attachments]);
    setContexts(
      restoreRequest.submission.contexts.map((context) => ({
        ...context,
        id: `context-${nextContextId.current++}`,
      })),
    );
    onRestoreRequestHandled?.(restoreRequest.requestId, true);
    window.requestAnimationFrame(() => {
      textarea.current?.focus();
      if (textarea.current) {
        const position = textarea.current.value.length;
        textarea.current.setSelectionRange(position, position);
      }
    });
  }, [
    attachments.length,
    contexts.length,
    onRestoreRequestHandled,
    onToast,
    restoreRequest,
    text,
    textarea,
  ]);

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
    if ((!prompt && contexts.length === 0) || disabled || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const sent = await onSubmit({
        attachments,
        contexts: contexts.map(({ text: contextText, title }) => ({
          text: contextText,
          title,
        })),
        text: prompt,
      });
      if (sent !== false) {
        setText("");
        setAttachments([]);
        setContexts([]);
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

  function captureLongContext(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text/plain");
    if (!isLongContext(pasted)) return;
    event.preventDefault();
    const contextText = pasted.trim();
    setContexts((current) => [
      ...current,
      {
        id: `context-${nextContextId.current++}`,
        text: contextText,
        title: contextTitle(contextText),
      },
    ]);
  }

  function revealContext(context: ComposerContextBlock & { id: string }) {
    const revealedText = `${context.text}${text.trim() ? `\n\n${text}` : ""}`;
    if (revealedText.length > MAX_PROMPT_CHARACTERS) {
      onToast(
        "The context is too large to reveal without truncating the draft.",
      );
      return;
    }
    setContexts((current) =>
      current.filter((candidate) => candidate.id !== context.id),
    );
    setText(revealedText);
    window.requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(0, 0);
      if (textarea.current) textarea.current.scrollTop = 0;
    });
  }

  const contextCards = contexts.length ? (
    <div aria-label="Pasted context" className="context-block-strip">
      {contexts.map((context) => (
        <ComposerContextCard
          context={context}
          key={context.id}
          onRemove={() =>
            setContexts((current) =>
              current.filter((candidate) => candidate.id !== context.id),
            )
          }
          onReveal={() => revealContext(context)}
        />
      ))}
    </div>
  ) : null;
  const hasDraft = Boolean(text.trim() || contexts.length > 0);

  if (compact) {
    return (
      <div className={`composer composer-compact ${active ? "is-active" : ""}`}>
        {contextCards}
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
        <div
          className={`compact-composer-row ${compactMultiline ? "multiline" : ""}`}
          ref={compactRowRef}
        >
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
            onPaste={captureLongContext}
            placeholder="Send follow-up"
            rows={1}
            value={text}
          />
          <div className="compact-composer-controls" ref={compactControlsRef}>
            <ComposerModelControls
              compact
              disabled={active}
              models={models}
              preferences={preferences}
              updatePreferences={updatePreferences}
            />
            {active && hasDraft ? (
              <>
                <button
                  aria-label="Stop generation"
                  className="compact-stop-button"
                  onClick={onInterrupt}
                >
                  <Square fill="currentColor" size={10} />
                </button>
                <button
                  aria-label="Queue prompt"
                  className="compact-voice-button"
                  disabled={disabled || submitting}
                  onClick={() => void submit()}
                >
                  <ArrowUp size={18} strokeWidth={2.4} />
                </button>
              </>
            ) : active ? (
              <button
                aria-label="Stop generation"
                className="compact-voice-button stop"
                onClick={onInterrupt}
              >
                <Square fill="currentColor" size={11} />
              </button>
            ) : hasDraft ? (
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
      {contextCards}
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
        onPaste={captureLongContext}
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
            disabled={active}
            models={models}
            preferences={preferences}
            updatePreferences={updatePreferences}
          />
        </div>
        <div className="composer-actions">
          {active && hasDraft ? (
            <>
              <button
                aria-label="Stop generation"
                className="send-button-secondary"
                onClick={onInterrupt}
              >
                <Square fill="currentColor" size={10} />
              </button>
              <button
                aria-label="Queue prompt"
                className="send-button"
                disabled={disabled || submitting}
                onClick={() => void submit()}
              >
                <ArrowUp size={17} strokeWidth={2.4} />
              </button>
            </>
          ) : active ? (
            <button
              aria-label="Stop generation"
              className="send-button stop"
              onClick={onInterrupt}
            >
              <Square fill="currentColor" size={11} />
            </button>
          ) : hasDraft ? (
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
