"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, type ToastTone } from "@/components/ui/Toast";
import { LazyCodeBlock } from "@/components/curriculum/LazyCodeBlock";
import { MarkdownRenderer, stripRedundantPreamble } from "@/components/curriculum/MarkdownRenderer";
import { QuizSkeleton } from "@/components/curriculum/QuizSkeleton";
import { VideoPlayer } from "@/components/curriculum/VideoPlayer";
import { CompletionStatusCard } from "@/components/curriculum/CompletionStatusCard";
import { ResourceCard } from "@/components/curriculum/ResourceCard";
import { useTelemetry } from "@/hooks/use-telemetry";

type LessonRuntimeData = {
  course: {
    id: string;
    slug: string;
    title: string;
    category: string;
    level: "beginner" | "intermediate" | "advanced" | null;
  };
  module: {
    id: string;
    slug: string;
    title: string;
    order: number;
  } | null;
  lesson: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    contentType: "text" | "video" | "project" | "quiz";
    durationMinutes: number;
    isPreview: boolean;
    outcomes?: string[];
    prerequisites?: string[];
    learningObjectives: string[];
    instructions: string[];
    bodyMarkdown: string;
    videoUrl?: string;
    videoProvider?: string;
    starterFiles: Array<{ path: string; content: string }>;
    expectedOutput: string[];
    resources: {
      resourcePrompts: string[];
      learnerReference: string[];
      externalResources: Array<{
        id?: string;
        title?: string;
        url?: string;
        kind: "link" | "download" | "doc" | "repo" | "video";
        downloadable: boolean;
        fileName?: string;
        description?: string;
      }>;
    };
    linkedQuiz: {
      id: string;
      slug: string;
      title: string;
      questionCount: number;
    } | null;
    exercises?: Array<{
      id: string;
      type: string;
      task: string;
      instructions: string;
      starterCode: string;
      validationRules: unknown[];
    }>;
  };
  navigation: {
    position: number;
    totalLessons: number;
    previous: { id: string; slug: string; title: string } | null;
    next: { id: string; slug: string; title: string } | null;
  };
  viewer: {
    isAuthenticated: boolean;
    isEnrolled: boolean;
    enrollmentStatus: "active" | "paused" | "completed" | "dropped" | "not_enrolled";
    progress: {
      state: "not_started" | "in_progress" | "completed";
      progressPercent: number;
      timeSpentSeconds: number;
      updatedAt: string;
    } | null;
  };
};

function mapContentTypeLabel(value: LessonRuntimeData["lesson"]["contentType"]) {
  if (value === "project") return "Project";
  if (value === "video") return "Video";
  if (value === "quiz") return "Quiz";
  return "Text";
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "TBD";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function normalizeStarterFiles(
  value: unknown
): Array<{ path: string; content: string }> {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const path =
            typeof record.path === "string" && record.path.trim()
              ? record.path.trim()
              : `file-${index + 1}.txt`;
          const content =
            typeof record.content === "string"
              ? record.content
              : record.content == null
                ? ""
                : String(record.content);
          return { path, content };
        }

        if (typeof item === "string") {
          return { path: `file-${index + 1}.txt`, content: item };
        }

        return null;
      })
      .filter((item): item is { path: string; content: string } => Boolean(item));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([path, content]) => ({
      path,
      content: typeof content === "string" ? content : content == null ? "" : String(content),
    }));
  }

  if (typeof value === "string") {
    return [{ path: "starter.txt", content: value }];
  }

  return [];
}



