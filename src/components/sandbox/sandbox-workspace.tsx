"use client";

import { useState } from "react";
import { ActivityRail } from "./activity-rail";
import { CollapsibleSidePanel } from "./collapsible-side-panel";
import { EditorPanel } from "./editor-panel";
import { PreviewPanel } from "./preview-panel";
import type {
  SandboxFile,
  SandboxLesson,
  ValidationResult,
} from "@/lib/sandbox/types";

type SidebarPanel = "task" | "files" | "tests" | "settings";

type SandboxWorkspaceProps = {
  lesson: SandboxLesson;
  files: SandboxFile[];
  openFileIds: string[];
  activeFileId: string | null;
  activeFile?: SandboxFile;
  setActiveFileId: (id: string | null) => void;
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  updateActiveFile: (value: string) => void;
  previewSrcDoc: string;
  isPreviewDirty: boolean;
  validationResults: ValidationResult[];
};

export function SandboxWorkspace({
  lesson,
  files,
  openFileIds,
  activeFileId,
  activeFile,
  setActiveFileId,
  openFile,
  closeFile,
  updateActiveFile,
  previewSrcDoc,
  isPreviewDirty,
  validationResults,
}: SandboxWorkspaceProps) {
  const [activeSidebarPanel, setActiveSidebarPanel] =
    useState<SidebarPanel | null>("task");

  function toggleSidebarPanel(panel: SidebarPanel) {
    setActiveSidebarPanel((current) => (current === panel ? null : panel));
  }

  return (
    <main className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-y-auto lg:overflow-hidden bg-[var(--background)]">
      <ActivityRail
        activePanel={activeSidebarPanel}
        onTogglePanel={toggleSidebarPanel}
      />

      <CollapsibleSidePanel
        activePanel={activeSidebarPanel}
        lesson={lesson}
        files={files}
        activeFileId={activeFileId}
        openFileIds={openFileIds}
        validationResults={validationResults}
        onOpenFile={openFile}
      />

      <EditorPanel
        files={files}
        openFileIds={openFileIds}
        activeFile={activeFile}
        activeFileId={activeFileId}
        setActiveFileId={setActiveFileId}
        closeFile={closeFile}
        updateActiveFile={updateActiveFile}
      />

      <PreviewPanel srcDoc={previewSrcDoc} isDirty={isPreviewDirty} />
    </main>
  );
}
