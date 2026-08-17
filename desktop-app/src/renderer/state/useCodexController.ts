import { useSession } from "./session";

/** Compatibility hook for renderer features that consume the desktop session. */
export function useCodexController() {
  const controller = useSession();
  const { steerQueuedPrompt } = controller;
  return { ...controller, steerQueuedPrompt };
}
