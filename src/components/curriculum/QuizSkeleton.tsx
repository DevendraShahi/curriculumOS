"use client";

export function QuizSkeleton() {
  return (
    <div
      aria-hidden
      className="mt-4 border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="h-3 w-28 animate-pulse bg-[var(--surface-2)]" />
      <div className="mt-3 h-4 w-2/3 animate-pulse bg-[var(--surface-2)]" />
      <div className="mt-2 h-4 w-1/2 animate-pulse bg-[var(--surface-2)]" />
    </div>
  );
}
