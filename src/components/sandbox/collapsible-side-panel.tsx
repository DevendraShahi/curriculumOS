"use client";

import { TaskPanel } from "./task-panel";
import { FileExplorer } from "./file-explorer";
import type {
  SandboxFile,
  SandboxLesson,
  ValidationResult,
} from "@/lib/sandbox/types";
import { Check, Circle } from "lucide-react";

type SidebarPanel = "task" | "files" | "tests" | "settings";

type CollapsibleSidePanelProps = {
  activePanel: SidebarPanel | null;
  lesson: SandboxLesson;
  files: SandboxFile[];
  activeFileId: string | null;
  openFileIds: string[];
  validationResults: ValidationResult[];
  onOpenFile: (fileId: string) => void;
};

export function CollapsibleSidePanel({
  activePanel,
  lesson,
  files,
  activeFileId,
  openFileIds,
  validationResults,
  onOpenFile,
}: CollapsibleSidePanelProps) {
  if (!activePanel) return null;

  return (
    <aside className="w-full lg:w-[300px] shrink-0 min-h-[300px] lg:min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--surface)]">
      {activePanel === "task" ? (
        <TaskPanel
          key={lesson.id}
          lesson={lesson}
          validationResults={validationResults}
        />
      ) : null}

      {activePanel === "files" ? (
        <FileExplorer
          files={files}
          activeFileId={activeFileId}
          openFileIds={openFileIds}
          onOpenFile={onOpenFile}
        />
      ) : null}

      {activePanel === "tests" ? (
        <div className="h-full overflow-auto p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Tests
          </p>

          <div className="space-y-2">
            {validationResults.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={
                      item.passed ? "text-emerald-500" : "text-[var(--muted-foreground)]"
                    }
                  >
                    {item.passed ? <Check size={16} /> : <Circle size={16} />}
                  </span>
                  <p className="text-sm leading-5 text-[var(--foreground)]">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activePanel === "settings" ? (
        <div className="p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Settings
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Sandbox preferences will appear here.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
