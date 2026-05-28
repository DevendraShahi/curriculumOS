"use client";

import type { SandboxProblem, ValidationResult, SandboxSaveStatus } from "@/lib/sandbox/types";

export type BottomTab = "problems" | "tests" | "console";

type BottomPanelProps = {
  problems: SandboxProblem[];
  validationResults: ValidationResult[];
  saveStatus: SandboxSaveStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
};

export function BottomPanel({
  problems,
  validationResults,
  saveStatus,
  open,
  onOpenChange,
  activeTab,
  onTabChange,
}: BottomPanelProps) {

  const passedCount = validationResults.filter((item) => item.passed).length;

  function getSaveLabel(status: SandboxSaveStatus) {
    switch (status) {
      case "dirty":
        return "Unsaved changes";
      case "saving":
        return "Saving...";
      case "saved":
        return "Saved just now";
      case "error":
        return "Save failed";
      default:
        return "Ready";
    }
  }

  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="flex h-9 items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-4 font-mono tracking-widest uppercase">
          <button
            onClick={() => {
              onTabChange("problems");
              onOpenChange(activeTab === "problems" ? !open : true);
            }}
            className="flex h-9 items-center gap-2 px-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span className={problems.length > 0 ? "text-red-500" : "text-emerald-500"}>
              ●
            </span>
            Problems: {problems.length}
          </button>

          <button
            onClick={() => {
              onTabChange("tests");
              onOpenChange(activeTab === "tests" ? !open : true);
            }}
            className="flex h-9 items-center gap-2 px-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <span className="text-blue-500">●</span>
            Tests: {passedCount}/{validationResults.length} passing
          </button>

          <button
            onClick={() => {
              onTabChange("console");
              onOpenChange(activeTab === "console" ? !open : true);
            }}
            className="flex h-9 items-center px-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Console
          </button>
        </div>

        <div className="flex items-center gap-2 text-[var(--muted-foreground)] font-mono tracking-widest uppercase text-[10px]">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              saveStatus === "error"
                ? "bg-red-500"
                : saveStatus === "saving" || saveStatus === "dirty"
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            ].join(" ")}
          />
          <span>{getSaveLabel(saveStatus)}</span>
        </div>
      </div>

      {open ? (
        <div className="h-56 border-t border-[var(--border)] bg-[var(--surface-2)]">
          {activeTab === "problems" ? (
            <ProblemsPanel problems={problems} />
          ) : null}

          {activeTab === "tests" ? (
            <TestsPanel validationResults={validationResults} />
          ) : null}

          {activeTab === "console" ? (
            <ConsolePanel />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ProblemsPanel({ problems }: { problems: SandboxProblem[] }) {
  if (problems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)] font-mono uppercase tracking-widest">
        No problems detected.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3">
      <div className="space-y-2">
        {problems.map((problem) => (
          <div
            key={problem.id}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={
                    problem.severity === "error"
                      ? "text-red-500"
                      : problem.severity === "warning"
                        ? "text-amber-500"
                        : "text-blue-500"
                  }
                >
                  ●
                </span>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {problem.title}
                </p>
              </div>

              <span className="rounded bg-[var(--surface-2)] px-2 py-1 text-[11px] uppercase tracking-widest font-mono text-[var(--muted-foreground)]">
                {problem.source}
              </span>
            </div>

            {problem.message ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{problem.message}</p>
            ) : null}

            {problem.line ? (
              <p className="mt-2 text-xs font-mono tracking-widest text-[var(--muted-foreground)] uppercase">
                Line {problem.line}
                {problem.column ? `, Column ${problem.column}` : ""}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestsPanel({
  validationResults,
}: {
  validationResults: ValidationResult[];
}) {
  return (
    <div className="h-full overflow-auto p-3">
      <div className="space-y-2">
        {validationResults.map((result) => (
          <div
            key={result.id}
            className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm"
          >
            <span className={result.passed ? "text-emerald-500" : "text-[var(--muted-foreground)]"}>
              {result.passed ? "✓" : "○"}
            </span>
            <p className="text-sm text-[var(--foreground)]">{result.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsolePanel() {
  return (
    <div className="h-full p-3 font-mono text-xs text-[var(--muted-foreground)] uppercase tracking-widest flex items-center justify-center">
      Console output will appear here.
    </div>
  );
}
