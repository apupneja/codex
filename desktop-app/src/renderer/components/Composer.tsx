import {
  ArrowUp,
  AtSign,
  ChevronDown,
  LockKeyhole,
  Mic,
  Paperclip,
  Plus,
  Square,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DesktopPreferences, Model } from "../../shared/types";

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
  preferences: DesktopPreferences;
  updatePreferences(
    patch: Partial<DesktopPreferences>,
  ): Promise<DesktopPreferences>;
};

function effortLabel(effort: string): string {
  const labels: Record<string, string> = {
    none: "None",
    minimal: "Minimal",
    low: "Fast",
    medium: "Balanced",
    high: "Deep",
    xhigh: "Max",
    max: "Maximum",
    ultra: "Ultra",
  };
  return (
    labels[effort] ??
    effort.replace(/[-_]/g, " ").replace(/^./, (value) => value.toUpperCase())
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
  preferences,
  updatePreferences,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
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

  const selectedModel =
    models.find((model) => model.id === preferences.selectedModel) ??
    models.find((model) => model.isDefault) ??
    models[0];
  const effortOptions = selectedModel?.supportedReasoningEfforts?.length
    ? selectedModel.supportedReasoningEfforts
    : [
        { reasoningEffort: "low", description: "Fast" },
        { reasoningEffort: "medium", description: "Balanced" },
        { reasoningEffort: "high", description: "Deep reasoning" },
      ];
  const effectiveEffort = effortOptions.some(
    (option) => option.reasoningEffort === preferences.selectedEffort,
  )
    ? preferences.selectedEffort
    : (selectedModel?.defaultReasoningEffort ??
      effortOptions[0]?.reasoningEffort ??
      "medium");

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
            aria-label="Attach files"
            className="compact-add-button"
            onClick={() => void chooseAttachments()}
            title="Attach files"
          >
            <Plus size={18} />
          </button>
          <textarea
            ref={textarea}
            aria-label={active ? "Send follow-up" : "Describe a task"}
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
            <label className="compact-model-picker" title="Choose model">
              <select
                aria-label="Model"
                onChange={(event) => {
                  const nextModel = models.find(
                    (model) => model.id === event.target.value,
                  );
                  const supportsCurrent =
                    nextModel?.supportedReasoningEfforts.some(
                      (option) =>
                        option.reasoningEffort === preferences.selectedEffort,
                    ) ?? true;
                  void updatePreferences({
                    selectedModel: event.target.value,
                    ...(!supportsCurrent && nextModel
                      ? { selectedEffort: nextModel.defaultReasoningEffort }
                      : {}),
                  });
                }}
                value={selectedModel?.id ?? ""}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-effort-picker" title="Reasoning effort">
              <select
                aria-label="Reasoning effort"
                onChange={(event) =>
                  void updatePreferences({
                    selectedEffort: event.target.value,
                  })
                }
                value={effectiveEffort}
              >
                {effortOptions.map((option) => (
                  <option
                    key={option.reasoningEffort}
                    title={option.description}
                    value={option.reasoningEffort}
                  >
                    {effortLabel(option.reasoningEffort)}
                  </option>
                ))}
              </select>
            </label>
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
        aria-label={active ? "Send follow-up" : "Describe a task"}
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
        placeholder={active ? "Send follow-up" : "Plan, build, or ask anything"}
        rows={1}
        value={text}
      />
      <div className="composer-toolbar">
        <div className="composer-tools">
          <button
            aria-label="Attach files"
            className="icon-button subtle"
            onClick={() => void chooseAttachments()}
            title="Attach files"
          >
            <Paperclip size={16} />
          </button>
          <button
            aria-label="Add context"
            className="icon-button subtle"
            onClick={() => {
              setText(
                (current) =>
                  `${current}${current && !current.endsWith(" ") ? " " : ""}@`,
              );
              textarea.current?.focus();
            }}
            title="Mention context"
          >
            <AtSign size={16} />
          </button>
          <label className="model-picker" title="Choose model">
            <WandSparkles size={14} />
            <select
              aria-label="Model"
              onChange={(event) => {
                const nextModel = models.find(
                  (model) => model.id === event.target.value,
                );
                const supportsCurrent =
                  nextModel?.supportedReasoningEfforts.some(
                    (option) =>
                      option.reasoningEffort === preferences.selectedEffort,
                  ) ?? true;
                void updatePreferences({
                  selectedModel: event.target.value,
                  ...(!supportsCurrent && nextModel
                    ? { selectedEffort: nextModel.defaultReasoningEffort }
                    : {}),
                });
              }}
              value={selectedModel?.id ?? ""}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="effort-picker" title="Reasoning effort">
            <select
              aria-label="Reasoning effort"
              onChange={(event) =>
                void updatePreferences({
                  selectedEffort: event.target.value,
                })
              }
              value={effectiveEffort}
            >
              {effortOptions.map((option) => (
                <option
                  key={option.reasoningEffort}
                  title={option.description}
                  value={option.reasoningEffort}
                >
                  {effortLabel(option.reasoningEffort)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="composer-actions">
          <span className="composer-hint">↵ send · ⇧↵ newline</span>
          <button
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={`icon-button ${listening ? "listening" : "subtle"}`}
            onClick={toggleDictation}
            title="Voice input"
          >
            <Mic size={16} />
          </button>
          {active ? (
            <button
              aria-label="Stop task"
              className="send-button stop"
              onClick={onInterrupt}
            >
              <Square fill="currentColor" size={11} />
            </button>
          ) : (
            <button
              aria-label="Send prompt"
              className="send-button"
              disabled={!text.trim() || disabled || submitting}
              onClick={() => void submit()}
            >
              <ArrowUp size={17} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
