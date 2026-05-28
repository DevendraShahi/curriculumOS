/** MonacoEditorPane — Monaco editor with tab bar and diff support */
"use client";

import { useSandpack } from "@codesandbox/sandpack-react";
import Editor, { DiffEditor, useMonaco } from "@monaco-editor/react";
import { useEffect } from "react";
import { syncSandpackFilesToMonaco } from "@/lib/exercise/monaco-models";

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "css")  return "css";
  if (ext === "js")   return "javascript";
  if (ext === "ts")   return "typescript";
  if (ext === "jsx")  return "javascript";
  if (ext === "tsx")  return "typescript";
  return "html";
}

const EDITOR_OPTS = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: "var(--font-geist-mono), 'JetBrains Mono', monospace",
  fontLigatures: true,
  wordWrap: "on" as const,
  lineNumbersMinChars: 3,
  scrollBeyondLastLine: false,
  automaticLayout: true,   // ← critical: re-measures when container resizes
  padding: { top: 12 },
  roundedSelection: false,
  scrollbar: { useShadows: false, verticalScrollbarSize: 5, horizontalScrollbarSize: 5 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
};

export function MonacoEditorPane({
  isShowingSolution,
  solutionCode,
}: {
  isShowingSolution?: boolean;
  solutionCode?: string;
}) {
  const { sandpack } = useSandpack();
  const monaco = useMonaco();
  const activePath = sandpack.activeFile;
  const isReadOnly = !!sandpack.files[activePath]?.readOnly;
  const lang = getLanguage(activePath);

  useEffect(() => {
    if (monaco && sandpack.files) syncSandpackFilesToMonaco(monaco, sandpack.files);
  }, [monaco, sandpack.files]);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) sandpack.updateFile(activePath, value);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}>
      {/* Tab bar */}
      <div className="ide-panel-hdr">
        <span style={{ color: "rgba(255,255,255,.65)", fontSize: "11px", letterSpacing: ".02em", textTransform: "none" }}>
          {activePath.replace(/^\//, "")}
        </span>
        {isReadOnly && (
          <span style={{ marginLeft: "auto", fontSize: "9px", opacity: .35, textTransform: "uppercase", letterSpacing: ".1em" }}>
            read-only
          </span>
        )}
        {isShowingSolution && (
          <span style={{ marginLeft: isReadOnly ? "8px" : "auto", fontSize: "9px", color: "#c084fc", textTransform: "uppercase", letterSpacing: ".1em" }}>
            diff view
          </span>
        )}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {isShowingSolution && solutionCode ? (
          <DiffEditor
            height="100%"
            theme="vs-dark"
            original={solutionCode}
            modified={sandpack.files[activePath]?.code ?? ""}
            language={lang}
            options={{ ...EDITOR_OPTS, readOnly: true, renderSideBySide: true }}
          />
        ) : (
          <Editor
            height="100%"
            path={`file://${activePath.startsWith("/") ? activePath : "/" + activePath}`}
            theme="vs-dark"
            onChange={handleChange}
            options={{ ...EDITOR_OPTS, readOnly: isReadOnly }}
          />
        )}
      </div>
    </div>
  );
}
