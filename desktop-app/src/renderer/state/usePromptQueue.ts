import { useCallback, useRef, useState } from "react";

import type { PromptSubmission } from "../../shared/types";

export type QueuedPrompt = {
  id: string;
  submission: PromptSubmission;
};

type PromptQueues = Record<string, QueuedPrompt[]>;

function copySubmission(submission: PromptSubmission): PromptSubmission {
  return {
    attachments: [...submission.attachments],
    contexts: submission.contexts.map((context) => ({ ...context })),
    text: submission.text,
  };
}

export function usePromptQueue() {
  const [queues, setQueues] = useState<PromptQueues>({});
  const queuesRef = useRef(queues);

  const updateQueues = useCallback(
    (update: (current: PromptQueues) => PromptQueues) => {
      setQueues((current) => {
        const next = update(current);
        queuesRef.current = next;
        return next;
      });
    },
    [],
  );

  const enqueue = useCallback(
    (threadId: string, submission: PromptSubmission) => {
      const queuedPrompt = {
        id: crypto.randomUUID(),
        submission: copySubmission(submission),
      };
      updateQueues((current) => ({
        ...current,
        [threadId]: [...(current[threadId] ?? []), queuedPrompt],
      }));
      return queuedPrompt;
    },
    [updateQueues],
  );

  const find = useCallback((threadId: string, promptId: string) => {
    return queuesRef.current[threadId]?.find(
      (prompt) => prompt.id === promptId,
    );
  }, []);

  const remove = useCallback(
    (threadId: string, promptId: string) => {
      updateQueues((current) => {
        const nextQueue = (current[threadId] ?? []).filter(
          (prompt) => prompt.id !== promptId,
        );
        if (nextQueue.length > 0) {
          return { ...current, [threadId]: nextQueue };
        }
        const next = { ...current };
        delete next[threadId];
        return next;
      });
    },
    [updateQueues],
  );

  return { enqueue, find, queues, remove };
}
