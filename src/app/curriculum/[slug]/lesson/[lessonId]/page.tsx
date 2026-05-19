import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getLessonRuntime } from "@/lib/services/lesson-runtime-service";
import { upsertCurrentActorLessonProgress } from "@/lib/services/learning-service";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";

type LessonPageParams = {
  slug: string;
  lessonId: string;
};

function mapContentTypeLabel(value: "text" | "video" | "project" | "quiz"): string {
  if (value === "video") return "Video Lesson";
  if (value === "project") return "Project Lab";
  if (value === "quiz") return "Knowledge Check";
  return "Core Concept";
}

function parseLessonBody(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("##") && !line.startsWith("###") && !line.startsWith("- "));
}

async function resolveViewerActor(): Promise<ActorContext | null> {
  try {
    return await requireActorContext();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return null;
    }
    throw error;
  }
}

export default async function LessonPage({ params }: { params: Promise<LessonPageParams> }) {
  const { slug, lessonId } = await params;
  const authState = await auth();
  const actor = await resolveViewerActor();
  const tenantId = actor?.tenantId ?? resolveTenantId(authState.orgId);

  let runtime: Awaited<ReturnType<typeof getLessonRuntime>>;
  try {
    runtime = await getLessonRuntime({
      tenantId,
      courseIdOrSlug: slug,
      lessonIdOrSlug: lessonId,
      actor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "UNAUTHORIZED") {
      redirect(`/sign-in?redirect_url=${encodeURIComponent(`/curriculum/${slug}/lesson/${lessonId}`)}`);
    }

    if (message === "ENROLLMENT_REQUIRED") {
      redirect(`/curriculum/${slug}`);
    }

    if (message === "COURSE_NOT_FOUND" || message === "LESSON_NOT_FOUND") {
      notFound();
    }

    throw error;
  }

  const starterFile = runtime.lesson.starterFiles[0] ?? null;
  const codeLines = (starterFile?.content ?? "// Starter file unavailable").split("\n");
  const lessonBodyParagraphs = parseLessonBody(runtime.lesson.bodyMarkdown);
  const progressPositionPercent = Math.max(
    0,
    Math.min(100, Math.round((runtime.navigation.position / runtime.navigation.totalLessons) * 100))
  );

  const previousHref = runtime.navigation.previous
    ? `/curriculum/${slug}/lesson/${runtime.navigation.previous.id}`
    : null;
  const quizHref = runtime.lesson.linkedQuiz
    ? `/curriculum/${slug}/quiz/${runtime.lesson.linkedQuiz.id}`
    : null;

  const isCompleted = runtime.viewer.progress?.state === "completed";

  async function markCompleteAction() {
    "use server";

    const authenticatedActor = await requireActorContext();
    await upsertCurrentActorLessonProgress(authenticatedActor, {
      courseId: runtime.course.id,
      lessonId: runtime.lesson.id,
      moduleId: runtime.module?.id,
      state: "completed",
      progressPercent: 100,
      timeSpentSeconds: Math.max(runtime.lesson.durationMinutes * 60, 60),
    });

    if (runtime.navigation.next) {
      redirect(`/curriculum/${slug}/lesson/${runtime.navigation.next.id}`);
    }

    if (runtime.lesson.linkedQuiz) {
      redirect(`/curriculum/${slug}/quiz/${runtime.lesson.linkedQuiz.id}`);
    }

    redirect(`/curriculum/${slug}`);
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--background)] overflow-hidden rounded-none">
      <header className="flex items-center justify-between h-12 border-b border-[var(--border)] bg-[var(--surface)] px-4 shrink-0 rounded-none">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/curriculum/${slug}`} className="text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer" aria-label="Back to Course">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          </Link>
          <div className="h-4 w-[1px] bg-[var(--border)]" />
          <span className="font-mono text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest truncate">
            {runtime.course.slug}
          </span>
          <span className="text-[var(--muted-foreground)]">/</span>
          <span className="font-mono text-[10px] text-[var(--foreground)] uppercase tracking-widest truncate">
            {runtime.lesson.title}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[var(--muted-foreground)] uppercase tracking-widest">
              {runtime.navigation.position} / {runtime.navigation.totalLessons}
            </span>
            <div className="w-24 h-1.5 bg-[var(--border)] overflow-hidden rounded-none">
              <div
                className="h-full bg-[var(--accent)] rounded-none"
                style={{ width: `${progressPositionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden rounded-none">
        <div className="w-[40%] min-w-[350px] max-w-[600px] border-r border-[var(--border)] bg-[var(--background)] overflow-y-auto flex flex-col rounded-none">
          <div className="p-8 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-mono text-[9px] uppercase tracking-widest mb-6 rounded-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              {mapContentTypeLabel(runtime.lesson.contentType)}
            </div>

            <h1 className="text-3xl text-[var(--foreground)] tracking-tight mb-2 font-medium">
              {runtime.lesson.title}
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-6">
              {runtime.module?.title ?? "Module"} • {runtime.lesson.durationMinutes}m
            </p>

            <div className="prose prose-invert prose-sm max-w-none text-[var(--muted-foreground)] leading-relaxed space-y-4">
              <p>{runtime.lesson.summary}</p>

              {lessonBodyParagraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}

              {runtime.lesson.learningObjectives.length > 0 ? (
                <div>
                  <h3 className="text-lg text-[var(--foreground)] mt-8 mb-3 font-medium tracking-tight">Learning Objectives</h3>
                  <ul className="list-square pl-5 space-y-2 marker:text-[var(--border)]">
                    {runtime.lesson.learningObjectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {runtime.lesson.instructions.length > 0 ? (
                <div className="mt-6 border-l border-[var(--accent)] pl-5 py-1">
                  <h3 className="text-lg text-[var(--foreground)] mb-3 font-medium tracking-tight">Execution Steps</h3>
                  <ol className="list-decimal pl-4 space-y-2 font-mono text-[11px] text-[var(--foreground)]">
                    {runtime.lesson.instructions.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-6 border-t border-[var(--border)] bg-[var(--surface)] mt-auto flex items-center justify-between gap-3 shrink-0 rounded-none">
            {previousHref ? (
              <Link href={previousHref} className="text-[var(--muted-foreground)] hover:text-[var(--accent)] font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]">
                ← Previous
              </Link>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--border)]">Start</span>
            )}

            <div className="flex items-center gap-2">
              {quizHref ? (
                <Link
                  href={quizHref}
                  className="h-9 px-4 border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-pointer rounded-none inline-flex items-center"
                >
                  Open Quiz
                </Link>
              ) : null}

              <form action={markCompleteAction}>
                <button className="h-9 px-6 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2 rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white">
                  {isCompleted ? "Completed" : "Mark Complete"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[var(--surface)] min-w-0 rounded-none">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]">
            <div className="flex items-center">
              <div className="flex items-center gap-2 px-4 py-2.5 border-r border-[var(--border)] bg-[var(--surface)] border-t-2 border-t-[var(--accent)] cursor-pointer">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">
                  {starterFile?.path ?? "starter.txt"}
                </span>
              </div>
            </div>
            <div className="px-4">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {starterFile?.language ?? "text"}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[var(--border)] gap-px">
            <div className="flex-1 overflow-auto bg-[#111111] rounded-none p-4">
              <table className="w-full border-collapse font-mono text-xs leading-6" aria-label="Code editor">
                <tbody className="block">
                  {codeLines.map((line, i) => (
                    <tr key={`${i}-${line.slice(0, 8)}`} className="hover:bg-white/5 block w-full flex transition-colors">
                      <td className="select-none w-10 pr-4 text-right text-gray-600 py-0 shrink-0 border-r border-[#333] mr-4">{i + 1}</td>
                      <td className="pr-6 py-0 whitespace-pre text-gray-300 flex-1 overflow-x-auto">{line || " "}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="w-full lg:w-[45%] flex flex-col shrink-0 bg-[var(--background)] rounded-none">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">Expected Output</span>
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 bg-[var(--border)]" />
                  <div className="w-2.5 h-2.5 bg-[var(--border)]" />
                  <div className="w-2.5 h-2.5 bg-[var(--border)]" />
                </div>
              </div>

              <div className="flex-1 p-6 overflow-auto bg-white">
                <div className="p-6 border border-gray-300 w-full bg-white rounded-none">
                  <h2 className="text-xl tracking-tight mb-4 text-black font-medium">{runtime.lesson.title}</h2>
                  <ul className="space-y-3">
                    {runtime.lesson.expectedOutput.length > 0 ? (
                      runtime.lesson.expectedOutput.map((line) => (
                        <li key={line} className="text-sm text-black">{line}</li>
                      ))
                    ) : (
                      <li className="text-sm text-black">No expected output checklist yet.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="h-48 border-t border-[var(--border)] bg-[#111111] flex flex-col rounded-none">
                <div className="flex items-center px-4 py-2 bg-[#1a1a1a] border-b border-[#333]">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500">Execution Log</span>
                </div>
                <div className="p-4 font-mono text-[11px] overflow-auto flex-1 text-gray-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[#1d5cff] shrink-0">→</span>
                    <span>{isCompleted ? "Lesson marked complete." : "Waiting for completion update."}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#1d5cff] shrink-0">→</span>
                    <span>
                      Progress state: {runtime.viewer.progress?.state ?? "not_started"} • {runtime.viewer.progress?.progressPercent ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 shrink-0">~</span>
                    <span className="text-gray-500">Use &quot;Mark Complete&quot; to move forward and sync course progress.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
