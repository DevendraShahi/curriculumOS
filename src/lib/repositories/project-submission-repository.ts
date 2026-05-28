import { ObjectId, type Db } from "mongodb";
import { projectSubmissionsCollection } from "@/lib/db/collections";
import type {
  ProjectSubmissionDocument,
  ProjectSubmissionStatus,
} from "@/lib/db/models";

export async function createProjectSubmission(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    courseId: ObjectId;
    moduleId: ObjectId;
    lessonId?: ObjectId | string;
    projectId: ObjectId;
    enrollmentId?: ObjectId | null;
    summary?: string;
    repositoryUrl?: string;
    liveUrl?: string;
    notes?: string;
  }
): Promise<ProjectSubmissionDocument> {
  const now = new Date();

  const document: ProjectSubmissionDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    courseId: params.courseId,
    moduleId: params.moduleId,
    lessonId: params.lessonId,
    projectId: params.projectId,
    enrollmentId: params.enrollmentId ?? null,
    status: "submitted",
    summary: params.summary,
    repositoryUrl: params.repositoryUrl,
    liveUrl: params.liveUrl,
    notes: params.notes,
    rubricScores: [],
    submittedAt: now,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await projectSubmissionsCollection(db).insertOne(document);
  return document;
}

export async function listProjectSubmissionsByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    projectId?: ObjectId;
    limit?: number;
  }
): Promise<ProjectSubmissionDocument[]> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

  return projectSubmissionsCollection(db)
    .find({
      tenantId: params.tenantId,
      userId: params.userId,
      ...(params.projectId ? { projectId: params.projectId } : {}),
    })
    .sort({ submittedAt: -1, _id: -1 })
    .limit(limit)
    .toArray();
}

export async function countProjectSubmissionsByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
  }
): Promise<number> {
  return projectSubmissionsCollection(db).countDocuments({
    tenantId: params.tenantId,
    userId: params.userId,
  });
}

export async function getLatestProjectSubmissionByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    projectId: ObjectId;
  }
): Promise<ProjectSubmissionDocument | null> {
  return projectSubmissionsCollection(db).findOne(
    {
      tenantId: params.tenantId,
      userId: params.userId,
      projectId: params.projectId,
    },
    { sort: { submittedAt: -1, _id: -1 } }
  );
}

export async function countProjectSubmissionsByStatus(
  db: Db,
  params: {
    tenantId: string;
    projectId: ObjectId;
  }
): Promise<Record<ProjectSubmissionStatus, number>> {
  const rows = await projectSubmissionsCollection(db)
    .aggregate<{ _id: ProjectSubmissionStatus; count: number }>([
      {
        $match: {
          tenantId: params.tenantId,
          projectId: params.projectId,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const base: Record<ProjectSubmissionStatus, number> = {
    submitted: 0,
    under_review: 0,
    approved: 0,
    changes_requested: 0,
  };

  for (const row of rows) {
    base[row._id] = row.count;
  }

  return base;
}
