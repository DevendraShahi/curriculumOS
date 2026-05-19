import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getPublicCourseByIdOrSlug } from "@/lib/services/course-service";
import { requireActorContext, resolveTenantId } from "@/lib/services/auth-context";
import { enrollCurrentActor, getCurrentActorProgress, listCurrentActorEnrollments } from "@/lib/services/learning-service";
import { serverEnv } from "@/lib/server-env";

type EnrollmentStatus = "not_enrolled" | "active" | "paused" | "completed" | "dropped";
type LessonState = "not_started" | "in_progress" | "completed";

function formatLevelLabel(
  value: "beginner" | "intermediate" | "advanced" | null | undefined
): string {
  if (!value) return "General";
  if (value === "beginner") return "Beginner";
  if (value === "intermediate") return "Intermediate";
  return "Advanced";
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "TBD";
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours === 0) return `${remMinutes}m`;
  if (remMinutes === 0) return `${hours}h`;
  return `${hours}h ${remMinutes}m`;
}

function lessonStateLabel(state: LessonState): string {
  if (state === "completed") return "Completed";
  if (state === "in_progress") return "In Progress";
  return "Not Started";
}

function lessonStateClassName(state: LessonState): string {
  if (state === "completed") {
    return "border-[#21B8A8]/40 bg-[#21B8A8]/10 text-[#21B8A8]";
  }
  if (state === "in_progress") {
    return "border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--accent)]";
  }
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const authState = await auth();
  const tenantId =
    resolveTenantId(authState.orgId) || serverEnv.APP_DEFAULT_TENANT_ID;
  const course = await getPublicCourseByIdOrSlug({
    tenantId,
    courseIdOrSlug: slug,
  });

  if (!course) return { title: "Course Not Found" };

  return {
    title: `${course.title} | CURRICULUM.OS`,
    description: course.description || course.summary,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const authState = await auth();
  const tenantId =
    resolveTenantId(authState.orgId) || serverEnv.APP_DEFAULT_TENANT_ID;

  const course = await getPublicCourseByIdOrSlug({
    tenantId,
    courseIdOrSlug: slug,
  });

  if (!course) {
    notFound();
  }

  const resolvedCourse = course;

  const progressByLesson = new Map<
    string,
    {
      state: LessonState;
      progressPercent: number;
    }
  >();

  let isAuthenticated = false;
  let enrollmentStatus: EnrollmentStatus = "not_enrolled";
  let progressSummary:
    | {
        totalLessons: number;
        completedLessons: number;
        inProgressLessons: number;
        completionPercent: number;
      }
    | null = null;

  if (authState.userId) {
    try {
      const actor = await requireActorContext();
      const [enrollments, progress] = await Promise.all([
        listCurrentActorEnrollments(actor),
        getCurrentActorProgress(actor, { courseId: resolvedCourse.id }),
      ]);
      const enrollment =
        enrollments.find((item) => item.courseId === resolvedCourse.id) ?? null;

      isAuthenticated = true;
      enrollmentStatus = enrollment?.status ?? "not_enrolled";
      progressSummary = progress.summary;

      for (const item of progress.items) {
        progressByLesson.set(item.lessonId, {
          state: item.state,
          progressPercent: item.progressPercent,
        });
      }
    } catch {
      isAuthenticated = false;
      enrollmentStatus = "not_enrolled";
      progressSummary = null;
    }
  }

  const modules = resolvedCourse.modules.map((module) => {
    const lessons = module.lessons.map((lesson) => {
      const progress = progressByLesson.get(lesson.id) ?? null;
      const state = progress?.state ?? "not_started";
      return {
        ...lesson,
        progressPercent: progress?.progressPercent ?? 0,
        state,
      };
    });
    const completedLessons = lessons.filter(
      (lesson) => lesson.state === "completed"
    ).length;
    const inProgressLessons = lessons.filter(
      (lesson) => lesson.state === "in_progress"
    ).length;

    return {
      ...module,
      lessons,
      completedLessons,
      inProgressLessons,
      duration: formatDuration(module.durationMinutes),
    };
  });

  const orderedLessons = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      moduleId: module.id,
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
      state: lesson.state,
    }))
  );

  const preferredLesson =
    orderedLessons.find((lesson) => lesson.state === "in_progress") ??
    orderedLessons.find((lesson) => lesson.state !== "completed") ??
    orderedLessons[0] ??
    null;

  const continueHref = preferredLesson
    ? `/curriculum/${slug}/lesson/${preferredLesson.lessonId}`
    : `/curriculum/${slug}`;

  const defaultOpenModuleId =
    preferredLesson?.moduleId ?? modules[0]?.id ?? null;

  const ctaLabel = !isAuthenticated
    ? "Sign In to Enroll"
    : enrollmentStatus === "completed"
      ? "Review Course"
      : enrollmentStatus === "active" || enrollmentStatus === "paused"
        ? "Continue Learning"
        : "Enroll Now";

  const ctaHref = !isAuthenticated
    ? `/sign-in?redirect_url=${encodeURIComponent(`/curriculum/${slug}`)}`
    : enrollmentStatus === "active" || enrollmentStatus === "paused"
      ? continueHref
      : `/curriculum/${slug}`;

  async function enrollAction() {
    "use server";

    const actor = await requireActorContext();
    await enrollCurrentActor(actor, {
      courseId: resolvedCourse.id,
      source: "direct",
    });
    redirect(continueHref);
  }

  return (
    <div className="relative min-h-[calc(100vh-72px)] bg-[var(--surface)]">
      <main className="mx-auto w-full max-w-4xl px-4 pb-32 pt-10 sm:px-6 lg:px-8">
        <Link
          href="/curriculum"
          className="inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to Curriculum
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {resolvedCourse.category || "General"}
          </span>
          <span className="border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Level: {formatLevelLabel(resolvedCourse.level)}
          </span>
          {isAuthenticated && progressSummary ? (
            <span className="border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">
              {progressSummary.completedLessons}/{progressSummary.totalLessons} Lessons Complete
            </span>
          ) : null}
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-[40px]">
          {resolvedCourse.title}
        </h1>

        <p className="mt-6 max-w-2xl text-[17px] leading-[1.6] text-[var(--muted-foreground)]">
          {resolvedCourse.description || resolvedCourse.summary}
        </p>

        <div className="mt-12 flex items-center gap-4 border border-[var(--border)] p-4 sm:max-w-[340px]">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <Image
              src="https://api.dicebear.com/7.x/notionists/svg?seed=echo11&backgroundColor=f1f5f9"
              alt="Echo11 Faculty"
              width={40}
              height={40}
              className="h-full w-full object-cover grayscale"
            />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
              Echo11 Faculty
            </p>
            <p className="font-mono text-[11px] tracking-wider text-[var(--muted-foreground)]">
              Curriculum Team
            </p>
          </div>
        </div>

        <section className="mt-20">
          <header className="flex items-end justify-between border-b border-[var(--border)] pb-4">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Course Syllabus
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted-foreground)]">
              {resolvedCourse.modulesCount} Modules • {formatDuration(resolvedCourse.durationMinutes)}
            </span>
          </header>

          <div className="mt-1">
            {modules.map((module) => (
              <details
                key={module.id}
                className="group border-b border-[var(--border)] last:border-b-0"
                open={defaultOpenModuleId === module.id}
              >
                <summary className="list-none cursor-pointer py-6 transition-colors focus-visible:bg-[var(--surface-2)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-[13px] text-[var(--muted-foreground)]">
                        {String(module.order).padStart(2, "0")}
                      </span>
                      <span className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] transition-colors group-open:text-[var(--accent)]">
                        {module.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
                      <span className="font-mono text-[11px] uppercase tracking-wider">
                        {module.completedLessons}/{module.lessons.length} complete
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-wider">
                        {module.duration}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-transform group-open:rotate-180"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </summary>
                <div className="pb-8 pl-12 pr-4 sm:pl-11">
                  <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--muted-foreground)]">
                    {module.description || "Detailed lesson outcomes and practical exercises."}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/curriculum/${slug}/lesson/${lesson.id}`}
                          className="flex items-start justify-between gap-3 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors hover:border-[var(--accent)]"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {lesson.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                              {lesson.summary}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${lessonStateClassName(
                                lesson.state
                              )}`}
                            >
                              {lessonStateLabel(lesson.state)}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                              {formatDuration(lesson.durationMinutes)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>

      <div className="sticky bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-24 w-full max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
              {resolvedCourse.title}
            </p>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-[var(--muted-foreground)]">
              {isAuthenticated && progressSummary
                ? `${progressSummary.completionPercent}% complete`
                : `${resolvedCourse.lessonsCount} lessons`}
            </p>
          </div>
          {!isAuthenticated ||
          enrollmentStatus === "active" ||
          enrollmentStatus === "paused" ||
          enrollmentStatus === "completed" ? (
            <Link
              href={ctaHref}
              className="flex h-[42px] items-center justify-center bg-[var(--accent)] px-8 text-[11px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              {ctaLabel}
            </Link>
          ) : (
            <form action={enrollAction}>
              <button className="flex h-[42px] items-center justify-center bg-[var(--accent)] px-8 text-[11px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2">
                {ctaLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
