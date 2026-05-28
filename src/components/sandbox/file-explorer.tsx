"use client";

import type { SandboxFile } from "@/lib/sandbox/types";
import { FileCode2, FileJson, FileType2, File } from "lucide-react";

type FileExplorerProps = {
  files: SandboxFile[];
  activeFileId: string | null;
  openFileIds: string[];
  onOpenFile: (fileId: string) => void;
};

export function getFileIcon(fileName: string) {
  if (fileName.endsWith(".html")) return <FileCode2 size={14} className="text-orange-400" />;
  if (fileName.endsWith(".css")) return <FileCode2 size={14} className="text-blue-400" />;
  if (fileName.endsWith(".js") || fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return <FileType2 size={14} className="text-yellow-400" />;
  if (fileName.endsWith(".json")) return <FileJson size={14} className="text-emerald-400" />;
  return <File size={14} className="text-[var(--muted-foreground)]" />;
}

export function FileExplorer({
  files,
  activeFileId,
  openFileIds,
  onOpenFile,
}: FileExplorerProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center border-b border-[var(--border)] px-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          Explorer
        </h2>
      </div>

      <div className="border-b border-[var(--border)] px-3 py-2">
        <button className="flex w-full items-center gap-2 text-left text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm">
          <span>▾</span>
          <span>Files</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-2">
        {files.map((file) => {
          const active = file.id === activeFileId;
          const open = openFileIds.includes(file.id);

          return (
            <button
              key={file.id}
              onClick={() => onOpenFile(file.id)}
              className={[
                "flex h-8 w-full items-center gap-2 px-4 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                active
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <span className="flex w-5 items-center justify-center">{getFileIcon(file.name)}</span>
              <span className="truncate">{file.name}</span>
              {open ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400/70" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
