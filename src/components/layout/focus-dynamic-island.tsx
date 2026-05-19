"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFocus } from "@/app/focus/_context/focus-context";

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getFocusStateLabel(elapsedSeconds: number): string {
  if (elapsedSeconds < 12 * 60) return "Warming up";
  if (elapsedSeconds < 35 * 60) return "Deep focus";
  return "Peak zone";
}

function formatModeLabel(mode: string): string {
  return mode.replaceAll("_", " ");
}

export function FocusDynamicIsland() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentSession, pauseSession, resumeSession } = useFocus();
  const [expanded, setExpanded] = useState(false);

  const showIsland = Boolean(currentSession) && !pathname.startsWith("/focus");

  useEffect(() => {
    if (!currentSession) return;

    function onShortcut(event: KeyboardEvent) {
      if (event.key !== ".") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      router.push("/focus");
    }

    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [currentSession, router]);

  if (!showIsland || !currentSession) {
    return null;
  }

  const totalSeconds = Math.max(1, currentSession.durationMinutes * 60);
  const remainingSeconds = Math.max(
    0,
    totalSeconds - currentSession.actualDurationSeconds
  );
  const completionPercent = Math.max(
    0,
    Math.min(
      100,
      Math.round((currentSession.actualDurationSeconds / totalSeconds) * 100)
    )
  );
  const sessionStateLabel = getFocusStateLabel(currentSession.actualDurationSeconds);
  const sessionSubline = currentSession.expectedOutcome?.trim()
    ? currentSession.expectedOutcome
    : `${formatModeLabel(currentSession.goalType)} • ${sessionStateLabel}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[70] flex justify-center px-3 sm:top-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Focus session island"
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        className={`pointer-events-auto overflow-hidden border border-white/10 bg-black/95 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 ease-out ${
          expanded
            ? "w-full max-w-[29rem] rounded-[1.75rem]"
            : "w-[15.5rem] max-w-full rounded-full"
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              currentSession.isActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <p className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-white/90">
            {currentSession.taskName}
          </p>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] tabular-nums text-white">
            {formatTimer(remainingSeconds)}
          </p>
        </div>

        {expanded ? (
          <div className="border-t border-white/10 px-3 pb-3 pt-2">
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-white/70">
              {sessionSubline}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/60">
                {formatModeLabel(currentSession.goalType)} • {sessionStateLabel}
              </p>
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/60">
                {completionPercent}% complete
              </p>
            </div>
            <div className="mt-1.5 h-[2px] w-full rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (currentSession.isActive) {
                    pauseSession();
                  } else {
                    resumeSession();
                  }
                }}
                className="inline-flex h-7 items-center rounded-full border border-white/20 px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/10"
              >
                {currentSession.isActive ? "Pause" : "Resume"}
              </button>
              <Link
                href="/focus"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-7 items-center rounded-full bg-white px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-black"
              >
                Open Focus
              </Link>
              <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.16em] text-white/50">
                Cmd+.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
