import { type ObjectId } from "mongodb";
import {
  coursesCollection,
  enrollmentsCollection,
  lessonsCollection,
  modulesCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import { getMongoDb } from "@/lib/mongodb";

export type DashboardTopCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced" | null;
  tags: string[];
  durationLabel: string;
  lessonsCount: number;
  modulesCount: number;
  enrollments: number;
};

export type DashboardModuleRegistryItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  courseTitle: string;
  courseSlug: string;
  status: "available" | "locked";
  actionLabel: "Explore" | "Waitlist";
  updatedAt: string;
};

export type DashboardStatusStripItem = {
  label: string;
  value: string;
  ok: boolean;
};

export type DashboardHomeData = {
  tenantId: string;
  generatedAt: string;
  topCourses: DashboardTopCourse[];
  moduleRegistry: DashboardModuleRegistryItem[];
  topology: {
    activeNodes: number;
    latencyMs: number;
  };
  statusStrip: DashboardStatusStripItem[];
};

function formatDurationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "TBD";
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours === 0) return `${remMinutes}m`;
  if (remMinutes === 0) return `${hours}h`;
  return `${hours}h ${remMinutes}m`;
}

function buildCourseTags(params: {
  tags?: string[];
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
}): string[] {
  const fromTags = (params.tags ?? []).filter(Boolean).slice(0, 5);
  if (fromTags.length > 0) return fromTags;

  const fallback: string[] = [];
  if (params.category) fallback.push(params.category);
  if (params.level) fallback.push(params.level);
  return fallback.length > 0 ? fallback : ["General"];
}

function buildModuleRegistryId(slug: string, order: number, index: number): string {
  const prefix = slug
    .split("-")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

  const safePrefix = prefix.length > 0 ? prefix : "MOD";
  const numeric = Number.isFinite(order) ? order : index + 1;
  return `${safePrefix}-${String(Math.max(1, numeric)).padStart(2, "0")}`;
}

