import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

import type { DesktopPreferences, OpenDocument } from "../../shared/types";
import { monospaceFontFamily } from "../design-system";
import "../lib/monaco";

type CodeEditorProps = {
  document: OpenDocument;
  fontSize: number;
  onChange(value: string): void;
  onSave(): void;
  theme: DesktopPreferences["theme"];
};

export function CodeEditor({
  document,
  fontSize,
  onChange,
  onSave,
  theme,
}: CodeEditorProps) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <Editor
      height="100%"
      language={document.language}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
          onSaveRef.current(),
        );
      }}
      options={{
        automaticLayout: true,
        cursorBlinking: "smooth",
        fontFamily: monospaceFontFamily(),
        fontLigatures: true,
        fontSize,
        minimap: { enabled: false },
        padding: { top: 12 },
        renderWhitespace: "selection",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
      }}
      path={document.path}
      theme={
        theme === "light" ||
        theme === "light-colorblind" ||
        (theme === "system" && !systemDark)
          ? "light"
          : "vs-dark"
      }
      value={document.text}
    />
  );
}
