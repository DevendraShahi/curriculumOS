import { ObjectId, type Db } from "mongodb";
import { progressCollection } from "@/lib/db/collections";
import type { ProgressDocument, ProgressState } from "@/lib/db/models";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function upsertLessonProgress(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    courseId: ObjectId;
    lessonId: string;
    lessonRefId?: ObjectId | null;
    moduleId?: string | null;
    moduleRefId?: ObjectId | null;
    enrollmentId?: ObjectId | null;
    state?: ProgressState;
    progressPercent?: number;
    timeSpentSeconds?: number;
  }
): Promise<ProgressDocument> {
  const now = new Date();
  const progressPercent = clampPercent(params.progressPercent ?? 0);
  const state =
    params.state ??
    (progressPercent >= 100 ? "completed" : progressPercent > 0 ? "in_progress" : "not_started");

  const update: Record<string, unknown> = {
    moduleId: params.moduleId ?? null,
    moduleRefId: params.moduleRefId ?? null,
    lessonRefId: params.lessonRefId ?? null,
    enrollmentId: params.enrollmentId ?? null,
    state,
    progressPercent,
    updatedAt: now,
    lastActivityAt: now,
  };

  if (typeof params.timeSpentSeconds === "number") {
    update.timeSpentSeconds = Math.max(0, Math.floor(params.timeSpentSeconds));
  }

  if (state === "completed") {
    update.completedAt = now;
  } else if (state === "in_progress") {
    update.startedAt = now;
  }

  const document = await progressCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      userId: params.userId,
      lessonId: params.lessonId,
    },
    {
      $set: update,
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: params.tenantId,
        userId: params.userId,
        courseId: params.courseId,
        lessonId: params.lessonId,
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!document) throw new Error("Failed to upsert lesson progress");
  return document;
}

export async function listProgressByUser(
  db: Db,
  tenantId: string,
  userId: ObjectId,
  courseId?: ObjectId
): Promise<ProgressDocument[]> {
  return progressCollection(db)
    .find({
      tenantId,
      userId,
      ...(courseId ? { courseId } : {}),
    })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function getProgressByUserLesson(
  db: Db,
  tenantId: string,
  userId: ObjectId,
  lessonId: string
): Promise<ProgressDocument | null> {
  return progressCollection(db).findOne({
    tenantId,
    userId,
    lessonId,
  });
}

export async function summarizeProgress(
  db: Db,
  tenantId: string,
  userId: ObjectId,
  courseId?: ObjectId
): Promise<{
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  completionPercent: number;
}> {
  const rows = await progressCollection(db)
    .aggregate<{ _id: ProgressState; count: number }>([
      {
        $match: {
          tenantId,
          userId,
          ...(courseId ? { courseId } : {}),
        },
      },
      {
        $group: {
          _id: "$state",
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  let totalLessons = 0;
  let completedLessons = 0;
  let inProgressLessons = 0;

  for (const row of rows) {
    totalLessons += row.count;
    if (row._id === "completed") completedLessons += row.count;
    if (row._id === "in_progress") inProgressLessons += row.count;
  }

  const completionPercent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return {
    totalLessons,
    completedLessons,
    inProgressLessons,
    completionPercent,
  };
}

export async function countProgressByState(
  db: Db,
  tenantId: string,
  userId: ObjectId,
  state: ProgressState,
  courseId?: ObjectId
): Promise<number> {
  return progressCollection(db).countDocuments({
    tenantId,
    userId,
    state,
    ...(courseId ? { courseId } : {}),
  });
}

export async function countProgressByStateAcrossCourses(
  db: Db,
  tenantId: string,
  userId: ObjectId,
  state: ProgressState,
  courseIds: ObjectId[]
): Promise<number> {
  if (courseIds.length === 0) return 0;

  return progressCollection(db).countDocuments({
    tenantId,
    userId,
    state,
    courseId: { $in: courseIds },
  });
}
