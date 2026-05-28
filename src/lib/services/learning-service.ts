import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { coursesCollection, lessonsCollection } from "@/lib/db/collections";
import { getCourseByIdOrSlug } from "@/lib/repositories/course-repository";
import {
  abortProgressWriteIdempotency,
  beginProgressWriteIdempotency,
  completeProgressWriteIdempotency,
  consumeProgressWriteRateLimit,
} from "@/lib/repositories/progress-write-guard-repository";
import {
  getEnrollment,
  listEnrollmentsByUser,
  updateEnrollmentProgress,
  upsertEnrollment,
} from "@/lib/repositories/enrollment-repository";
import {
  countProgressByState,
  countProgressByStateAcrossCourses,
  getProgressByUserLesson,
  listProgressByUser,
  upsertLessonProgress,
} from "@/lib/repositories/progress-repository";
import { createProgressEvent } from "@/lib/repositories/progress-event-repository";
import {
  countPublishedLessonsByCourse,
  countPublishedLessonsByCourses,
} from "@/lib/repositories/syllabus-repository";
import { getMongoDb } from "@/lib/mongodb";
import { serverEnv } from "@/lib/server-env";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";
import type { ProgressDocument, ProgressEventType } from "@/lib/db/models";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseOptionalObjectId(value: string | undefined): ObjectId | undefined {
  if (!value) return undefined;
  if (!ObjectId.isValid(value)) {
    throw new Error("INVALID_OBJECT_ID");
  }
  return new ObjectId(value);
}

function resolveProgressEventType(params: {
  previous: ProgressDocument | null;
  next: ProgressDocument;
}): ProgressEventType | null {
  const { previous, next } = params;
  if (!previous) {
    if (next.state === "completed") return "lesson_completed";
    if (next.state === "in_progress") return "lesson_started";
    if (next.progressPercent > 0) return "lesson_progressed";
    return null;
  }

  if (previous.state !== "completed" && next.state === "completed") {
    return "lesson_completed";
  }
  if (previous.state === "completed" && next.state !== "completed") {
    return "lesson_reopened";
  }
  if (previous.state === "not_started" && next.state === "in_progress") {
    return "lesson_started";
  }

  const stateChanged = previous.state !== next.state;
  const progressChanged = previous.progressPercent !== next.progressPercent;
  const previousTime = previous.timeSpentSeconds ?? 0;
  const nextTime = next.timeSpentSeconds ?? 0;
  const timeChanged = previousTime !== nextTime;

  return stateChanged || progressChanged || timeChanged
    ? "lesson_progressed"
    : null;
}

type ProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  completionPercent: number;
};

type ProgressWriteResult = {
  progress: {
    id: string;
    courseId: string;
    lessonId: string;
    moduleId: string | null;
    state: "not_started" | "in_progress" | "completed";
    progressPercent: number;
    timeSpentSeconds: number;
    updatedAt: string;
  };
  summary: ProgressSummary;
  meta: {
    idempotency: {
      key: string;
      replayed: boolean;
      mode: "explicit" | "auto";
    };
    rateLimit?: {
      limitPerMinute: number;
      count: number;
      remaining: number;
      resetAt: string;
    };
  };
};

const AUTO_IDEMPOTENCY_WINDOW_MS = 30_000;
const EXPLICIT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const AUTO_IDEMPOTENCY_TTL_MS = 2 * 60 * 1_000;

function clampTimeSpentSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) return undefined;
  if (normalized.length < 8 || normalized.length > 128) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }
  return normalized;
}

function buildProgressRequestHash(params: {
  courseId: string;
  lessonId: string;
  moduleId: string;
  state?: "not_started" | "in_progress" | "completed";
  progressPercent?: number;
  timeSpentSeconds?: number;
}): string {
  const payload = JSON.stringify({
    courseId: params.courseId,
    lessonId: params.lessonId,
    moduleId: params.moduleId,
    state: params.state ?? null,
    progressPercent:
      typeof params.progressPercent === "number"
        ? clampPercent(params.progressPercent)
        : null,
    timeSpentSeconds:
      typeof params.timeSpentSeconds === "number"
        ? clampTimeSpentSeconds(params.timeSpentSeconds)
        : null,
  });

  return createHash("sha256").update(payload).digest("hex");
}

