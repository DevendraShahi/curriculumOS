"use client";

import { CodeEditor } from "./code-editor";
import { getFileIcon } from "./file-explorer";
import type { SandboxFile } from "@/lib/sandbox/types";

type EditorPanelProps = {
  files: SandboxFile[];
  openFileIds: string[];
  activeFile?: SandboxFile;
  activeFileId: string | null;
  setActiveFileId: (id: string | null) => void;
  closeFile: (id: string) => void;
  updateActiveFile: (value: string) => void;
};

export function EditorPanel({
  files,
  openFileIds,
  activeFile,
  activeFileId,
  setActiveFileId,
  closeFile,
  updateActiveFile,
}: EditorPanelProps) {
  const openFiles = openFileIds
    .map((id) => files.find((file) => file.id === id))
    .filter(Boolean) as SandboxFile[];

  return (
    <section className="flex-1 min-h-[400px] lg:min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex h-10 items-center overflow-x-auto border-b border-[var(--border)]">
        {openFiles.length > 0 ? (
          openFiles.map((file) => {
            const active = file.id === activeFileId;

            return (
              <div
                key={file.id}
                className={[
                  "group flex h-full shrink-0 items-center border-r border-[var(--border)] transition-colors",
                  active ? "bg-[var(--surface-2)]" : "bg-transparent",
                ].join(" ")}
              >
                <button
                  onClick={() => setActiveFileId(file.id)}
                  className={[
                    "flex h-full items-center gap-2 px-3 text-xs",
                    active
                      ? "text-[var(--accent)] font-medium"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  <span className="flex items-center opacity-70 group-hover:opacity-100">{getFileIcon(file.name)}</span>
                  <span>{file.name}</span>
                </button>

                <button
                  onClick={() => closeFile(file.id)}
                  className="mr-2 rounded px-1 text-[var(--muted-foreground)] opacity-0 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] group-hover:opacity-100 transition-colors"
                  aria-label={`Close ${file.name}`}
                >
                  ×
                </button>
              </div>
            );
          })
        ) : (
          <div className="flex h-full items-center px-4 text-xs italic text-[var(--muted-foreground)]">
            No files open
          </div>
        )}
      </div>

      <div className="h-[calc(100%-40px)] w-full overflow-hidden bg-[var(--surface)]">
        {activeFile ? (
          <CodeEditor
            value={activeFile.value}
            language={activeFile.language}
            fileName={activeFile.name}
            onChange={updateActiveFile}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-[var(--muted-foreground)]">
              Select a file to edit
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
