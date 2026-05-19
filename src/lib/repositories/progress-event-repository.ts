import { ObjectId, type Db } from "mongodb";
import { progressEventsCollection } from "@/lib/db/collections";
import type {
  ProgressDocument,
  ProgressEventDocument,
  ProgressEventType,
} from "@/lib/db/models";

export async function createProgressEvent(
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
    eventType: ProgressEventType;
    current: ProgressDocument;
    previous?: ProgressDocument | null;
    source?: "api_v1_progress" | "backfill_progress_snapshot_v1";
    occurredAt?: Date;
  }
): Promise<ProgressEventDocument> {
  const occurredAt = params.occurredAt ?? params.current.lastActivityAt ?? new Date();
  const now = new Date();
  const currentTime = params.current.timeSpentSeconds ?? 0;
  const previousTime = params.previous?.timeSpentSeconds ?? 0;

  const event: ProgressEventDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    courseId: params.courseId,
    lessonId: params.lessonId,
    lessonRefId: params.lessonRefId ?? params.current.lessonRefId ?? null,
    moduleId: params.moduleId ?? params.current.moduleId ?? null,
    moduleRefId: params.moduleRefId ?? params.current.moduleRefId ?? null,
    enrollmentId: params.enrollmentId ?? params.current.enrollmentId ?? null,
    eventType: params.eventType,
    state: params.current.state,
    progressPercent: params.current.progressPercent,
    progressDelta:
      params.current.progressPercent - (params.previous?.progressPercent ?? 0),
    timeSpentSeconds: currentTime,
    timeSpentDelta: currentTime - previousTime,
    occurredAt,
    metadata: params.source ? { source: params.source } : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await progressEventsCollection(db).insertOne(event);
  return event;
}

export async function listProgressEventsByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    courseId?: ObjectId;
    startAt?: Date;
    endAt?: Date;
    limit?: number;
  }
): Promise<ProgressEventDocument[]> {
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 5000);
  const occurredAtFilter: Record<string, Date> = {};
  if (params.startAt) occurredAtFilter.$gte = params.startAt;
  if (params.endAt) occurredAtFilter.$lte = params.endAt;

  return progressEventsCollection(db)
    .find({
      tenantId: params.tenantId,
      userId: params.userId,
      ...(params.courseId ? { courseId: params.courseId } : {}),
      ...(Object.keys(occurredAtFilter).length > 0
        ? { occurredAt: occurredAtFilter }
        : {}),
    })
    .sort({ occurredAt: -1 })
    .limit(limit)
    .toArray();
}
