import { useLayoutEffect, useRef, useState } from "react";

export function useCompactComposerLayout(compact: boolean, text: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inlineControlsWidth = useRef(0);
  const [multiline, setMultiline] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const textareaStyle = window.getComputedStyle(textarea);

    if (compact) {
      const row = rowRef.current;
      const controls = controlsRef.current;
      const addButton = row?.querySelector<HTMLElement>(".compact-add-button");
      if (row && controls && addButton) {
        if (!multiline) {
          const measuredControlsWidth = controls.getBoundingClientRect().width;
          if (measuredControlsWidth > 0) {
            inlineControlsWidth.current = measuredControlsWidth;
          }
        }

        const rowWidth = row.getBoundingClientRect().width;
        const addButtonWidth = addButton.getBoundingClientRect().width;
        const controlsWidth =
          inlineControlsWidth.current || controls.getBoundingClientRect().width;
        const columnGap =
          Number.parseFloat(window.getComputedStyle(row).columnGap) || 0;
        const minimumTextWidth = Number.parseFloat(textareaStyle.minWidth) || 0;
        const inlineTextWidth = Math.max(
          minimumTextWidth,
          rowWidth - addButtonWidth - controlsWidth - columnGap * 2,
        );

        if (rowWidth > 0 && controlsWidth > 0) {
          const previousHeight = textarea.style.height;
          const previousWidth = textarea.style.width;
          const previousWrap = textarea.wrap;
          textarea.wrap = "off";
          textarea.style.height = "0px";
          textarea.style.width = `${inlineTextWidth}px`;
          const wrapsInline = textarea.scrollWidth > textarea.clientWidth + 1;
          textarea.wrap = previousWrap;
          textarea.style.height = previousHeight;
          textarea.style.width = previousWidth;
          setMultiline(text.includes("\n") || (Boolean(text) && wrapsInline));
        } else {
          const lineHeight = Number.parseFloat(textareaStyle.lineHeight) || 24;
          const verticalPadding =
            (Number.parseFloat(textareaStyle.paddingTop) || 0) +
            (Number.parseFloat(textareaStyle.paddingBottom) || 0);
          textarea.style.height = "0px";
          const contentHeight = Math.max(
            0,
            textarea.scrollHeight - verticalPadding,
          );
          setMultiline(
            text.includes("\n") || contentHeight > lineHeight * 1.25,
          );
        }
      }
    }

    textarea.style.height = "0px";
    const measuredHeight = textarea.scrollHeight;
    const maximumHeight = Number.parseFloat(textareaStyle.maxHeight);
    textarea.style.height = `${Math.min(
      measuredHeight,
      Number.isFinite(maximumHeight) ? maximumHeight : measuredHeight,
    )}px`;
  }, [compact, layoutRevision, multiline, text]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!compact || !row || typeof ResizeObserver === "undefined") return;

    const controls = controlsRef.current;
    let rowWidth = row.getBoundingClientRect().width;
    let controlsWidth = controls?.getBoundingClientRect().width ?? 0;
    const observer = new ResizeObserver(() => {
      const nextRowWidth = row.getBoundingClientRect().width;
      const nextControlsWidth = controls?.getBoundingClientRect().width ?? 0;
      if (
        Math.abs(nextRowWidth - rowWidth) < 0.5 &&
        Math.abs(nextControlsWidth - controlsWidth) < 0.5
      ) {
        return;
      }
      rowWidth = nextRowWidth;
      controlsWidth = nextControlsWidth;
      setLayoutRevision((current) => current + 1);
    });
    observer.observe(row);
    if (!multiline && controls) observer.observe(controls);
    return () => observer.disconnect();
  }, [compact, multiline]);

  return { controlsRef, multiline, rowRef, textareaRef };
}