async function resolvePublishedLessonInCourse(params: {
  db: Db;
  tenantId: string;
  courseId: ObjectId;
  lessonIdOrSlug: string;
  requestedModuleId?: string;
}): Promise<{
  lessonId: string;
  lessonRefId: ObjectId;
  moduleId: string;
  moduleRefId: ObjectId;
}> {
  const lookup = params.lessonIdOrSlug.trim();
  const byObjectId = ObjectId.isValid(lookup) ? new ObjectId(lookup) : null;

  const lesson = await lessonsCollection(params.db).findOne({
    tenantId: params.tenantId,
    courseId: params.courseId,
    isPublished: true,
    $or: [
      { slug: lookup },
      ...(byObjectId ? [{ _id: byObjectId }] : []),
    ],
  });

  if (!lesson) {
    throw new Error("LESSON_NOT_IN_COURSE");
  }

  const moduleId = lesson.moduleId.toString();
  const requestedModuleId = params.requestedModuleId?.trim();
  if (requestedModuleId && requestedModuleId !== moduleId) {
    throw new Error("LESSON_NOT_IN_COURSE");
  }

  return {
    lessonId: lesson._id.toString(),
    lessonRefId: lesson._id,
    moduleId,
    moduleRefId: lesson.moduleId,
  };
}

function makeProgressWriteResponse(params: {
  progress: ProgressDocument;
  summary: ProgressSummary;
  idempotency: {
    key: string;
    replayed: boolean;
    mode: "explicit" | "auto";
  };
  rateLimit?: {
    limitPerMinute: number;
    count: number;
    remaining: number;
    resetAt: string;
  };
}): ProgressWriteResult {
  return {
    progress: {
      id: params.progress._id.toString(),
      courseId: params.progress.courseId.toString(),
      lessonId: params.progress.lessonId,
      moduleId: params.progress.moduleId ?? null,
      state: params.progress.state,
      progressPercent: params.progress.progressPercent,
      timeSpentSeconds: params.progress.timeSpentSeconds ?? 0,
      updatedAt: params.progress.updatedAt.toISOString(),
    },
    summary: params.summary,
    meta: {
      idempotency: params.idempotency,
      ...(params.rateLimit ? { rateLimit: params.rateLimit } : {}),
    },
  };
}

function makeProgressSummary(params: {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
}): ProgressSummary {
  const totalLessons = Math.max(0, params.totalLessons);
  const completedLessons = Math.max(0, params.completedLessons);
  const inProgressLessons = Math.max(0, params.inProgressLessons);

  return {
    totalLessons,
    completedLessons,
    inProgressLessons,
    completionPercent:
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
  };
}

async function summarizeCourseProgressByLessonTotals(params: {
  db: Db;
  tenantId: string;
  userId: ObjectId;
  courseId: ObjectId;
}): Promise<ProgressSummary> {
  const [totalLessons, completedLessons, inProgressLessons] = await Promise.all([
    countPublishedLessonsByCourse(
      params.db,
      params.tenantId,
      params.courseId
    ),
    countProgressByState(
      params.db,
      params.tenantId,
      params.userId,
      "completed",
      params.courseId
    ),
    countProgressByState(
      params.db,
      params.tenantId,
      params.userId,
      "in_progress",
      params.courseId
    ),
  ]);

  return makeProgressSummary({
    totalLessons,
    completedLessons,
    inProgressLessons,
  });
}

export async function enrollCurrentActor(
  actor: ActorContext,
  params: { courseId: string; source?: "direct" | "cohort" | "coupon" | "admin" }
) {
  if (!ObjectId.isValid(params.courseId)) {
    throw new Error("INVALID_COURSE_ID");
  }

  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const courseId = new ObjectId(params.courseId);

  const course = await getCourseByIdOrSlug(db, actor.tenantId, params.courseId);
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }
  if (course.status !== "published") {
    throw new Error("COURSE_NOT_ENROLLABLE");
  }

  const planHierarchy = { free: 0, pro: 1, teams: 2 };
  const userPlanValue = planHierarchy[user.plan ?? "free"];
  const courseTierValue = planHierarchy[course.tier ?? "free"];

  if (userPlanValue < courseTierValue) {
    throw new Error("INSUFFICIENT_PLAN_TIER");
  }

  const enrollment = await upsertEnrollment(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    courseId,
    source: params.source ?? "direct",
  });

  return {
    id: enrollment._id.toString(),
    tenantId: enrollment.tenantId,
    userId: enrollment.userId.toString(),
    courseId: enrollment.courseId.toString(),
    status: enrollment.status,
    progressPercent: enrollment.progressPercent,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    updatedAt: enrollment.updatedAt.toISOString(),
  };
}

