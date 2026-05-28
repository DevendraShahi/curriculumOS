"use client";

import { useMemo, useState } from "react";
import type { SandboxLesson, ValidationResult } from "@/lib/sandbox/types";
import { Sparkles } from "lucide-react";

type TaskPanelProps = {
  lesson: SandboxLesson;
  validationResults: ValidationResult[];
};

const EMPTY_HINTS: NonNullable<SandboxLesson["hints"]> = [];

export function TaskPanel({ lesson, validationResults }: TaskPanelProps) {
  const [revealedHintCount, setRevealedHintCount] = useState(0);
  const allHints = lesson.hints ?? EMPTY_HINTS;
  const visibleHints = useMemo(
    () => allHints.slice(0, revealedHintCount),
    [allHints, revealedHintCount]
  );
  const canRevealNextHint = revealedHintCount < allHints.length;

  function revealNextHint() {
    setRevealedHintCount((current) =>
      current < allHints.length ? current + 1 : current
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center border-b border-[var(--border)] px-6">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          Task
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6 text-sm text-[var(--muted)]">
        <h1 className="text-xl font-medium tracking-tight text-[var(--foreground)]">
          {lesson.title}
        </h1>

        <p className="mt-3 leading-relaxed text-[var(--muted)]">
          {lesson.description}
        </p>

        {lesson.goal && (
          <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Goal
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--foreground)]">
              {lesson.goal}
            </p>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Checklist
          </h3>
          <ul className="mt-3 space-y-3">
            {validationResults.map((result) => {
              const passed = result.passed;
              return (
                <li key={result.id} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                      passed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-[var(--border)] bg-[var(--surface-2)]"
                    }`}
                  >
                    {passed && (
                      <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3">
                        <path
                          d="M3 7.5L5.5 10L11 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`text-[13px] leading-snug ${
                      passed ? "text-[var(--muted-foreground)] line-through" : "text-[var(--foreground)]"
                    }`}
                  >
                    {result.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {allHints.length > 0 ? (
          <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Step Hints
            </h3>

            {visibleHints.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {visibleHints.map((hint, index) => (
                  <li
                    key={hint.id}
                    className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {hint.title?.trim() || `Hint ${index + 1}`}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--foreground)]">
                      {hint.content}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
                Hints are optional. Reveal them only when needed.
              </p>
            )}

            <button
              type="button"
              onClick={revealNextHint}
              disabled={!canRevealNextHint}
              className={[
                "mt-4 w-full rounded border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                canRevealNextHint
                  ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                  : "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] opacity-60",
              ].join(" ")}
            >
              {revealedHintCount === 0 ? "Show First Hint" : canRevealNextHint ? "Next Hint" : "All Hints Revealed"}
            </button>
          </div>
        ) : null}

        <button className="mt-8 flex w-full items-center justify-center gap-2 rounded border border-[var(--border)] bg-[var(--surface-2)] py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
          <Sparkles size={14} className="opacity-70" />
          Ask AI Hint
        </button>
      </div>
    </div>
  );
}
