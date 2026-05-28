/**
 * LiveExerciseIDE — main orchestrator
 *
 * Layout architecture:
 *   .ide-root (flex column, 100vh)
 *     IDEToolbar
 *     SandpackProvider
 *       .ide-body (flex row)
 *         ActivityRail           (48px wide, fixed)
 *         .ide-sidebar           (width = --ide-sidebar-w CSS var)
 *         DragHandle horizontal  (sidebar resize)
 *         .ide-editor-zone       (flex: 1, flex row or col based on mode)
 *           .ide-monaco-pane     (width = --ide-editor-w CSS var in H mode)
 *           DragHandle           (editor/preview split)
 *           .ide-preview-col     (flex: 1)
 *             .ide-preview-wrap  (flex: 1 — iframe)
 *             DragHandle vertical
 *             .ide-console-panel (height = --ide-console-h CSS var)
 *
 * All three resize dimensions are driven by CSS custom properties mutated
 * via pointer events with pointer capture — ZERO re-renders during drag.
 */
"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SandpackProvider, SandpackPreview, SandpackConsole } from "@codesandbox/sandpack-react";
import { TerminalSquare } from "lucide-react";

import "./ide.css";

import { ValidationRule } from "@/lib/playground-validation";
import { IDEToolbar }   from "./IDEToolbar";
import { ActivityRail } from "./ActivityRail";
import { DragHandle }   from "./DragHandle";
import { InstructionsPanel } from "./InstructionsPanel";
import { ExplorerPanel }     from "./ExplorerPanel";
import { ValidationPanel }   from "./ValidationPanel";
import { useColResize, useEditorFraction, useRowResize } from "./useResize";

import type { SidebarTab } from "./ActivityRail";

const MonacoEditorPane = dynamic(
  () => import("./MonacoEditorPane").then((m) => m.MonacoEditorPane),
  { ssr: false }
);

export type Exercise = {
  id: string;
  type: string;
  task: string;
  instructions: string;
  starterCode: string;
  solutionCode?: string;
  validationRules: ValidationRule[];
};

export function LiveExerciseIDE({
  exercises,
  returnHref,
}: {
  exercises: Exercise[];
  returnHref: string;
}) {
  const router = useRouter();
  const [currentIndex,     setCurrentIndex    ] = useState(0);
  const [activeTab,        setActiveTab        ] = useState<SidebarTab>("task");
  const [layoutMode,       setLayoutMode       ] = useState<"h" | "v">("h");
  const [showConsole,      setShowConsole      ] = useState(false);
  const [showSolution,     setShowSolution     ] = useState(false);

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowSolution(false);
    } else {
      router.push(returnHref);
    }
  };

  const toggleTab = (tab: SidebarTab) =>
    setActiveTab((prev) => (prev === tab ? null : tab));

  // ── Resize hooks ─────────────────────────────────────────────────────────
  // Single container ref — all CSS vars live on .ide-root
  const rootRef = useRef<HTMLDivElement>(null);

  const sidebarResize = useColResize({
    containerRef: rootRef, cssVar: "--ide-sidebar-w",
    initial: 340, min: 220, max: 700,
  });

  const editorResize = useEditorFraction(rootRef, 50);

  const consoleResize = useRowResize({
    containerRef: rootRef, cssVar: "--ide-console-h",
    initial: 200, min: 80, max: 450,
  });

  // All hooks must be called before any conditional return (rules of hooks)
  const exercise = exercises[currentIndex];
  if (!exercise) return null;

  // Propagate pointermove/up to all active resizers from the editor zone
  const editorZoneEvents = {
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      editorResize.onPointerMove(e);
      consoleResize.onPointerMove(e);
    },
    onPointerUp: () => {
      editorResize.onPointerUp();
      consoleResize.onPointerUp();
    },
  };

  // Propagate sidebar resize across the whole body
  const bodyEvents = {
    onPointerMove: sidebarResize.onPointerMove,
    onPointerUp:   sidebarResize.onPointerUp,
  };

  return (
    <div
      ref={rootRef}
      className="ide-root"
      style={{ "--ide-sidebar-w": "340px", "--ide-editor-w": "50%", "--ide-console-h": "200px" } as React.CSSProperties}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <IDEToolbar
        returnHref={returnHref}
        layoutMode={layoutMode}
        onLayoutMode={setLayoutMode}
        showConsole={showConsole}
        onToggleConsole={() => setShowConsole((s) => !s)}
        showSolution={showSolution}
        onToggleSolution={() => setShowSolution((s) => !s)}
        hasSolution={!!exercise.solutionCode}
        current={currentIndex + 1}
        total={exercises.length}
      />

      {/* ── Sandpack Provider ────────────────────────────────────────── */}
      <SandpackProvider
        key={exercise.id}
        template="vanilla"
        theme="dark"
        files={{
          "index.html": exercise.starterCode,
          "styles.css":  "",
          "index.js":    "",
        }}
        options={{ activeFile: "index.html", recompileMode: "delayed", recompileDelay: 300 }}
      >
        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="ide-body" {...bodyEvents}>

          {/* Activity rail */}
          <ActivityRail active={activeTab} onToggle={toggleTab} />

          {/* Collapsible sidebar */}
          {activeTab && (
            <>
              <aside className="ide-sidebar">
                {activeTab === "task"   && <InstructionsPanel exercise={exercise} />}
                {activeTab === "files"  && <ExplorerPanel />}
                {activeTab === "checks" && <ValidationPanel exercise={exercise} onComplete={handleNext} />}
              </aside>
              <DragHandle direction="h" onPointerDown={sidebarResize.onPointerDown} />
            </>
          )}

          {/* Editor zone */}
          <div className={`ide-editor-zone ${layoutMode}`} {...editorZoneEvents}>

            {/* ── Monaco pane ──────────────────────────────────────── */}
            <div className="ide-monaco-pane">
              <MonacoEditorPane
                isShowingSolution={showSolution}
                solutionCode={exercise.solutionCode}
              />
            </div>

            {/* Editor / Preview split handle */}
            <DragHandle
              direction={layoutMode === "h" ? "h" : "v"}
              onPointerDown={editorResize.onPointerDown}
            />

            {/* ── Preview column ───────────────────────────────────── */}
            <div className="ide-preview-col">

              {/* Iframe preview */}
              <div className="ide-preview-wrap">
                <SandpackPreview
                  showOpenInCodeSandbox={false}
                  showRefreshButton={false}
                  style={{ height: "100%", minWidth: 0 }}
                />
              </div>

              {/* Console (optional) */}
              {showConsole && (
                <>
                  <DragHandle direction="v" onPointerDown={consoleResize.onPointerDown} />
                  <div className="ide-console-panel">
                    <div className="ide-panel-hdr">
                      <TerminalSquare size={13} />
                      Console
                    </div>
                    <div className="ide-console-body">
                      <SandpackConsole style={{ height: "100%" }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* end .ide-editor-zone */}

        </div>
        {/* end .ide-body */}
      </SandpackProvider>
    </div>
  );
}
