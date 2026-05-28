"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type CapstoneRuntimeData = {
  tenantId: string;
  course: {
    id: string;
    slug: string;
    title: string;
    category: string;
    level: "beginner" | "intermediate" | "advanced" | null;
  };
  capstone: {
    id: string;
    slug: string;
    title: string;
    bodyMarkdown: string;
  };
  viewer: {
    isAuthenticated: boolean;
    isEnrolled: boolean;
    enrollmentStatus: "active" | "paused" | "completed" | "dropped" | "not_enrolled";
  };
};

export function CapstoneRuntimeClient({
  slug,
  capstoneId,
}: {
  slug: string;
  capstoneId: string;
}) {
  const [runtime, setRuntime] = useState<CapstoneRuntimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/courses/${encodeURIComponent(slug)}/capstones/${encodeURIComponent(capstoneId)}`,
          { cache: "no-store" }
        );

        const payload = (await response.json()) as
          | { ok: true; data: CapstoneRuntimeData }
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
            setError("Sign in to access this capstone.");
            return;
          }
          if (loadError.message === "ENROLLMENT_REQUIRED") {
            setError("Enroll in this course to access this capstone.");
            return;
          }
        }
        setError("Failed to load capstone runtime.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRuntime();

    return () => {
      cancelled = true;
    };
  }, [capstoneId, slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-4xl border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Loading capstone runtime...
        </div>
      </div>
    );
  }

  if (error || !runtime) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-4xl space-y-4 border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {error || "Capstone unavailable."}
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
            CAPSTONE
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-px bg-[var(--border)]">
            <section className="bg-[var(--surface)] p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {runtime.capstone.title}
              </h1>
            </section>

            {runtime.capstone.bodyMarkdown && (
              <section className="bg-[var(--surface)] p-8">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Capstone Brief
                </h2>
                <div className="mt-5 text-sm leading-6 text-[var(--foreground)] prose prose-sm max-w-none">
                  {runtime.capstone.bodyMarkdown}
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-px bg-[var(--border)] lg:sticky lg:top-20 lg:self-start">
            <div className="bg-[var(--surface)] p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Final Submission
              </p>
              <Button className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 rounded-none">
                SUBMIT CAPSTONE
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