export function LessonRuntimeClient({
  slug,
  lessonId,
}: {
  slug: string;
  lessonId: string;
}) {
  const [runtime, setRuntime] = useState<LessonRuntimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const { track } = useTelemetry();

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      setLoading(true);
      setError(null);
      setQuizLoading(true);

      try {
        const response = await fetch(
          `/api/v1/courses/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(lessonId)}`,
          { cache: "no-store" }
        );

        const payload = (await response.json()) as
          | { ok: true; data: LessonRuntimeData }
          | { ok: false; error: string };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "INTERNAL_ERROR" : payload.error || "INTERNAL_ERROR");
        }

        if (cancelled) return;

        const data = payload.data;

        // Basic payload validation
        if (!data.lesson?.title || !data.lesson?.slug) {
          setError("Lesson payload is malformed. Please refresh or contact support.");
          setRuntime(null);
          return;
        }

        setRuntime(data);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error) {
          if (loadError.message === "UNAUTHORIZED") {
            setError("Sign in to access this lesson.");
            return;
          }
          if (loadError.message === "ENROLLMENT_REQUIRED") {
            setError("Enroll in this course to access this lesson.");
            return;
          }
        }
        setError("Failed to load lesson runtime.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setTimeout(() => setQuizLoading(false), 350);
        }
      }
    }

    loadRuntime();

    return () => {
      cancelled = true;
    };
  }, [lessonId, slug]);

  const quizHref = useMemo(() => {
    if (!runtime?.lesson.linkedQuiz) return null;
    return `/curriculum/${slug}/quiz/${runtime.lesson.linkedQuiz.id}`;
  }, [runtime, slug]);

  const previousHref = runtime?.navigation.previous
    ? `/curriculum/${slug}/lesson/${runtime.navigation.previous.id}`
    : `/curriculum/${slug}`;
  const nextHref = runtime?.navigation.next
    ? `/curriculum/${slug}/lesson/${runtime.navigation.next.id}`
    : `/curriculum/${slug}`;

  function markComplete() {
    if (!runtime) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/progress`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            courseId: runtime.course.id,
            lessonId: runtime.lesson.id,
            moduleId: runtime.module?.id,
            state: "completed",
            progressPercent: 100,
          }),
        });

        const payload = (await response.json()) as
          | { ok: true; data: { progress: { state: string; progressPercent: number } } }
          | { ok: false; error: string };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "INTERNAL_ERROR" : payload.error || "INTERNAL_ERROR");
        }

        setRuntime((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            viewer: {
              ...prev.viewer,
              progress: {
                state: "completed",
                progressPercent: 100,
                timeSpentSeconds: prev.viewer.progress?.timeSpentSeconds ?? 0,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });

        setToast({ message: "Lesson marked complete", tone: "success" });
        track({
          name: "lesson_completed",
          properties: { lessonId: runtime.lesson.id, courseId: runtime.course.id },
        });
      } catch {
        setToast({ message: "Could not update progress", tone: "error" });
      }
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-4xl border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
          Loading lesson runtime...
        </div>
      </div>
    );
  }

  if (error || !runtime) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-4xl space-y-4 border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
            {error || "Lesson unavailable."}
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

  const isCompleted = runtime.viewer.progress?.state === "completed";
  const starterFiles = normalizeStarterFiles(runtime.lesson.starterFiles);
  const prerequisites = runtime.lesson.prerequisites ?? [];
  const outcomes = runtime.lesson.outcomes ?? [];

  const progressPercent = runtime.viewer.progress?.progressPercent ?? 0;
  const resources = runtime.lesson.resources;
  const internalResources: Array<{
    id: string;
    title: string;
    url: string;
    kind: "link" | "doc";
    description: string;
  }> = [];

  if (runtime.lesson.exercises && runtime.lesson.exercises.length > 0) {
    internalResources.push({
      id: "internal-exercise",
      title: "Interactive Exercise",
      url: `/curriculum/${slug}/lesson/${lessonId}/exercise`,
      kind: "link",
      description: "Open the lesson coding exercise workspace.",
    });
  }

  if (runtime.lesson.linkedQuiz && quizHref) {
    internalResources.push({
      id: "internal-quiz",
      title: runtime.lesson.linkedQuiz.title,
      url: quizHref,
      kind: "doc",
      description: "Open the linked lesson quiz.",
    });
  }

  const hasResourceBlock =
    resources.externalResources.length > 0 ||
    resources.learnerReference.length > 0 ||
    internalResources.length > 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null}

      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href={`/curriculum/${slug}`}
            className="shrink-0 font-mono text-sm text-[var(--muted-foreground)] hover:text-[var(--accent)]"
            aria-label="Back to course"
          >
            ←
          </Link>
          <div className="h-5 w-px bg-[var(--border)]" />
          <span className="truncate font-mono text-[11px] uppercase tracking-widest text-[var(--foreground)]">
            {runtime.course.title}
          </span>

          <div className="flex-1" />

          <div className="hidden h-1.5 w-24 overflow-hidden border border-[var(--border)] bg-[var(--surface-2)] sm:block">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {runtime.navigation.position}/{runtime.navigation.totalLessons}
          </span>

          <span className="border border-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">
            {mapContentTypeLabel(runtime.lesson.contentType)}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            {runtime.lesson.contentType === "video" && runtime.lesson.videoUrl ? (
              <section>
                <VideoPlayer url={runtime.lesson.videoUrl} provider={runtime.lesson.videoProvider} />
              </section>
            ) : null}

            <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                {runtime.lesson.title}
              </h1>
              {runtime.lesson.summary ? (
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {runtime.lesson.summary}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  {mapContentTypeLabel(runtime.lesson.contentType)}
                </span>
                <span className="border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  {formatDuration(runtime.lesson.durationMinutes)}
                </span>
                {runtime.lesson.isPreview ? (
                  <span className="border border-emerald-500/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-emerald-500">
                    Preview Lesson
                  </span>
                ) : null}
              </div>
              {runtime.module ? (
                <p className="mt-4 border-t border-[var(--border)] pt-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Module {runtime.module.order}: {runtime.module.title}
                </p>
              ) : null}
            </section>

            {runtime.lesson.learningObjectives.length > 0 ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Learning Objectives
                </h2>
                <ul className="mt-5 space-y-3">
                  {runtime.lesson.learningObjectives.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--foreground)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {prerequisites.length > 0 ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Prerequisites
                </h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--foreground)]">
                  {prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {outcomes.length > 0 ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Outcomes
                </h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--foreground)]">
                  {outcomes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {runtime.lesson.instructions.length > 0 ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Instructions
                </h2>
                <ol className="mt-5 space-y-4">
                  {runtime.lesson.instructions.map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-4 text-sm leading-6 text-[var(--foreground)]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--border)] font-mono text-[10px] text-[var(--muted-foreground)]">
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {runtime.lesson.contentType !== "video" && runtime.lesson.bodyMarkdown ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Lesson Notes
                </h2>
                <MarkdownRenderer
                  className="mt-5 text-[var(--foreground)]"
                  markdown={stripRedundantPreamble(
                    runtime.lesson.bodyMarkdown,
                    runtime.lesson.title,
                    runtime.lesson.summary ?? ""
                  )}
                />
              </section>
            ) : null}

            {runtime.lesson.contentType === "video" && runtime.lesson.bodyMarkdown ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Notes &amp; Transcript
                </h2>
                <MarkdownRenderer
                  className="mt-5 text-sm leading-6 text-[var(--foreground)]"
                  markdown={stripRedundantPreamble(
                    runtime.lesson.bodyMarkdown,
                    runtime.lesson.title,
                    runtime.lesson.summary ?? ""
                  )}
                />
              </section>
            ) : null}

            {starterFiles.length > 0 ? (
              <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                    Starter Files
                  </h2>
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    {starterFiles.length} {starterFiles.length === 1 ? "file" : "files"}
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  {starterFiles.map((file) => (
                    <div key={file.path}>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                        {file.path}
                      </p>
                      <LazyCodeBlock code={file.content} language="txt" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="border border-[var(--border)] bg-[var(--surface)] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
                  Lesson Resources
                </h2>

                {!hasResourceBlock ? (
                  <p className="mt-4 text-sm text-[var(--muted-foreground)]">
                    No downloadable or navigable resources are attached to this lesson yet.
                  </p>
                ) : null}

                <div className="mt-5 space-y-6 text-sm text-[var(--foreground)]">
                  {resources.externalResources.length > 0 ? (
                    <div>
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                        Open or Download
                      </h3>
                      <ul className="mt-2 space-y-3">
                        {resources.externalResources.map((item, index) => (
                          <ResourceCard
                            key={`${item.url ?? item.title ?? "resource"}-${index}`}
                            title={item.title}
                            url={item.url}
                            kind={item.kind}
                            downloadable={item.downloadable}
                            fileName={item.fileName}
                            description={item.description}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {internalResources.length > 0 ? (
                    <div>
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                        Lesson Links
                      </h3>
                      <ul className="mt-2 space-y-3">
                        {internalResources.map((item) => (
                          <ResourceCard
                            key={item.id}
                            title={item.title}
                            url={item.url}
                            kind={item.kind}
                            description={item.description}
                            isInternal
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {resources.learnerReference.length > 0 ? (
                    <div>
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                        Notes
                      </h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {resources.learnerReference.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border)] bg-[var(--surface)] p-6">
              <Link href={previousHref}>
                <Button variant="secondary">← Previous</Button>
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                {runtime.lesson.exercises && runtime.lesson.exercises.length > 0 ? (
                  <Link href={`/curriculum/${slug}/lesson/${lessonId}/exercise`}>
                    <Button className="bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 rounded-none">
                      Interactive Exercise
                    </Button>
                  </Link>
                ) : null}
                <Link href={nextHref}>
                  <Button variant="secondary">Next →</Button>
                </Link>
                <Button onClick={markComplete} loading={isPending}>
                  {isCompleted ? "✓ Completed" : "Mark Complete"}
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {runtime.module ? (
              <div className="border border-[var(--border)] bg-[var(--surface)] p-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Module {runtime.module.order}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  {runtime.module.title}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            ) : null}

            <div className="border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Lesson {runtime.navigation.position} of {runtime.navigation.totalLessons}
              </p>
              {runtime.navigation.previous ? (
                <Link
                  href={previousHref}
                  className="mt-3 flex items-center gap-2 border border-[var(--border)] p-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                >
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">↑</span>
                  <span className="truncate">{runtime.navigation.previous.title}</span>
                </Link>
              ) : null}
              {runtime.navigation.next ? (
                <Link
                  href={nextHref}
                  className="mt-2 flex items-center gap-2 border border-[var(--border)] p-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                >
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">↓</span>
                  <span className="truncate">{runtime.navigation.next.title}</span>
                </Link>
              ) : null}
            </div>

            <div className="border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="border-b border-[var(--border)] pb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Expected Output
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {runtime.lesson.expectedOutput.length > 0 ? (
                  runtime.lesson.expectedOutput.map((line) => (
                    <label key={line} className="flex cursor-pointer items-start gap-3 text-sm text-[var(--foreground)]">
                      <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 border border-[var(--border)] bg-transparent accent-[var(--accent)]" />
                      {line}
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)]">No expected output checklist yet.</p>
                )}
              </div>
            </div>

            <div className="border border-[var(--border)] bg-[var(--surface)] p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Linked Quiz
              </span>
              {quizLoading ? (
                <QuizSkeleton />
              ) : runtime.lesson.linkedQuiz && quizHref ? (
                <div className="mt-3">
                  <p className="text-sm text-[var(--foreground)]">
                    {runtime.lesson.linkedQuiz.title}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-[var(--muted-foreground)]">
                    {runtime.lesson.linkedQuiz.questionCount} questions
                  </p>
                  <Link href={quizHref} className="mt-4 block w-full">
                    <Button variant="secondary" className="w-full">Start Quiz</Button>
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted-foreground)]">No linked quiz for this lesson.</p>
              )}
            </div>

            <CompletionStatusCard
              state={runtime.viewer.progress?.state ?? "not_started"}
              progressPercent={progressPercent}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
