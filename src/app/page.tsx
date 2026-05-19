import { auth, currentUser } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { coursesCollection, lessonsCollection } from "@/lib/db/collections";
import { getMongoDb } from "@/lib/mongodb";
import { listEnrollmentsByUser } from "@/lib/repositories/enrollment-repository";
import { listProgressEventsByUser } from "@/lib/repositories/progress-event-repository";
import { resolveTenantId, type ActorContext } from "@/lib/services/auth-context";
import {
  buildWeeklyProgressMetrics,
  DEFAULT_METRIC_WINDOW_DAYS,
  toLessonLookupKey,
  type WeeklyMetricCell,
  type WeeklyProgressMetrics,
} from "@/lib/services/progress-metrics-service";
import {
  COURSE_CARD_IMAGE_SIZES,
  getCourseCardImage,
} from "@/lib/course-card-image";
import { getDashboardHomeData } from "@/lib/services/dashboard-home-service";
import { serverEnv } from "@/lib/server-env";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import { RequestAccessCta } from "@/app/_components/request-access-cta";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_METRIC_WINDOW_DAYS = DEFAULT_METRIC_WINDOW_DAYS;

type ActiveCourseData = {
  label: string;
  title: string;
  summary: string;
  progressPercent: number;
  ctaLabel: string;
  ctaHref: string;
};

