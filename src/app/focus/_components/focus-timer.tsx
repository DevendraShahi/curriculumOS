"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useFocus } from "@/app/focus/_context/focus-context";
import {
  TIMER_PRESETS,
  FOCUS_MODES,
  AMBIENT_SOUNDS,
  DESIGN_TOKENS,
} from "@/types/focus";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// SVG Icons as components
function IconCode({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconBug({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function IconZap({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconVolumeOff({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function IconCloudRain({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M16 14v6" />
      <path d="M8 14v6" />
      <path d="M12 16v6" />
    </svg>
  );
}

function IconCoffee({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function IconKeyboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M6 8h.001" />
      <path d="M10 8h.001" />
      <path d="M14 8h.001" />
      <path d="M18 8h.001" />
      <path d="M6 12h.001" />
      <path d="M10 12h.001" />
      <path d="M14 12h.001" />
      <path d="M18 12h.001" />
      <path d="M7 16h10" />
    </svg>
  );
}

function IconBookOpen({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7v14" />
      <path d="M16 12h1a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4h-1" />
      <path d="M3 2v16a2 2 0 0 0 2 2h5" />
      <path d="M8 2a4 4 0 0 1 4 4v12a2 2 0 0 1-2 2H3" />
    </svg>
  );
}

function IconWaves({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function IconStop({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconFlame({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

const modeIcons: Record<string, React.FC<{ className?: string }>> = {
  code: IconCode,
  book: IconBook,
  refresh: IconRefresh,
  bug: IconBug,
  sparkles: IconSparkles,
  zap: IconZap,
};

const soundIcons: Record<string, React.FC<{ className?: string }>> = {
  "volume-off": IconVolumeOff,
  "cloud-rain": IconCloudRain,
  coffee: IconCoffee,
  keyboard: IconKeyboard,
  "book-open": IconBookOpen,
  waves: IconWaves,
};

export function FocusTimer() {
  const {
    currentSession,
    history,
    currentMode,
    ambientSound,
    startSession,
    endSession,
    toggleChecklistItem,
    pauseSession,
    resumeSession,
    incrementDistraction,
    setCurrentMode,
    setAmbientSound,
    totalFocusMinutes,
    weekStreak,
    deleteSession,
  } = useFocus();

  const [selectedDuration, setSelectedDuration] = useState(25);
  const [sessionGoal, setSessionGoal] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const modeConfig = FOCUS_MODES.find(m => m.id === currentMode) || FOCUS_MODES[0];
  const ModeIcon = modeIcons[modeConfig.icon] || IconCode;

  const elapsedSeconds = currentSession ? currentSession.actualDurationSeconds : 0;
  const totalSeconds = currentSession ? currentSession.durationMinutes * 60 : selectedDuration * 60;
  const displayTimeLeft = currentSession
    ? Math.max(0, totalSeconds - elapsedSeconds)
    : selectedDuration * 60;

  useEffect(() => {
    if (!currentSession) return;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        incrementDistraction();
      }
    }

    function onBlur() {
      incrementDistraction();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [currentSession, incrementDistraction]);

  const handleStart = useCallback(() => {
    if (!sessionGoal.trim()) return;
    const checklistItems = checklistInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    startSession(
      sessionGoal,
      currentMode,
      expectedOutcome,
      selectedDuration,
      checklistItems
    );
    setShowSettings(false);
    setShowHistory(false);
  }, [
    sessionGoal,
    checklistInput,
    selectedDuration,
    currentMode,
    expectedOutcome,
    startSession,
  ]);

  const handlePause = useCallback(() => pauseSession(), [pauseSession]);
  const handleResume = useCallback(() => resumeSession(), [resumeSession]);
  const handleEnd = useCallback(() => {
    endSession(displayTimeLeft === 0);
  }, [displayTimeLeft, endSession]);

  const progress = currentSession
    ? (elapsedSeconds / totalSeconds) * 100
    : ((selectedDuration * 60 - displayTimeLeft) / (selectedDuration * 60)) * 100;

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isActive = Boolean(currentSession?.isActive);
  const checklist = currentSession?.checklist ?? [];
  const completedChecklistCount = checklist.filter((item) => item.completed).length;
  const currentChecklistItem =
    checklist.find((item) => !item.completed) ?? checklist[checklist.length - 1] ?? null;
  const cognitiveStatus =
    elapsedSeconds < 12 * 60
      ? "WARMING UP"
      : elapsedSeconds < 35 * 60
        ? "DEEP FOCUS"
        : "PEAK ZONE";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: modeConfig.bg,
        color: modeConfig.text,
        transition: `background-color ${DESIGN_TOKENS.motion.slow} ${DESIGN_TOKENS.motion.easeInOut}`,
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-none"
        style={{
          backgroundColor: modeConfig.surface,
          borderColor: modeConfig.border,
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
            style={{ color: modeConfig.textMuted }}
          >
            <IconArrowLeft className="transition-transform" />
            <span className="hidden sm:inline">Back to dashboard</span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Stats pills */}
            <div className="hidden sm:flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
                style={{
                  backgroundColor: modeConfig.accentGlow,
                  color: modeConfig.accent,
                }}
              >
                <IconFlame />
                <span>{weekStreak} day streak</span>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
                style={{
                  backgroundColor: DESIGN_TOKENS.colors.accentSubtle,
                  color: modeConfig.textMuted,
                }}
              >
                <IconClock />
                <span>{formatDuration(totalFocusMinutes)} total</span>
              </div>
            </div>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-none p-2 transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: modeConfig.textMuted }}
              aria-label="Toggle settings"
            >
              <ModeIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          {/* Session Setup */}
          {!currentSession && (
            <div className="space-y-6">
              {/* Title */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Focus Session
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textMuted }}>
                  What are you working on?
                </p>
              </div>

              {/* Input Card */}
              <div
                className="rounded-none border p-5 space-y-4"
                style={{
                  backgroundColor: modeConfig.surface,
                  borderColor: modeConfig.border,
                }}
              >
                <div>
                  <label
                    htmlFor="task-name"
                    className="mb-2 block font-mono text-[10px] uppercase tracking-widest"
                    style={{ color: modeConfig.textFaint }}
                  >
                    Task
                  </label>
                  <input
                    id="task-name"
                    type="text"
                    value={sessionGoal}
                    onChange={(e) => setSessionGoal(e.target.value)}
                    placeholder="e.g., Build auth middleware"
                    className="w-full rounded-none border px-4 py-3 text-sm outline-none transition-all focus:ring-1"
                    style={{
                      backgroundColor: modeConfig.bg,
                      borderColor: modeConfig.border,
                      color: modeConfig.text,
                      ["--tw-ring-color" as string]: modeConfig.accent,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sessionGoal.trim()) handleStart();
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="expected-outcome"
                    className="mb-2 block font-mono text-[10px] uppercase tracking-widest"
                    style={{ color: modeConfig.textFaint }}
                  >
                    Expected outcome
                  </label>
                  <input
                    id="expected-outcome"
                    type="text"
                    value={expectedOutcome}
                    onChange={(e) => setExpectedOutcome(e.target.value)}
                    placeholder="e.g., Redirects unauthorized users"
                    className="w-full rounded-none border px-4 py-3 text-sm outline-none transition-all focus:ring-1"
                    style={{
                      backgroundColor: modeConfig.bg,
                      borderColor: modeConfig.border,
                      color: modeConfig.text,
                      ["--tw-ring-color" as string]: modeConfig.accent,
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="task-breakdown"
                    className="mb-2 block font-mono text-[10px] uppercase tracking-widest"
                    style={{ color: modeConfig.textFaint }}
                  >
                    Task breakdown (one line each)
                  </label>
                  <textarea
                    id="task-breakdown"
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    placeholder={"Setup API route\nBuild middleware\nTest redirects\nHandle edge cases"}
                    rows={4}
                    className="w-full rounded-none border px-4 py-3 text-sm outline-none transition-all focus:ring-1"
                    style={{
                      backgroundColor: modeConfig.bg,
                      borderColor: modeConfig.border,
                      color: modeConfig.text,
                      ["--tw-ring-color" as string]: modeConfig.accent,
                    }}
                  />
                </div>
              </div>

              {/* Duration Presets */}
              <div>
                <label className="mb-3 block font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textFaint }}>
                  Duration
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {TIMER_PRESETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      onClick={() => setSelectedDuration(preset.minutes)}
                      className="rounded-none border py-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
                      style={{
                        backgroundColor: selectedDuration === preset.minutes ? modeConfig.accent : modeConfig.surface,
                        borderColor: selectedDuration === preset.minutes ? modeConfig.accent : modeConfig.border,
                        color: selectedDuration === preset.minutes ? "#fff" : modeConfig.textMuted,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={!sessionGoal.trim()}
                className="group flex w-full items-center justify-center gap-2 rounded-none py-4 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 hover:opacity-90"
                style={{
                  backgroundColor: modeConfig.accent,
                  color: "#fff",
                }}
              >
                <IconPlay className="transition-transform" />
                Start {selectedDuration} minute session
              </button>
            </div>
          )}

          {/* Active Session */}
          {currentSession && (
            <div className="space-y-8">
              {/* Session Info */}
              <div className="text-center space-y-1">
                <div
                  className="mx-auto mb-3 inline-flex items-center gap-2 rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
                  style={{
                    backgroundColor: modeConfig.accentGlow,
                    color: modeConfig.accent,
                  }}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-none", isActive && "animate-pulse")} style={{ backgroundColor: modeConfig.accent }} />
                  {isActive ? "In progress" : "Paused"}
                </div>
                <h2 className="text-xl font-semibold tracking-tight">{currentSession.taskName}</h2>
                {currentSession.expectedOutcome && (
                  <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textMuted }}>
                    {currentSession.expectedOutcome}
                  </p>
                )}
                <div className="mt-2 inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {currentSession.goalType.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">
                    {cognitiveStatus}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {currentSession.distractionCount} distractions
                  </span>
                </div>
              </div>

              {/* Timer Ring */}
              <div className="flex justify-center">
                <div className="relative">
                  <svg width="280" height="280" className="relative -rotate-90">
                    {/* Track */}
                    <circle
                      cx="140"
                      cy="140"
                      r={radius}
                      fill="none"
                      stroke={modeConfig.border}
                      strokeWidth="4"
                    />
                    {/* Progress */}
                    <circle
                      cx="140"
                      cy="140"
                      r={radius}
                      fill="none"
                      stroke={modeConfig.accent}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-1000"
                      style={{
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </svg>

                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="font-mono text-5xl font-light tracking-tight tabular-nums sm:text-6xl"
                      style={{ color: modeConfig.text }}
                    >
                      {formatTime(displayTimeLeft)}
                    </span>
                    <span className="mt-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textFaint }}>
                      {modeConfig.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleEnd}
                  className="rounded-none border p-4 transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    borderColor: modeConfig.border,
                    color: modeConfig.textMuted,
                  }}
                  aria-label="End session"
                >
                  <IconStop />
                </button>

                {isActive ? (
                  <button
                    onClick={handlePause}
                    className="rounded-none border px-8 py-4 font-mono text-[10px] uppercase tracking-widest transition-colors"
                    style={{
                      backgroundColor: modeConfig.surface,
                      borderColor: modeConfig.border,
                      color: modeConfig.text,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <IconPause />
                      Pause
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="rounded-none px-8 py-4 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: modeConfig.accent,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <IconPlay />
                      Resume
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="rounded-none border p-4 transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    borderColor: modeConfig.border,
                    color: modeConfig.textMuted,
                  }}
                  aria-label="View history"
                >
                  <IconClock />
                </button>
              </div>

              {checklist.length > 0 ? (
                <section className="border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      Mission Steps
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">
                      {completedChecklistCount}/{checklist.length}
                    </p>
                  </div>

                  {currentChecklistItem ? (
                    <div className="mb-3 border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                        Current
                      </p>
                      <p className="mt-1 text-sm text-[var(--foreground)]">
                        {currentChecklistItem.text}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleChecklistItem(item.id)}
                        className="flex w-full items-center gap-2 border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                      >
                        <span
                          className="h-3 w-3 border border-[var(--border)]"
                          style={{
                            backgroundColor: item.completed
                              ? "var(--accent)"
                              : "transparent",
                          }}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            item.completed && "text-[var(--muted-foreground)] line-through"
                          )}
                        >
                          {item.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}

          {/* History Panel */}
          {showHistory && !currentSession && history.length > 0 && (
            <div
              className="mt-8 rounded-none border"
              style={{
                backgroundColor: modeConfig.surface,
                borderColor: modeConfig.border,
              }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: modeConfig.border }}>
                <h3 className="font-mono text-[10px] uppercase tracking-widest">Session History</h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-none p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: modeConfig.textMuted }}
                  aria-label="Close history"
                >
                  <IconX />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {history.slice(0, 10).map((session) => {
                  const SessionIcon = modeIcons[FOCUS_MODES.find(m => m.id === session.goalType)?.icon || "code"];
                  const sessionMode = FOCUS_MODES.find(m => m.id === session.goalType);
                  return (
                    <div key={session.id} className="flex items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: modeConfig.border }}>
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
                        style={{
                          backgroundColor: sessionMode?.accentGlow || DESIGN_TOKENS.colors.accentSubtle,
                          color: sessionMode?.accent || modeConfig.accent,
                        }}
                      >
                        <SessionIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{session.taskName}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textFaint }}>
                          {formatDuration(session.durationMinutes)} · {getTimeAgo(session.startedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.completed ? (
                          <span
                            className="flex items-center gap-1 rounded-none px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                            style={{
                              backgroundColor: DESIGN_TOKENS.colors.successLight,
                              color: DESIGN_TOKENS.colors.success,
                            }}
                          >
                            <IconCheck />
                            Done
                          </span>
                        ) : (
                          <span
                            className="rounded-none px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                            style={{
                              backgroundColor: DESIGN_TOKENS.colors.warningLight,
                              color: DESIGN_TOKENS.colors.warning,
                            }}
                          >
                            Partial
                          </span>
                        )}
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="rounded-none p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                          style={{ color: modeConfig.textFaint }}
                          aria-label="Delete session"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && !currentSession && (
            <div className="mt-8 space-y-6">
              {/* Focus Mode */}
              <div>
                <label className="mb-3 block font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textFaint }}>
                  Focus Mode
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FOCUS_MODES.map((mode) => {
                    const Icon = modeIcons[mode.icon] || IconCode;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setCurrentMode(mode.id)}
                        className="rounded-none border p-3 text-left transition-colors"
                        style={{
                          backgroundColor: currentMode === mode.id ? mode.surface : modeConfig.surface,
                          borderColor: currentMode === mode.id ? mode.accent : modeConfig.border,
                        }}
                      >
                        <div className="mb-2" style={{ color: currentMode === mode.id ? mode.accent : modeConfig.textMuted }}>
                          <Icon />
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: currentMode === mode.id ? mode.text : modeConfig.text }}>
                          {mode.label}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: currentMode === mode.id ? mode.textMuted : modeConfig.textFaint }}>
                          {mode.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ambient Sound */}
              <div>
                <label className="mb-3 block font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textFaint }}>
                  Ambient Sound
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {AMBIENT_SOUNDS.map((sound) => {
                    const SoundIcon = soundIcons[sound.icon] || IconVolumeOff;
                    return (
                      <button
                        key={sound.id}
                        onClick={() => setAmbientSound(sound.id)}
                        className="flex flex-col items-center gap-2 rounded-none border py-3 transition-colors"
                        style={{
                          backgroundColor: ambientSound === sound.id ? modeConfig.accent : modeConfig.surface,
                          borderColor: ambientSound === sound.id ? modeConfig.accent : modeConfig.border,
                          color: ambientSound === sound.id ? "#fff" : modeConfig.textMuted,
                        }}
                      >
                        <SoundIcon />
                        <span className="font-mono text-[10px] uppercase tracking-widest">{sound.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: modeConfig.textFaint }}>
          Stay focused · Build the habit
        </p>
      </footer>
    </div>
  );
}
