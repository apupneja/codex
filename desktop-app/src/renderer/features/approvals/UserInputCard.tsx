import { ArrowRight, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { type Approval, useSession } from "../../state/session";

type UserInputOption = {
  description: string;
  label: string;
};

type UserInputQuestion = {
  id: string;
  isOther: boolean;
  options: UserInputOption[];
  question: string;
};

type UserInputAnswer = {
  freeform: string;
  selected: string | null;
};

function readQuestions(request: Approval): UserInputQuestion[] {
  if (!Array.isArray(request.params.questions)) return [];
  return request.params.questions.flatMap((value, index) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }
    const question = value as Record<string, unknown>;
    const text = typeof question.question === "string" ? question.question : "";
    if (!text.trim()) return [];
    const options = Array.isArray(question.options)
      ? question.options.flatMap((option) => {
          if (
            option == null ||
            typeof option !== "object" ||
            Array.isArray(option)
          ) {
            return [];
          }
          const record = option as Record<string, unknown>;
          return typeof record.label === "string"
            ? [
                {
                  description:
                    typeof record.description === "string"
                      ? record.description
                      : "",
                  label: record.label,
                },
              ]
            : [];
        })
      : [];
    return [
      {
        id: typeof question.id === "string" ? question.id : `question-${index}`,
        isOther: question.isOther !== false,
        options,
        question: text,
      },
    ];
  });
}

export function UserInputCard({ request }: { request: Approval }) {
  const { dismissUserInput, resolveUserInput } = useSession();
  const questions = useMemo(() => readQuestions(request), [request]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<UserInputAnswer[]>(() =>
    questions.map((question) => ({
      freeform: "",
      selected: question.options[0]?.label ?? null,
    })),
  );
  const advanceTimer = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current != null) clearTimeout(advanceTimer.current);
    },
    [],
  );

  if (questions.length === 0) return null;
  const currentQuestion = questions[questionIndex];
  const currentAnswer = answers[questionIndex] ?? {
    freeform: "",
    selected: null,
  };
  const isLast = questionIndex === questions.length - 1;

  const submitAnswers = (nextAnswers = answers) => {
    resolveUserInput(
      request,
      Object.fromEntries(
        questions.map((question, index) => {
          const answer = nextAnswers[index];
          const value = answer?.freeform.trim() || answer?.selected;
          return [question.id, value ? [value] : []];
        }),
      ),
    );
  };

  const advance = (nextAnswers = answers) => {
    if (isLast) submitAnswers(nextAnswers);
    else setQuestionIndex((index) => index + 1);
  };

  const chooseOption = (label: string) => {
    if (advanceTimer.current != null) return;
    const nextAnswers = answers.map((answer, index) =>
      index === questionIndex ? { freeform: "", selected: label } : answer,
    );
    setAnswers(nextAnswers);
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      advance(nextAnswers);
    }, 180);
  };

  const updateFreeform = (value: string) => {
    setAnswers((items) =>
      items.map((answer, index) =>
        index === questionIndex ? { freeform: value, selected: null } : answer,
      ),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismissUserInput(request);
      return;
    }
    if (event.key === "ArrowLeft" && questionIndex > 0) {
      event.preventDefault();
      setQuestionIndex((index) => index - 1);
      return;
    }
    if (event.key === "ArrowRight" && !isLast) {
      event.preventDefault();
      setQuestionIndex((index) => index + 1);
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      const option = currentQuestion.options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        chooseOption(option.label);
      }
    }
  };

  return (
    <div className="user-input-request-region">
      <div
        className="user-input-card"
        data-codex-composer-request-navigation="true"
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        <div className="user-input-card__header">
          <div className="user-input-card__header-main">
            <h2>{currentQuestion.question}</h2>
            {questions.length > 1 && (
              <div className="user-input-card__navigation">
                <button
                  aria-label="Previous question"
                  disabled={questionIndex === 0}
                  onClick={() => setQuestionIndex((index) => index - 1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <span>
                  {questionIndex + 1} of {questions.length}
                </span>
                <button
                  aria-label="Next question"
                  disabled={isLast}
                  onClick={() => setQuestionIndex((index) => index + 1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          <button
            aria-label="Dismiss"
            className="user-input-card__dismiss"
            onClick={() => dismissUserInput(request)}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="user-input-card__body">
          <div className="user-input-card__options" role="radiogroup">
            {currentQuestion.options.map((option, index) => {
              const selected = currentAnswer.selected === option.label;
              return (
                <button
                  aria-checked={selected}
                  aria-description={option.description || undefined}
                  aria-label={option.label}
                  className={selected ? "is-selected" : ""}
                  key={option.label}
                  onClick={() => chooseOption(option.label)}
                  role="radio"
                  type="button"
                >
                  <span className="user-input-card__marker">{index + 1}</span>
                  <span className="user-input-card__option-copy">
                    <strong>{option.label}</strong>
                    {option.description && <span>{option.description}</span>}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="user-input-card__option-arrow"
                  />
                </button>
              );
            })}
          </div>
          {currentQuestion.isOther && (
            <div
              className={`user-input-card__other${currentAnswer.freeform ? " is-active" : ""}`}
              onMouseDown={(event) => {
                if (!(event.target instanceof HTMLButtonElement)) {
                  event.preventDefault();
                  textareaRef.current?.focus();
                }
              }}
            >
              <span className="user-input-card__marker">
                <Pencil aria-hidden="true" />
              </span>
              <textarea
                onChange={(event) => updateFreeform(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    advance();
                  }
                }}
                placeholder="No, and tell ChatGPT what to do differently"
                ref={textareaRef}
                rows={1}
                value={currentAnswer.freeform}
              />
              <button onClick={() => advance()} type="button">
                {currentAnswer.freeform.trim() ? "Next" : "Skip"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