export async function listCurrentActorEnrollments(actor: ActorContext) {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const enrollments = await listEnrollmentsByUser(db, actor.tenantId, user._id);

  const courseIds = enrollments.map((item) => item.courseId);
  const courses = await coursesCollection(db)
    .find({
      tenantId: actor.tenantId,
      _id: { $in: courseIds },
    })
    .toArray();

  const courseMap = new Map(courses.map((course) => [course._id.toString(), course]));

  return enrollments.map((enrollment) => {
    const course = courseMap.get(enrollment.courseId.toString());
    return {
      id: enrollment._id.toString(),
      courseId: enrollment.courseId.toString(),
      status: enrollment.status,
      progressPercent: enrollment.progressPercent,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      updatedAt: enrollment.updatedAt.toISOString(),
      course: course
        ? {
            id: course._id.toString(),
            slug: course.slug,
            title: course.title,
            summary: course.summary,
            category: course.category ?? "",
            durationMinutes: course.durationMinutes,
            lessonsCount: course.lessonsCount,
          }
        : null,
    };
  });
}

export async function upsertCurrentActorLessonProgress(
  actor: ActorContext,
  params: {
    courseId: string;
    lessonId: string;
    moduleId?: string;
    idempotencyKey?: string;
    state?: "not_started" | "in_progress" | "completed";
    progressPercent?: number;
    timeSpentSeconds?: number;
  }
): Promise<ProgressWriteResult> {
  if (!ObjectId.isValid(params.courseId)) {
    throw new Error("INVALID_COURSE_ID");
  }
  if (!params.lessonId.trim()) {
    throw new Error("INVALID_LESSON_ID");
  }

  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const courseId = new ObjectId(params.courseId);

  const enrollment = await getEnrollment(db, actor.tenantId, user._id, courseId);
  if (!enrollment) {
    throw new Error("ENROLLMENT_REQUIRED");
  }

  const resolvedLesson = await resolvePublishedLessonInCourse({
    db,
    tenantId: actor.tenantId,
    courseId,
    lessonIdOrSlug: params.lessonId.trim(),
    requestedModuleId: params.moduleId,
  });

  const explicitIdempotencyKey = normalizeIdempotencyKey(params.idempotencyKey);
  const idempotencyMode: "explicit" | "auto" = explicitIdempotencyKey
    ? "explicit"
    : "auto";

  const requestHash = buildProgressRequestHash({
    courseId: courseId.toString(),
    lessonId: resolvedLesson.lessonId,
    moduleId: resolvedLesson.moduleId,
    state: params.state,
    progressPercent: params.progressPercent,
    timeSpentSeconds: params.timeSpentSeconds,
  });

  const idempotencyKey =
    explicitIdempotencyKey ??
    `auto:${Math.floor(Date.now() / AUTO_IDEMPOTENCY_WINDOW_MS)}:${requestHash.slice(
      0,
      24
    )}`;
  const idempotencyTtlMs =
    idempotencyMode === "explicit"
      ? EXPLICIT_IDEMPOTENCY_TTL_MS
      : AUTO_IDEMPOTENCY_TTL_MS;

  const idempotency = await beginProgressWriteIdempotency(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    key: idempotencyKey,
    requestHash,
    expiresAt: new Date(Date.now() + idempotencyTtlMs),
  });

  if (idempotency.kind === "replay") {
    const cached = idempotency.responseData as Partial<ProgressWriteResult>;
    if (!cached.progress || !cached.summary) {
      throw new Error("IDEMPOTENCY_REQUEST_IN_PROGRESS");
    }

    return {
      ...(cached as ProgressWriteResult),
      meta: {
        ...(cached.meta ?? {
          idempotency: {
            key: idempotency.key,
            replayed: true,
            mode: idempotencyMode,
          },
        }),
        idempotency: {
          key: idempotency.key,
          replayed: true,
          mode: idempotencyMode,
        },
      },
    };
  }

  let idempotencyRecordId: string | null = idempotency.recordId;
  try {
    const rateLimit = await consumeProgressWriteRateLimit(db, {
      tenantId: actor.tenantId,
      userId: user._id,
      limit: serverEnv.PROGRESS_WRITE_RATE_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new Error("RATE_LIMITED_PROGRESS_WRITE");
    }

    const lessonId = resolvedLesson.lessonId;
    const previousProgress = await getProgressByUserLesson(
      db,
      actor.tenantId,
      user._id,
      lessonId
    );

    const progress = await upsertLessonProgress(db, {
      tenantId: actor.tenantId,
      userId: user._id,
      courseId,
      lessonId,
      lessonRefId: resolvedLesson.lessonRefId,
      moduleId: resolvedLesson.moduleId,
      moduleRefId: resolvedLesson.moduleRefId,
      enrollmentId: enrollment._id,
      state: params.state,
      progressPercent: params.progressPercent,
      timeSpentSeconds: params.timeSpentSeconds,
    });

    const eventType = resolveProgressEventType({
      previous: previousProgress,
      next: progress,
    });
    if (eventType) {
      await createProgressEvent(db, {
        tenantId: actor.tenantId,
        userId: user._id,
        courseId,
        lessonId,
        lessonRefId: progress.lessonRefId ?? resolvedLesson.lessonRefId,
        moduleId: progress.moduleId ?? null,
        moduleRefId: progress.moduleRefId ?? resolvedLesson.moduleRefId,
        enrollmentId: enrollment._id,
        eventType,
        current: progress,
        previous: previousProgress,
        source: "api_v1_progress",
        occurredAt: progress.lastActivityAt ?? progress.updatedAt,
      });
    }

    const summary = await summarizeCourseProgressByLessonTotals({
      db,
      tenantId: actor.tenantId,
      userId: user._id,
      courseId,
    });

    await updateEnrollmentProgress(db, {
      tenantId: actor.tenantId,
      userId: user._id,
      courseId,
      progressPercent: clampPercent(summary.completionPercent),
      lastLessonId: progress.lessonId,
      lastLessonRefId: progress.lessonRefId ?? resolvedLesson.lessonRefId,
      completedAt: summary.completionPercent >= 100 ? new Date() : null,
    });

    const response = makeProgressWriteResponse({
      progress,
      summary,
      idempotency: {
        key: idempotencyKey,
        replayed: false,
        mode: idempotencyMode,
      },
      rateLimit: {
        limitPerMinute: serverEnv.PROGRESS_WRITE_RATE_LIMIT_PER_MINUTE,
        count: rateLimit.count,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt.toISOString(),
      },
    });

    await completeProgressWriteIdempotency(db, {
      recordId: idempotency.recordId,
      responseData: response as unknown as Record<string, unknown>,
    });
    idempotencyRecordId = null;

    return response;
  } catch (error) {
    if (idempotencyRecordId) {
      await abortProgressWriteIdempotency(db, idempotencyRecordId).catch(() => {});
    }
    throw error;
  }
}

