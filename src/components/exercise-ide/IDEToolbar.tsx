/** IDEToolbar — top bar with layout & tool controls */
"use client";

import { ChevronLeft, Columns2, Rows2, TerminalSquare, Eye } from "lucide-react";

interface IDEToolbarProps {
  returnHref: string;
  layoutMode: "h" | "v";
  onLayoutMode: (m: "h" | "v") => void;
  showConsole: boolean;
  onToggleConsole: () => void;
  showSolution: boolean;
  onToggleSolution: () => void;
  hasSolution: boolean;
  current: number;
  total: number;
}

export function IDEToolbar({
  returnHref,
  layoutMode,
  onLayoutMode,
  showConsole,
  onToggleConsole,
  showSolution,
  onToggleSolution,
  hasSolution,
  current,
  total,
}: IDEToolbarProps) {
  return (
    <div className="ide-toolbar">
      <div className="ide-toolbar-left">
        <a href={returnHref} className="ide-back-btn" title="Back to lesson">
          <ChevronLeft size={16} />
        </a>
        <div className="ide-divider" />

        <button
          className={`ide-tool-btn ${layoutMode === "h" ? "on" : ""}`}
          onClick={() => onLayoutMode("h")}
          title="Side by side"
        >
          <Columns2 />
          <span className="hidden sm:inline">Side</span>
        </button>
        <button
          className={`ide-tool-btn ${layoutMode === "v" ? "on" : ""}`}
          onClick={() => onLayoutMode("v")}
          title="Stacked"
        >
          <Rows2 />
          <span className="hidden sm:inline">Stack</span>
        </button>

        <div className="ide-divider" />

        <button
          className={`ide-tool-btn ${showConsole ? "on" : ""}`}
          onClick={onToggleConsole}
          title="Toggle console"
        >
          <TerminalSquare />
          <span className="hidden sm:inline">Console</span>
        </button>

        {hasSolution && (
          <>
            <div className="ide-divider" />
            <button
              className={`ide-tool-btn ${showSolution ? "on-v" : ""}`}
              onClick={onToggleSolution}
              title="Show diff vs solution"
            >
              <Eye />
              <span className="hidden sm:inline">Solution</span>
            </button>
          </>
        )}
      </div>

      <div className="ide-toolbar-right">
        <span className="ide-counter">{current} / {total}</span>
      </div>
    </div>
  );
}