export async function getDashboardHomeData(params: {
  tenantId: string;
}): Promise<DashboardHomeData> {
  const startedAt = Date.now();
  const db = await getMongoDb();
  const now = new Date();
  const recentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const courseRows = await coursesCollection(db)
    .find({
      tenantId: params.tenantId,
      status: "published",
    })
    .project({
      _id: 1,
      slug: 1,
      title: 1,
      summary: 1,
      category: 1,
      level: 1,
      tags: 1,
      durationMinutes: 1,
      lessonsCount: 1,
      modulesCount: 1,
      updatedAt: 1,
      publishedAt: 1,
    })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(12)
    .toArray()
    .catch(() => []);

  const courseIds = courseRows.map((course) => course._id);
  const enrollmentRows =
    courseIds.length > 0
      ? await enrollmentsCollection(db)
          .aggregate<{ _id: ObjectId; count: number }>([
            {
              $match: {
                tenantId: params.tenantId,
                courseId: { $in: courseIds },
                status: { $in: ["active", "completed", "paused"] },
              },
            },
            {
              $group: {
                _id: "$courseId",
                count: { $sum: 1 },
              },
            },
          ])
          .toArray()
          .catch(() => [])
      : [];

  const enrollmentsByCourse = new Map(
    enrollmentRows.map((row) => [row._id.toString(), row.count])
  );

  const topCourses = courseRows
    .map((course) => ({
      id: course._id.toString(),
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      category: course.category ?? "",
      level: course.level ?? null,
      tags: buildCourseTags({
        tags: course.tags,
        category: course.category,
        level: course.level ?? undefined,
      }),
      durationLabel: formatDurationLabel(course.durationMinutes),
      lessonsCount: course.lessonsCount,
      modulesCount: course.modulesCount,
      enrollments: enrollmentsByCourse.get(course._id.toString()) ?? 0,
      sortUpdatedAt: course.updatedAt.getTime(),
    }))
    .sort((a, b) => {
      if (b.enrollments !== a.enrollments) return b.enrollments - a.enrollments;
      return b.sortUpdatedAt - a.sortUpdatedAt;
    })
    .slice(0, 5)
    .map((course) => course);

  const moduleRows = await modulesCollection(db)
    .find({
      tenantId: params.tenantId,
    })
    .project({
      _id: 1,
      slug: 1,
      title: 1,
      description: 1,
      courseId: 1,
      order: 1,
      isPublished: 1,
      updatedAt: 1,
    })
    .sort({ updatedAt: -1, order: 1 })
    .limit(8)
    .toArray()
    .catch(() => []);

  const moduleCourseIds = Array.from(
    new Map(moduleRows.map((module) => [module.courseId.toString(), module.courseId])).values()
  );

  const moduleCourses = await coursesCollection(db)
    .find({
      tenantId: params.tenantId,
      _id: {
        $in: moduleCourseIds,
      },
    })
    .project({ _id: 1, title: 1, slug: 1, status: 1 })
    .toArray()
    .catch(() => []);

  const courseMap = new Map(
    moduleCourses.map((course) => [course._id.toString(), course])
  );

  const moduleRegistry: DashboardModuleRegistryItem[] = moduleRows.map(
    (module, index) => {
      const course = courseMap.get(module.courseId.toString());
      const isAvailable = Boolean(course && course.status === "published" && module.isPublished);

      return {
        id: buildModuleRegistryId(module.slug, module.order, index),
        slug: module.slug,
        title: module.title,
        description:
          module.description ||
          "Structured learning outcomes and practical exercises for this module.",
        courseTitle: course?.title || "Unknown Course",
        courseSlug: course?.slug || "",
        status: isAvailable ? "available" : "locked",
        actionLabel: isAvailable ? "Explore" : "Waitlist",
        updatedAt: module.updatedAt.toISOString(),
      };
    }
  );

  const [
    publishedCoursesResult,
    publishedModulesResult,
    publishedLessonsResult,
    activeEnrollmentsResult,
    recentProgressEventsResult,
    activeLearnersRowsResult,
  ] = await Promise.allSettled([
    coursesCollection(db).countDocuments({
      tenantId: params.tenantId,
      status: "published",
    }),
    modulesCollection(db).countDocuments({
      tenantId: params.tenantId,
      isPublished: true,
    }),
    lessonsCollection(db).countDocuments({
      tenantId: params.tenantId,
      isPublished: true,
    }),
    enrollmentsCollection(db).countDocuments({
      tenantId: params.tenantId,
      status: "active",
    }),
    progressEventsCollection(db).countDocuments({
      tenantId: params.tenantId,
      occurredAt: { $gte: recentStart },
    }),
    progressEventsCollection(db)
      .aggregate<{ count: number }>([
        {
          $match: {
            tenantId: params.tenantId,
            occurredAt: { $gte: recentStart },
          },
        },
        {
          $group: {
            _id: "$userId",
          },
        },
        {
          $count: "count",
        },
      ])
      .toArray(),
  ]);

  const publishedCourses =
    publishedCoursesResult.status === "fulfilled"
      ? publishedCoursesResult.value
      : 0;
  const publishedModules =
    publishedModulesResult.status === "fulfilled"
      ? publishedModulesResult.value
      : 0;
  const publishedLessons =
    publishedLessonsResult.status === "fulfilled"
      ? publishedLessonsResult.value
      : 0;
  const activeEnrollments =
    activeEnrollmentsResult.status === "fulfilled"
      ? activeEnrollmentsResult.value
      : 0;
  const recentProgressEvents =
    recentProgressEventsResult.status === "fulfilled"
      ? recentProgressEventsResult.value
      : 0;
  const activeLearnersRows =
    activeLearnersRowsResult.status === "fulfilled"
      ? activeLearnersRowsResult.value
      : [];

  const activeLearners = activeLearnersRows[0]?.count ?? 0;
  const topology = {
    activeNodes: publishedCourses + publishedModules + publishedLessons,
    latencyMs: Math.max(5, Date.now() - startedAt),
  };

  const statusStrip: DashboardStatusStripItem[] = [
    { label: "COURSES", value: `${publishedCourses} Live`, ok: publishedCourses > 0 },
    { label: "MODULES", value: `${publishedModules} Active`, ok: publishedModules > 0 },
    { label: "LESSONS", value: `${publishedLessons} Published`, ok: publishedLessons > 0 },
    { label: "ENROLLMENTS", value: `${activeEnrollments} Active`, ok: activeEnrollments > 0 },
    { label: "7D EVENTS", value: `${recentProgressEvents} Logged`, ok: recentProgressEvents > 0 },
    { label: "LEARNERS", value: `${activeLearners} Active`, ok: activeLearners > 0 },
  ];

  return {
    tenantId: params.tenantId,
    generatedAt: now.toISOString(),
    topCourses,
    moduleRegistry,
    topology,
    statusStrip,
  };
}
