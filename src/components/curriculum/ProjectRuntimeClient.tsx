"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type ProjectRuntimeData = {
  tenantId: string;
  course: {
    id: string;
    slug: string;
    title: string;
    category: string;
    level: "beginner" | "intermediate" | "advanced" | null;
  };
  project: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    bodyMarkdown: string;
    estimatedMinutes?: number;
    rubrics: Array<{
      id: string;
      slug: string;
      title: string;
      bodyMarkdown: string;
    }>;
  };
  viewer: {
    isAuthenticated: boolean;
    isEnrolled: boolean;
    enrollmentStatus: "active" | "paused" | "completed" | "dropped" | "not_enrolled";
  };
};

function formatDuration(minutes?: number) {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return "TBD";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function ProjectRuntimeClient({
  slug,
  projectId,
}: {
  slug: string;
  projectId: string;
}) {
  const [runtime, setRuntime] = useState<ProjectRuntimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/courses/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}`,
          { cache: "no-store" }
        );

        const payload = (await response.json()) as
          | { ok: true; data: ProjectRuntimeData }
          | { ok: false; error: string };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "INTERNAL_ERROR" : payload.error || "INTERNAL_ERROR");
        }

        if (cancelled) return;
        setRuntime(payload.data);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error) {
          if (loadError.message === "UNAUTHORIZED") {
            setError("Sign in to access this project.");
            return;
          }
          if (loadError.message === "ENROLLMENT_REQUIRED") {
            setError("Enroll in this course to access this project.");
            return;
          }
        }
        setError("Failed to load project runtime.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRuntime();

    return () => {
      cancelled = true;
    };
  }, [projectId, slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-4xl border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Loading project runtime...
        </div>
      </div>
    );
  }

  if (error || !runtime) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-4xl space-y-4 border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {error || "Project unavailable."}
          </p>
          <Link
            href={`/curriculum/${slug}`}
            className="inline-flex h-10 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]"
          >
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href={`/curriculum/${slug}`}
            className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)]"
            aria-label="Back to course"
          >
            ← BACK
          </Link>
          <div className="h-5 w-px bg-[var(--border)]" />
          <span className="truncate font-mono text-[11px] uppercase tracking-widest text-[var(--foreground)]">
            {runtime.course.title}
          </span>
          <div className="flex-1" />
          <span className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)]">
            PROJECT
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-px bg-[var(--border)]">
            <section className="bg-[var(--surface)] p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {runtime.project.title}
              </h1>
              {runtime.project.summary ? (
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {runtime.project.summary}
                </p>
              ) : null}
            </section>

            {runtime.project.bodyMarkdown && (
              <section className="bg-[var(--surface)] p-8">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Project Brief
                </h2>
                <div className="mt-5 text-sm leading-6 text-[var(--foreground)] prose prose-sm max-w-none">
                  {runtime.project.bodyMarkdown}
                </div>
              </section>
            )}

            {runtime.project.rubrics.length > 0 && (
              <section className="bg-[var(--surface)] p-8">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Evaluation Rubric
                </h2>
                <div className="mt-5 grid grid-cols-1 gap-px bg-[var(--border)]">
                  {runtime.project.rubrics.map((rubric) => (
                    <div key={rubric.id} className="bg-[var(--background)] p-6">
                      <h3 className="font-semibold text-[var(--foreground)]">{rubric.title}</h3>
                      <div className="mt-2 text-sm text-[var(--muted-foreground)] prose prose-sm max-w-none">
                        {rubric.bodyMarkdown}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-px bg-[var(--border)] lg:sticky lg:top-20 lg:self-start">
            <div className="bg-[var(--surface)] p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Time Estimate
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                {formatDuration(runtime.project.estimatedMinutes)}
              </p>
            </div>
            
            <div className="bg-[var(--surface)] p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Submission
              </p>
              <Button className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 rounded-none">
                SUBMIT PROJECT
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