type ViewerContext = {
  actor: ActorContext;
  db: Awaited<ReturnType<typeof getMongoDb>>;
  syncedUser: Awaited<ReturnType<typeof syncActorToUserDocument>>;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getMetricCellClass(intensity: WeeklyMetricCell["intensity"]): string {
  switch (intensity) {
    case 4:
      return "bg-gradient-to-br from-[var(--accent)] to-blue-800";
    case 3:
      return "bg-gradient-to-br from-blue-500 to-[var(--accent)]";
    case 2:
      return "bg-gradient-to-br from-blue-400 to-blue-600";
    case 1:
      return "bg-gradient-to-br from-blue-200 to-blue-400";
    default:
      return "bg-[var(--surface-2)]";
  }
}

function formatSkillPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Math.max(0, Math.min(100, Math.round(safe)))}%`;
}

function formatCourseLevel(
  value: "beginner" | "intermediate" | "advanced" | null | undefined
): string {
  if (!value) return "General";
  if (value === "beginner") return "Beginner";
  if (value === "intermediate") return "Intermediate";
  return "Advanced";
}

async function getViewerContext(): Promise<ViewerContext | null> {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const actor: ActorContext = {
    clerkUserId: userId,
    orgId: orgId ?? null,
    tenantId: resolveTenantId(orgId),
    clerkUser,
  };

  const [db, syncedUser] = await Promise.all([
    getMongoDb(),
    syncActorToUserDocument(actor),
  ]);

  return {
    actor,
    db,
    syncedUser,
  };
}

function getFallbackActiveCourse(): ActiveCourseData {
  return {
    label: "Learning path",
    title: "No active course yet",
    summary:
      "Start a track from the curriculum to unlock personalized progress, weekly metrics, and completion signals.",
    progressPercent: 0,
    ctaLabel: "Browse curriculum",
    ctaHref: "/curriculum",
  };
}

async function getActiveCourseData(
  viewer: ViewerContext | null
): Promise<ActiveCourseData> {
  if (!viewer) return getFallbackActiveCourse();

  const enrollments = await listEnrollmentsByUser(
    viewer.db,
    viewer.actor.tenantId,
    viewer.syncedUser._id
  );

  if (enrollments.length === 0) {
    return getFallbackActiveCourse();
  }

  const selectedEnrollment =
    enrollments.find((item) => item.status === "active") ??
    enrollments.find((item) => item.status === "paused") ??
    enrollments[0];

  const courseIds = enrollments.map((item) => item.courseId);
  const courses = await coursesCollection(viewer.db)
    .find({
      tenantId: viewer.actor.tenantId,
      _id: { $in: courseIds },
    })
    .toArray();

  const courseMap = new Map(courses.map((course) => [course._id.toString(), course]));
  const course = courseMap.get(selectedEnrollment.courseId.toString());

  if (!course) {
    return getFallbackActiveCourse();
  }

  const statusLabel =
    selectedEnrollment.status === "completed"
      ? "Completed course"
      : selectedEnrollment.status === "paused"
        ? "Paused course"
        : "Active course";

  const ctaLabel =
    selectedEnrollment.status === "completed" ? "Review course" : "Continue learning";

  return {
    label: statusLabel,
    title: course.title,
    summary:
      course.summary ||
      "Continue through your active curriculum path and keep momentum this week.",
    progressPercent: clampPercent(selectedEnrollment.progressPercent),
    ctaLabel,
    ctaHref: `/curriculum/${course.slug}`,
  };
}

async function getWeeklyMetrics(
  viewer: ViewerContext | null
): Promise<WeeklyProgressMetrics> {
  try {
    if (!viewer) {
      return {
        ...buildWeeklyProgressMetrics({
          events: [],
          metricWindowDays: WEEKLY_METRIC_WINDOW_DAYS,
        }),
        headline: "Sign in to unlock live weekly learning metrics.",
      };
    }

    const startAt = new Date(
      Date.now() - (WEEKLY_METRIC_WINDOW_DAYS - 1) * DAY_MS
    );
    const events = await listProgressEventsByUser(viewer.db, {
      tenantId: viewer.actor.tenantId,
      userId: viewer.syncedUser._id,
      startAt,
      endAt: new Date(),
      limit: 5000,
    });

    const lessonTitlesById = new Map<string, string>();
    if (events.length > 0) {
      const uniqueLessonIds = Array.from(
        new Set(events.map((event) => event.lessonId).filter(Boolean))
      );
      const uniqueCourseIds = Array.from(
        new Set(events.map((event) => event.courseId.toString()))
      )
        .filter(ObjectId.isValid)
        .map((courseId) => new ObjectId(courseId));
      const lessonObjectIds = uniqueLessonIds
        .filter(ObjectId.isValid)
        .map((lessonId) => new ObjectId(lessonId));

      const lessonRows = await lessonsCollection(viewer.db)
        .find({
          tenantId: viewer.actor.tenantId,
          ...(uniqueCourseIds.length > 0
            ? { courseId: { $in: uniqueCourseIds } }
            : {}),
          $or: [
            { slug: { $in: uniqueLessonIds } },
            ...(lessonObjectIds.length > 0 ? [{ _id: { $in: lessonObjectIds } }] : []),
          ],
        })
        .project({ _id: 1, courseId: 1, slug: 1, title: 1 })
        .toArray();

      for (const lesson of lessonRows) {
        lessonTitlesById.set(
          toLessonLookupKey(lesson.courseId.toString(), lesson.slug),
          lesson.title
        );
        lessonTitlesById.set(
          toLessonLookupKey(lesson.courseId.toString(), lesson._id.toString()),
          lesson.title
        );
        lessonTitlesById.set(lesson.slug, lesson.title);
        lessonTitlesById.set(lesson._id.toString(), lesson.title);
      }
    }

    const metrics = buildWeeklyProgressMetrics({
      events,
      lessonTitlesById,
      metricWindowDays: WEEKLY_METRIC_WINDOW_DAYS,
      weekDays: 7,
      recentOutputLimit: 3,
    });

    if (events.length === 0) {
      return {
        ...metrics,
        headline: "Start your first lesson to generate live weekly metrics.",
      };
    }

    return metrics;
  } catch {
    return {
      ...buildWeeklyProgressMetrics({
        events: [],
        metricWindowDays: WEEKLY_METRIC_WINDOW_DAYS,
      }),
      headline: "Weekly metrics are temporarily unavailable.",
    };
  }
}

export default async function Home() {
  const viewer = await getViewerContext();
  const [weeklyMetrics, activeCourse, dashboardHome] = await Promise.all([
    getWeeklyMetrics(viewer),
    getActiveCourseData(viewer),
    getDashboardHomeData({
      tenantId: viewer?.actor.tenantId ?? serverEnv.APP_DEFAULT_TENANT_ID,
    }),
  ]);
  const featuredCourse = dashboardHome.topCourses[0] ?? null;
  const secondaryCourses = dashboardHome.topCourses.slice(1, 5);
  const featuredCourseImage = featuredCourse
    ? getCourseCardImage(featuredCourse.slug)
    : null;

  const learningStages = [
    {
      id: "01",
      title: "Foundations",
      description: "Build core understanding and essential skills.",
      status:
        activeCourse.progressPercent >= 30
          ? "Complete"
          : activeCourse.progressPercent > 0
            ? "In Progress"
            : "Pending",
    },
    {
      id: "02",
      title: "Projects",
      description: "Apply knowledge through real-world builds.",
      status:
        weeklyMetrics.thisWeekTouches >= 3
          ? "In Progress"
          : weeklyMetrics.thisWeekTouches > 0
            ? "Started"
            : "Pending",
    },
    {
      id: "03",
      title: "Reviews",
      description: "Get feedback and refine with intent.",
      status:
        weeklyMetrics.thisWeekCompleted >= 2
          ? "Available"
          : weeklyMetrics.thisWeekCompleted > 0
            ? "Queued"
            : "Locked",
    },
    {
      id: "04",
      title: "Mastery",
      description: "Demonstrate depth and ship with confidence.",
      status: activeCourse.progressPercent >= 100 ? "Unlocked" : "Locked",
    },
  ] as const;

  const skillStack = [
    {
      name: "Course Progress",
      progress: formatSkillPercent(activeCourse.progressPercent),
    },
    {
      name: "Weekly Consistency",
      progress: formatSkillPercent((weeklyMetrics.thisWeekActiveDays / 7) * 100),
    },
    {
      name: "Lesson Completion",
      progress: formatSkillPercent((weeklyMetrics.thisWeekCompleted / 7) * 100),
    },
    {
      name: "Streak Momentum",
      progress: formatSkillPercent((weeklyMetrics.streakDays / 14) * 100),
    },
  ];

  const statusStripTicker = [...dashboardHome.statusStrip, ...dashboardHome.statusStrip];

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <section aria-label="Hero dashboard preview">
        {/* Workspace Date Header */}
        <div className="flex items-center justify-between border border-[var(--border)] border-b-0 bg-[var(--surface)] px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          <span className="hidden sm:inline">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span className="sm:hidden">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> {viewer ? 'Workspace Active' : 'Ready to Learn'}</span>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] border border-[var(--border)] lg:grid-cols-[1.5fr_1fr]">
          
          {/* Main Panel (Left) */}
          <article className="bg-[var(--surface)] p-8 sm:p-12 flex flex-col justify-between min-h-[480px]">
            <div>
              <h1 className="text-5xl font-semibold tracking-tight text-[var(--foreground)] sm:text-7xl">
                {viewer ? `Welcome back.` : `Your Learning Workspace.`}
              </h1>
              <p className="mt-6 max-w-xl text-lg text-[var(--muted-foreground)]">
                {weeklyMetrics.headline}
              </p>
            </div>

            <div className="mt-12 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                  <span className="inline-flex items-center border border-[var(--accent)] bg-[var(--accent)]/5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">
                    {activeCourse.label}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                    {activeCourse.title}
                  </h2>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-4xl font-semibold leading-none text-[var(--foreground)]">
                    {activeCourse.progressPercent}<span className="text-[var(--muted-foreground)]">%</span>
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Completion
                  </p>
                </div>
              </div>

              {/* Continuous Progress Bar */}
              <div className="h-2 w-full bg-[var(--background)] overflow-hidden relative">
                <div 
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-[var(--accent)]"
                  style={{ width: `${activeCourse.progressPercent}%` }}
                />
              </div>

              <Link
                href={activeCourse.ctaHref}
                className="mt-4 inline-flex h-12 w-fit items-center gap-3 bg-[var(--foreground)] px-8 text-sm font-medium text-[var(--surface)] transition-all hover:bg-[var(--accent)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {activeCourse.ctaLabel} <span aria-hidden>→</span>
              </Link>
            </div>
          </article>

          {/* Momentum & Activity (Right Column) */}
          <aside className="flex flex-col gap-px bg-[var(--border)]">
            
            {/* Momentum Board (Top Right) */}
            <article className="bg-[var(--surface)] p-6 sm:p-8 flex-1">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-6">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Your Momentum
                </h3>
                <span className="inline-flex items-center border border-[var(--accent)] bg-[var(--accent)]/5 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">
                  {weeklyMetrics.streakDays} Day Streak
                </span>
              </div>

              <div className="grid grid-cols-3 gap-px bg-[var(--border)] mb-6">
                <div className="bg-[var(--surface-2)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--foreground)]">{weeklyMetrics.thisWeekTouches}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">Sessions</p>
                </div>
                <div className="bg-[var(--surface-2)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--foreground)]">{weeklyMetrics.thisWeekCompleted}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">Lessons</p>
                </div>
                <div className="bg-[var(--surface-2)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--accent)]">{weeklyMetrics.thisWeekActiveDays}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">Active Days</p>
                </div>
              </div>

              {/* Heatmap */}
              <div className="border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="grid grid-cols-7 gap-[2px]">
                  {weeklyMetrics.cells.map((cell) => (
                    <span
                      key={cell.dayStartMs}
                      title={`${new Date(cell.dayStartMs).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}: ${cell.count} updates`}
                      className={`block h-4 w-full ${getMetricCellClass(cell.intensity)}`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  <span>Last 4 Weeks</span>
                  <span>Today</span>
                </div>
              </div>
            </article>

            {/* Activity Feed (Bottom Right) */}
            <article className="bg-[var(--surface)] p-6 sm:p-8 flex-1 min-h-[220px]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Recent Activity
                </h3>
              </div>

              <ul className="space-y-4 text-[13px] leading-relaxed text-[var(--foreground)]">
                {weeklyMetrics.recentOutput.map((event) => (
                  <li key={event.id} className={`flex items-start gap-3 ${event.tone === "muted" ? "text-[var(--muted-foreground)]" : ""}`}>
                    <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${event.tone === "accent" ? "bg-[var(--accent)]" : "bg-[var(--muted-foreground)]/30"}`} />
                    <span>{event.message}</span>
                  </li>
                ))}
                {weeklyMetrics.recentOutput.length === 0 && (
                  <li className="text-[var(--muted-foreground)] italic">No recent activity found. Start a lesson to begin tracking!</li>
                )}
              </ul>
            </article>

          </aside>
        </div>
      </section>
      {/* Top Courses Section */}
      <section className="mt-24 border-t border-[var(--border)] pt-16" aria-label="Top Courses">
        <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              COURSE CATALOG
            </span>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Top Courses
            </h2>
          </div>
          <Link href="/curriculum" className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer shrink-0">
            View All Courses →
          </Link>
        </div>

        {featuredCourse ? (
          <div className="grid grid-cols-1 gap-px bg-[var(--border)] lg:grid-cols-[1.4fr_1fr_1fr]">
            <Link
              href={`/curriculum/${featuredCourse.slug}`}
              className="group flex min-h-[360px] cursor-pointer flex-col bg-[var(--surface)] transition-colors duration-200 hover:bg-[#f8fafc] dark:hover:bg-white/[0.02]"
            >
              <div className="relative h-52 overflow-hidden bg-[var(--surface-2)]">
                {featuredCourseImage ? (
                  <Image
                    src={featuredCourseImage.src}
                    alt={`${featuredCourse.title} course cover`}
                    fill
                    sizes={COURSE_CARD_IMAGE_SIZES.homeFeatured}
                    style={{ objectPosition: featuredCourseImage.objectPosition }}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : null}
              </div>

              <div className="flex grow flex-col p-8 sm:p-10">
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex items-center border border-[var(--accent)] bg-blue-50/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] dark:bg-blue-900/10">
                    FEATURED
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {featuredCourse.category || "COURSE"}
                  </span>
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--foreground)] transition-colors duration-200 group-hover:text-[var(--accent)]">
                  {featuredCourse.title}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {featuredCourse.summary}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {featuredCourse.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-[var(--border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[var(--border)] px-8 pb-8 pt-8 sm:px-10 sm:pb-10">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Duration</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{featuredCourse.durationLabel}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Level</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatCourseLevel(featuredCourse.level)}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Enrolled</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{featuredCourse.enrollments}</p>
                </div>
              </div>
            </Link>

            <div className="contents lg:col-span-2 lg:grid lg:grid-cols-[1fr_1fr] gap-px bg-[var(--border)]">
              {secondaryCourses.map((course) => {
                const courseImage = getCourseCardImage(course.slug);
                return (
                <Link
                  href={`/curriculum/${course.slug}`}
                  key={course.id}
                  className="group flex cursor-pointer flex-col justify-between bg-[var(--surface)] transition-colors duration-200 hover:bg-[#f8fafc] dark:hover:bg-white/[0.02]"
                >
                  <div className="relative h-36 overflow-hidden bg-[var(--surface-2)]">
                    <Image
                      src={courseImage.src}
                      alt={`${course.title} course cover`}
                      fill
                      sizes={COURSE_CARD_IMAGE_SIZES.homeSecondary}
                      style={{ objectPosition: courseImage.objectPosition }}
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="flex grow flex-col p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{course.category || "Course"}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5">{formatCourseLevel(course.level)}</span>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)] transition-colors duration-200 group-hover:text-[var(--accent)]">{course.title}</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">{course.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {course.tags.map((tag) => (
                        <span key={tag} className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 border-t border-[var(--border)] px-6 pb-6 pt-5 sm:px-8 sm:pb-8 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{course.durationLabel}</span>
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors duration-200">Enroll →</span>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border border-[var(--border)] bg-[var(--surface)] p-10 text-sm text-[var(--muted-foreground)]">
            No published courses available yet.
          </div>
        )}
      </section>

      {/* Learning System Section */}
      <section className="mt-24 border-t border-[var(--border)] pt-16" aria-label="Learning System Overview">
        <div className="mb-12">
          <span className="inline-flex items-center border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            LEARNING SYSTEM
          </span>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            A curriculum built like<br />an operating system.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted-foreground)]">
            Combine foundations, projects, and feedback loops into a focused path.<br className="hidden sm:block" />
            Structured. Measurable. Built for compounding growth.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Left Card: Modular Learning Paths */}
          <article className="border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-medium tracking-tight text-[var(--foreground)]">Modular Learning Paths</h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">Progress through a connected system of knowledge and practice.</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>

            <div className="mt-10 relative">
              <div className="absolute left-[23px] top-6 bottom-6 w-px bg-[var(--border)] z-0" />

              <div className="space-y-0">
                {learningStages.map((stage, index) => {
                  const isAccent =
                    stage.status === "Complete" ||
                    stage.status === "In Progress" ||
                    stage.status === "Started" ||
                    stage.status === "Available" ||
                    stage.status === "Unlocked";
                  const isSpinning = stage.status === "In Progress";
                  const isLast = index === learningStages.length - 1;

                  return (
                    <div
                      key={stage.id}
                      className={`relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-6 ${
                        isLast ? "" : "border-b border-[var(--border)]"
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center border font-mono font-medium ${
                          isAccent
                            ? "border-[var(--accent)] bg-blue-50/50 text-[var(--accent)] dark:bg-blue-900/10"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {stage.id}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-[var(--foreground)]">{stage.title}</h4>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1">{stage.description}</p>
                      </div>
                      <div
                        className={`flex items-center gap-2 text-sm font-medium ${
                          isAccent ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSpinning ? "animate-spin-slow" : ""}>
                          {isAccent ? (
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          ) : (
                            <circle cx="12" cy="12" r="9" />
                          )}
                        </svg>
                        {stage.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            {/* Skill Stack */}
            <article className="border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-[var(--foreground)]">Skill Stack</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">Core competencies tracked as you progress.</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>

              <div className="space-y-6 flex-1 justify-center flex flex-col">
                {skillStack.map((skill) => (
                  <div key={skill.name} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium text-[var(--foreground)] shrink-0">{skill.name}</div>
                    <div className="flex-1 h-[2px] bg-[var(--border)] relative">
                      <div className="absolute top-0 left-0 h-full bg-[var(--accent)]" style={{ width: skill.progress }} />
                    </div>
                    <div className="w-10 text-right text-sm font-medium text-[var(--accent)]">{skill.progress}</div>
                  </div>
                ))}
              </div>
            </article>

            {/* Weekly Cadence */}
            <article className="border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-[var(--foreground)]">Weekly Cadence</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">A rhythm that drives consistent momentum.</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>

              <div className="mt-8 relative px-4">
                <div className="absolute left-6 right-6 top-[7px] h-px bg-[var(--border)] z-0" />
                <div className="relative z-10 flex justify-between">
                  {[
                    {
                      day: "MON",
                      label: "Learn",
                      active: weeklyMetrics.thisWeekTouches > 0,
                    },
                    {
                      day: "TUE-WED",
                      label: "Build",
                      active: weeklyMetrics.thisWeekTouches >= 3,
                    },
                    {
                      day: "THU",
                      label: "Reflect",
                      active: weeklyMetrics.thisWeekCompleted > 0,
                    },
                    {
                      day: "FRI",
                      label: "Ship",
                      active:
                        activeCourse.progressPercent >= 100 ||
                        weeklyMetrics.thisWeekCompleted >= 3,
                    },
                  ].map((item) => (
                    <div key={item.day} className="flex flex-col items-center gap-3 w-16">
                      <div
                        className={`w-4 h-4 rounded-full border-2 bg-[var(--surface)] ${
                          item.active ? "border-[var(--accent)]" : "border-[var(--border)]"
                        }`}
                      />
                      <span
                        className={`font-mono text-[10px] uppercase tracking-widest ${
                          item.active ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {item.day}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>

        <div className="mt-12">
          <button
            type="button"
            className="inline-flex h-12 items-center gap-3 bg-[#1a1a1a] px-8 text-[11px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            View Learning System <span aria-hidden className="font-normal text-base leading-none">→</span>
          </button>
        </div>
      </section>

      {/* System Topology (CSS Native) */}
      <section className="mt-24 border-t border-[var(--border)] pt-16 pb-24" aria-label="System Topology">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.5fr] items-start">
          <div className="sticky top-12">
            <span className="inline-flex items-center border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] bg-blue-50/50 dark:bg-blue-900/10">
              CORE INFRASTRUCTURE
            </span>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              System Topology
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--muted-foreground)]">
              A highly distributed, robust architectural grid. Every module, project, and review is mapped 
              to a central telemetry node to track your progress with absolute precision.
            </p>
            <ul className="mt-8 space-y-4 font-mono text-xs text-[var(--muted-foreground)]">
              <li className="flex items-center gap-3">
                <span className="text-[var(--accent)]">01.</span> Distributed event loops
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[var(--accent)]">02.</span> Immutable state channels
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[var(--accent)]">03.</span> Real-time peer reviews
              </li>
            </ul>
          </div>
          
          <div className="relative border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10 min-h-[400px] overflow-hidden flex flex-col justify-between group">
            {/* Structural Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.08]"
              style={{
                backgroundImage: "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
                backgroundSize: "24px 24px"
              }}
            />
            
            <div className="relative z-10 flex justify-between items-start">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Network Status <span className="text-[var(--accent)] ml-2">Online</span>
              </div>
              <div className="w-2 h-2 bg-[var(--accent)] animate-pulse rounded-full" />
            </div>

            {/* Simulated Node Grid with Perpetual Micro-interactions */}
            <div className="relative z-10 grid grid-cols-8 sm:grid-cols-12 gap-2 mt-16 mb-16">
              {Array.from({ length: 96 }).map((_, i) => {
                const isActive = [14, 27, 42, 55, 73, 88].includes(i);
                const isConnecting = [15, 26, 43, 54, 72, 89].includes(i);
                const isPulsing = [27, 73].includes(i);
                return (
                  <div 
                    key={i} 
                    className={`aspect-square border transition-all duration-700 ${
                      isActive 
                        ? 'border-[var(--accent)] bg-[var(--accent)]/80' 
                        : isConnecting
                        ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10'
                        : 'border-[var(--border)] opacity-20 group-hover:opacity-40'
                    } ${isPulsing ? 'animate-pulse' : ''}`}
                  />
                );
              })}
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-8 border-t border-[var(--border)] pt-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Active Nodes</p>
                <p className="mt-2 text-2xl font-mono text-[var(--foreground)]">{dashboardHome.topology.activeNodes}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Latency</p>
                <p className="mt-2 text-2xl font-mono text-[var(--accent)]">{dashboardHome.topology.latencyMs}ms</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4th Section: Curriculum Registry */}
      <section className="mt-24 border-t border-[var(--border)] pt-16 pb-24" aria-label="Curriculum Registry">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              MODULE REGISTRY
            </span>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Available Modules
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] transition-colors hover:bg-[#f1f5f9] dark:hover:bg-white/10 focus-visible:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="21" y1="21" x2="16.65" y2="16.65" /><circle cx="11" cy="11" r="8" />
            </svg>
            Search Registry
          </button>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface)]">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto] gap-6 border-b border-[var(--border)] p-6 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            <div className="w-16">ID</div>
            <div>Module Name</div>
            <div className="w-32 text-right">Status</div>
            <div className="w-24 text-right">Action</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[var(--border)]">
            {dashboardHome.moduleRegistry.length > 0 ? (
              dashboardHome.moduleRegistry.map((module) => (
                <div key={module.slug} className="group grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-4 md:gap-6 p-6 md:items-center hover:bg-[#f8fafc] dark:hover:bg-white/[0.02] transition-colors">
                  <div className="font-mono text-xs font-semibold text-[var(--accent)] w-16">{module.id}</div>
                  <div>
                    <h3 className="text-base font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{module.title}</h3>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{module.description}</p>
                  </div>
                  <div className="md:w-32 md:text-right font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] flex items-center md:justify-end gap-2">
                    {module.status === "locked" ? <span className="inline-block w-2 h-2 rounded-full border border-[var(--border)]" /> : null}
                    {module.status === "available" ? <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" /> : null}
                    {module.status}
                  </div>
                  <div className="md:w-24 md:text-right">
                    {module.status === "available" && module.courseSlug ? (
                      <Link href={`/curriculum/${module.courseSlug}`} className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:text-[var(--accent)]">
                        {module.actionLabel} <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] cursor-not-allowed">
                        {module.actionLabel} <span aria-hidden>→</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-sm text-[var(--muted-foreground)]">
                Module registry is currently empty.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5th Section: Final CTA Banner (Minimalist OS Design) */}
      <section className="mt-24 mb-24" aria-label="Call to Action">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-16 flex flex-col md:flex-row md:items-center justify-between gap-12 relative overflow-hidden">
          {/* Subtle OS texture */}
          <div className="absolute top-0 right-0 w-64 h-64 border-l border-b border-[var(--border)] opacity-20 pointer-events-none"
               style={{
                 backgroundImage: "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
                 backgroundSize: "16px 16px"
               }}
          />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-8 bg-[var(--surface)]">
              SYSTEM INITIALIZATION
            </span>
            <h2 className="text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Deploy your environment.
            </h2>
            <p className="mt-4 text-lg text-[var(--muted-foreground)] leading-relaxed">
              Stop consuming generic tutorials. Build a compounding knowledge system. 
              The curriculum infrastructure is currently in closed beta.
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <RequestAccessCta />
          </div>
        </div>
      </section>
    </main>

    {/* Footer — Redesigned */}
    <footer className="bg-[var(--surface)]" aria-label="Site footer">

      {/* System Status Strip */}
      <div className="border-t border-b border-[var(--border)] py-3 overflow-hidden">
        <div className="flex gap-10 animate-[marquee_30s_linear_infinite] whitespace-nowrap w-max">
          {statusStripTicker.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${item.ok ? "bg-[var(--accent)]" : "bg-amber-400"}`} />
              {item.label}
              <span className={item.ok ? "text-[var(--foreground)]" : "text-amber-500"}>{item.value}</span>
              <span className="ml-6 text-[var(--border)]">|</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Giant Wordmark */}
        <div className="border-b border-[var(--border)] py-10 sm:py-16 flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold tracking-[-0.04em] leading-none text-[var(--foreground)] select-none break-words">
              CURRICULUM<span className="text-[var(--accent)]">.</span>OS
            </h2>
            <p className="mt-4 text-sm text-[var(--muted-foreground)] max-w-sm leading-relaxed">
              A curriculum engineered like an operating system. Structured paths, compounding skills, measurable output.
            </p>
          </div>

          {/* Newsletter / Access Request */}
          <div className="shrink-0 lg:max-w-xs w-full">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
              Request early access
            </p>
            <div className="flex border border-[var(--border)] bg-[var(--surface)]">
              <input
                type="email"
                placeholder="you@domain.com"
                className="flex-1 bg-transparent px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none font-mono"
                aria-label="Email address"
              />
              <button
                type="button"
                className="border-l border-[var(--border)] px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--surface)] transition-colors duration-200 cursor-pointer whitespace-nowrap"
              >
                Join
              </button>
            </div>
            <p className="mt-2 font-mono text-[9px] text-[var(--muted-foreground)] uppercase tracking-widest">
              Closed beta · No spam · Unsubscribe anytime
            </p>
          </div>
        </div>

        {/* Nav Grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 sm:gap-x-8 sm:gap-y-12 sm:py-14 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Social</p>
            <div className="flex items-center gap-5">
              <a href="#" aria-label="GitHub" className="group flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
              <a href="#" aria-label="Twitter / X" className="group flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X / Twitter
              </a>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Platform</p>
            <ul className="space-y-3.5">
              {["Dashboard", "Modules", "Projects", "Reviews", "Mastery"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">System</p>
            <ul className="space-y-3.5">
              {["Docs", "Changelog", "Status", "API", "Open Source"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Company</p>
            <ul className="space-y-3.5">
              {["About", "Blog", "Careers", "Privacy", "Terms"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar — Terminal Prompt Style */}
        <div className="border-t border-[var(--border)] py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--muted-foreground)]">
            <span className="text-[var(--accent)]">$</span>
            <span className="uppercase tracking-widest">curriculum --version 0.1.0-beta</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            © 2025 Curriculum.OS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
    </>
  );
}
