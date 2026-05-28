"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SandboxWorkspace } from "./sandbox-workspace";
import { BottomPanel, type BottomTab } from "./bottom-panel";
import { RotateCcw, Loader2, Play } from "lucide-react";
import { buildPreviewSrcDoc } from "@/lib/sandbox/build-preview-srcdoc";
import { sandboxValidators } from "@/lib/sandbox/validators";
import { useSandboxAutosave } from "@/lib/sandbox/use-sandbox-autosave";
import { evaluateValidationRules } from "@/lib/sandbox/evaluate-validation-rules";
import type { SandboxFile, SandboxLesson, SandboxRuntimeError, SandboxProblem } from "@/lib/sandbox/types";

type SandboxInitialSession = {
  files?: SandboxFile[];
  openFileIds?: string[];
  activeFileId?: string | null;
};

type SandboxShellProps = {
  courseId: string;
  lessonId: string;
  exerciseId: string;
  lesson: SandboxLesson;
  returnHref: string;
  initialSession?: SandboxInitialSession | null;
};

export function SandboxShell({
  courseId,
  lessonId,
  exerciseId,
  lesson,
  returnHref,
  initialSession,
}: SandboxShellProps) {
  const router = useRouter();
  const [submitStatus, setSubmitStatus] = useState<"idle" | "checking" | "passed" | "failed" | "error">("idle");
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomTab>("problems");
  const [files, setFiles] = useState<SandboxFile[]>(
    () => initialSession?.files?.length ? initialSession.files : lesson.initialFiles
  );
  
  const [openFileIds, setOpenFileIds] = useState<string[]>(() => {
    if (initialSession?.openFileIds?.length) {
      return initialSession.openFileIds;
    }
    const first = lesson.initialFiles.find((file) => file.name === "index.html");
    return first ? [first.id] : [];
  });
  
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    if (initialSession?.activeFileId) {
      return initialSession.activeFileId;
    }
    if (initialSession?.openFileIds?.length) {
      return initialSession.openFileIds[0];
    }
    return lesson.initialFiles.find((file) => file.name === "index.html")?.id ?? null;
  });
  const [runtimeErrors, setRuntimeErrors] = useState<SandboxRuntimeError[]>([]);
  const [previewSrcDoc, setPreviewSrcDoc] = useState<string>(() =>
    buildPreviewSrcDoc(initialSession?.files?.length ? initialSession.files : lesson.initialFiles)
  );
  const [isPreviewDirty, setIsPreviewDirty] = useState(false);
  const isFirstFilesEffect = useRef(true);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== "sandbox-error") return;

      setRuntimeErrors((current) => [
        {
          id: crypto.randomUUID(),
          type: "runtime-error",
          message: event.data.message ?? "Unknown sandbox error",
          line: event.data.line,
          column: event.data.column,
          source: event.data.source,
          createdAt: Date.now(),
        },
        ...current,
      ]);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Clear runtime errors when active file changes, not all files (which causes loops)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuntimeErrors([]);
  }, [activeFileId]);

  const activeFile = files.find((file) => file.id === activeFileId);

  const validationResults = useMemo(() => {
    if (lesson.validationRules && lesson.validationRules.length > 0) {
      return evaluateValidationRules({
        rules: lesson.validationRules,
        files,
        initialFiles: lesson.initialFiles,
      });
    }

    const validator = sandboxValidators[lesson.validatorId] || sandboxValidators["default"];
    return validator(files);
  }, [files, lesson.initialFiles, lesson.validationRules, lesson.validatorId]);

  useEffect(() => {
    if (isFirstFilesEffect.current) {
      isFirstFilesEffect.current = false;
      return;
    }

    setIsPreviewDirty(true);
  }, [files]);

  const problems = useMemo<SandboxProblem[]>(() => {
    const validationProblems: SandboxProblem[] = validationResults
      .filter((item) => !item.passed)
      .map((item) => ({
        id: `validation-${item.id}`,
        severity: "warning",
        source: "validation",
        title: item.label,
        message: "This validation check has not passed yet.",
      }));

    const runtimeProblems: SandboxProblem[] = runtimeErrors.map((error) => ({
      id: error.id,
      severity: "error",
      source: "runtime",
      title: "Runtime error",
      message: error.message,
      line: error.line,
      column: error.column,
    }));

    return [...runtimeProblems, ...validationProblems];
  }, [validationResults, runtimeErrors]);

  function openFile(fileId: string) {
    setOpenFileIds((current) =>
      current.includes(fileId) ? current : [...current, fileId]
    );
    setActiveFileId(fileId);
  }

  function closeFile(fileId: string) {
    setOpenFileIds((current) => {
      const next = current.filter((id) => id !== fileId);

      if (activeFileId === fileId) {
        const closedIndex = current.indexOf(fileId);
        const fallbackId =
          next[closedIndex] ?? next[closedIndex - 1] ?? next[0] ?? null;

        setActiveFileId(fallbackId);
      }

      return next;
    });
  }

  function updateActiveFile(value: string) {
    if (!activeFileId) return;

    setFiles((current) =>
      current.map((file) =>
        file.id === activeFileId ? { ...file, value } : file
      )
    );
  }

  const { status: saveStatus, saveNow } = useSandboxAutosave({
    lessonId,
    exerciseId,
    files,
    openFileIds,
    activeFileId,
  });

  const handleSaveShortcut = useCallback(async () => {
    await saveNow();
  }, [saveNow]);

  useEffect(() => {
    function onSaveKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "s") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      void handleSaveShortcut();
    }

    window.addEventListener("keydown", onSaveKey);
    return () => window.removeEventListener("keydown", onSaveKey);
  }, [handleSaveShortcut]);

  function handleReset() {
    const confirmed = window.confirm(
      "Reset this exercise? Your current code changes will be discarded."
    );
  
    if (!confirmed) return;
  
    const resetFiles = lesson.initialFiles.map((file) => ({ ...file }));
    const indexFile = resetFiles.find((file) => file.name === "index.html");
    const nextOpenFileIds = indexFile ? [indexFile.id] : (resetFiles.length > 0 ? [resetFiles[0].id] : []);
  
    setFiles(resetFiles);
    setOpenFileIds(nextOpenFileIds);
    setActiveFileId(nextOpenFileIds[0] ?? null);
    setPreviewSrcDoc(buildPreviewSrcDoc(resetFiles));
    setIsPreviewDirty(false);
    setRuntimeErrors([]);
    setSubmitStatus("idle");
    setBottomPanelOpen(false);
  }

  function handleRun() {
    setRuntimeErrors([]);
    setPreviewSrcDoc(buildPreviewSrcDoc(files));
    setIsPreviewDirty(false);
  }

  async function handleSubmit() {
    try {
      setSubmitStatus("checking");

      const failedChecks = validationResults.filter((item) => !item.passed);

      if (failedChecks.length > 0) {
        setSubmitStatus("failed");
        setBottomPanelTab("problems");
        setBottomPanelOpen(true);
        return;
      }

      const response = await fetch("/api/v1/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          lessonId,
          state: "completed",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit progress");
      }

      setSubmitStatus("passed");
      router.push(returnHref);
    } catch {
      setSubmitStatus("error");
      setBottomPanelTab("problems");
      setBottomPanelOpen(true);
    }
  }

  return (
    <div className="h-[calc(100vh-72px)] w-full grid grid-rows-[44px_minmax(0,1fr)_auto] overflow-hidden bg-[var(--background)] text-[var(--foreground)] font-sans">
      {/* Toolbar */}
      <div className="border-b border-[var(--border)] px-4 flex items-center justify-between">
        <Link href={returnHref} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-mono uppercase tracking-widest transition-colors">
          ← Back to Lesson
        </Link>

        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-mono">
          {lesson.title}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            title="Compile and run preview"
            className={[
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest transition-colors",
              isPreviewDirty
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface)]",
            ].join(" ")}
          >
            <Play size={12} />
            <span className="hidden sm:inline">{isPreviewDirty ? "Run" : "Run Again"}</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset code"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitStatus === "checking"}
            className={[
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-[11px] font-mono tracking-widest uppercase transition-colors",
              submitStatus === "checking"
                ? "bg-[var(--surface-2)] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600",
            ].join(" ")}
          >
            {submitStatus === "checking" ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Checking...
              </>
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <SandboxWorkspace
        lesson={lesson}
        files={files}
        openFileIds={openFileIds}
        activeFile={activeFile}
        activeFileId={activeFileId}
        setActiveFileId={setActiveFileId}
        openFile={openFile}
        closeFile={closeFile}
        updateActiveFile={updateActiveFile}
        previewSrcDoc={previewSrcDoc}
        isPreviewDirty={isPreviewDirty}
        validationResults={validationResults}
      />

      {/* Footer / Bottom Panel */}
      <BottomPanel
        problems={problems}
        validationResults={validationResults}
        saveStatus={saveStatus}
        open={bottomPanelOpen}
        onOpenChange={setBottomPanelOpen}
        activeTab={bottomPanelTab}
        onTabChange={setBottomPanelTab}
      />
    </div>
  );
}
