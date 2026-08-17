import { useEffect, useLayoutEffect, useRef } from "react";

export function useThreadScroll(
  streamRevision: number,
  latestUserAnchor: string | null,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeAnchor = useRef<string | null>(null);
  const followingLatestTurn = useRef(true);
  const adjustingScroll = useRef(false);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || latestUserAnchor == null) return;
    if (activeAnchor.current !== latestUserAnchor) {
      activeAnchor.current = latestUserAnchor;
      followingLatestTurn.current = true;
    }
    if (!followingLatestTurn.current) return;
    const anchors = element.querySelectorAll<HTMLElement>(
      ".turn-view:last-child .user-message-group",
    );
    const anchor = anchors.item(anchors.length - 1);
    if (!anchor) return;
    const targetTop =
      element.scrollTop +
      anchor.getBoundingClientRect().top -
      element.getBoundingClientRect().top -
      8;
    if (Math.abs(element.scrollTop - targetTop) < 1) return;
    adjustingScroll.current = true;
    element.scrollTop = targetTop;
    const frame = requestAnimationFrame(() => {
      adjustingScroll.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [latestUserAnchor, streamRevision]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onScroll = () => {
      if (!adjustingScroll.current) followingLatestTurn.current = false;
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  return containerRef;
}
