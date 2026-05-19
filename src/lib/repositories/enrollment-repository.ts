import { ObjectId, type Db } from "mongodb";
import { enrollmentsCollection } from "@/lib/db/collections";
import type { EnrollmentDocument, EnrollmentStatus } from "@/lib/db/models";

export async function getEnrollment(
  db: Db,
  tenantId: string,
  userId: ObjectId,
  courseId: ObjectId
): Promise<EnrollmentDocument | null> {
  return enrollmentsCollection(db).findOne({
    tenantId,
    userId,
    courseId,
  });
}

export async function upsertEnrollment(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    courseId: ObjectId;
    source?: EnrollmentDocument["source"];
  }
): Promise<EnrollmentDocument> {
  const now = new Date();

  const document = await enrollmentsCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      userId: params.userId,
      courseId: params.courseId,
    },
    {
      $set: {
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: params.tenantId,
        userId: params.userId,
        courseId: params.courseId,
        status: "active" as EnrollmentStatus,
        enrolledAt: now,
        progressPercent: 0,
        source: params.source ?? "direct",
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!document) throw new Error("Failed to upsert enrollment");
  return document;
}

export async function listEnrollmentsByUser(
  db: Db,
  tenantId: string,
  userId: ObjectId
): Promise<EnrollmentDocument[]> {
  return enrollmentsCollection(db)
    .find({ tenantId, userId })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function countEnrollmentsByStatus(
  db: Db,
  tenantId: string,
  userId: ObjectId
): Promise<Record<EnrollmentStatus, number>> {
  const rows = await enrollmentsCollection(db)
    .aggregate<{ _id: EnrollmentStatus; count: number }>([
      { $match: { tenantId, userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();

  const base: Record<EnrollmentStatus, number> = {
    active: 0,
    completed: 0,
    paused: 0,
    dropped: 0,
  };

  for (const row of rows) {
    base[row._id] = row.count;
  }

  return base;
}

export async function updateEnrollmentProgress(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    courseId: ObjectId;
    progressPercent: number;
    lastLessonId?: string | null;
    lastLessonRefId?: ObjectId | null;
    completedAt?: Date | null;
  }
): Promise<void> {
  const now = new Date();

  await enrollmentsCollection(db).updateOne(
    {
      tenantId: params.tenantId,
      userId: params.userId,
      courseId: params.courseId,
    },
    {
      $set: {
        progressPercent: params.progressPercent,
        lastLessonId: params.lastLessonId ?? null,
        lastLessonRefId: params.lastLessonRefId ?? null,
        status: params.progressPercent >= 100 ? "completed" : "active",
        completedAt:
          params.progressPercent >= 100 ? params.completedAt ?? now : null,
        updatedAt: now,
      },
    }
  );
}