export async function getCurrentActorProgress(
  actor: ActorContext,
  params: { courseId?: string }
) {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const courseId = parseOptionalObjectId(params.courseId);

  const itemsPromise = listProgressByUser(db, actor.tenantId, user._id, courseId);
  let summary: ProgressSummary;

  if (courseId) {
    summary = await summarizeCourseProgressByLessonTotals({
      db,
      tenantId: actor.tenantId,
      userId: user._id,
      courseId,
    });
  } else {
    const enrollments = await listEnrollmentsByUser(db, actor.tenantId, user._id);
    const courseIds = enrollments.map((enrollment) => enrollment.courseId);

    const [lessonTotalsByCourse, completedLessons, inProgressLessons] =
      await Promise.all([
        countPublishedLessonsByCourses(db, actor.tenantId, courseIds),
        countProgressByStateAcrossCourses(
          db,
          actor.tenantId,
          user._id,
          "completed",
          courseIds
        ),
        countProgressByStateAcrossCourses(
          db,
          actor.tenantId,
          user._id,
          "in_progress",
          courseIds
        ),
      ]);

    const totalLessons = Array.from(lessonTotalsByCourse.values()).reduce(
      (total, value) => total + value,
      0
    );

    summary = makeProgressSummary({
      totalLessons,
      completedLessons,
      inProgressLessons,
    });
  }

  const items = await itemsPromise;

  return {
    summary,
    items: items.map((item) => ({
      id: item._id.toString(),
      courseId: item.courseId.toString(),
      lessonId: item.lessonId,
      moduleId: item.moduleId ?? null,
      state: item.state,
      progressPercent: item.progressPercent,
      timeSpentSeconds: item.timeSpentSeconds ?? 0,
      lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}
