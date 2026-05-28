export function CompletionStatusCard({
  state,
  progressPercent,
}: {
  state: string;
  progressPercent: number;
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] p-6">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
        Completion Status
      </h3>
      <p className="mt-3 text-sm text-[var(--foreground)]">
        State:{" "}
        <span className="font-semibold">{state}</span>
      </p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Progress: {progressPercent}%
      </p>
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Finish exercise + quiz, then use &ldquo;Mark Complete&rdquo; to finalize this lesson.
      </p>
    </div>
  );
}
