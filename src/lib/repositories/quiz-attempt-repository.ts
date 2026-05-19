import { MongoServerError, ObjectId, type Db } from "mongodb";
import { quizAttemptsCollection } from "@/lib/db/collections";
import type { QuizAttemptDocument } from "@/lib/db/models";

export async function createQuizAttempt(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    courseId: ObjectId;
    lessonId: ObjectId;
    quizId: ObjectId;
    enrollmentId?: ObjectId | null;
    scorePercent: number;
    passed: boolean;
    answers: number[];
    durationSeconds?: number;
    idempotencyKey?: string;
    requestHash?: string;
  }
): Promise<{ attempt: QuizAttemptDocument; replayed: boolean }> {
  const now = new Date();

  if (params.idempotencyKey) {
    const existing = await quizAttemptsCollection(db).findOne({
      tenantId: params.tenantId,
      userId: params.userId,
      quizId: params.quizId,
      idempotencyKey: params.idempotencyKey,
    });

    if (existing) {
      if (
        existing.requestHash &&
        params.requestHash &&
        existing.requestHash !== params.requestHash
      ) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }

      return { attempt: existing, replayed: true };
    }
  }

  const attempt: QuizAttemptDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    courseId: params.courseId,
    lessonId: params.lessonId,
    quizId: params.quizId,
    enrollmentId: params.enrollmentId ?? null,
    scorePercent: params.scorePercent,
    passed: params.passed,
    answers: params.answers,
    durationSeconds: Math.max(0, Math.floor(params.durationSeconds ?? 0)),
    submittedAt: now,
    idempotencyKey: params.idempotencyKey,
    requestHash: params.requestHash,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await quizAttemptsCollection(db).insertOne(attempt);
    return { attempt, replayed: false };
  } catch (error) {
    if (
      !params.idempotencyKey ||
      !(error instanceof MongoServerError) ||
      error.code !== 11000
    ) {
      throw error;
    }
  }

  const existing = await quizAttemptsCollection(db).findOne({
    tenantId: params.tenantId,
    userId: params.userId,
    quizId: params.quizId,
    idempotencyKey: params.idempotencyKey,
  });

  if (!existing) {
    throw new Error("INTERNAL_ERROR");
  }

  if (
    existing.requestHash &&
    params.requestHash &&
    existing.requestHash !== params.requestHash
  ) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }

  return { attempt: existing, replayed: true };
}

export async function getLatestQuizAttemptByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    quizId: ObjectId;
  }
): Promise<QuizAttemptDocument | null> {
  return quizAttemptsCollection(db).findOne(
    {
      tenantId: params.tenantId,
      userId: params.userId,
      quizId: params.quizId,
    },
    { sort: { submittedAt: -1, _id: -1 } }
  );
}

export async function countQuizAttemptsByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    quizId: ObjectId;
  }
): Promise<number> {
  return quizAttemptsCollection(db).countDocuments({
    tenantId: params.tenantId,
    userId: params.userId,
    quizId: params.quizId,
  });
}

export async function countQuizAttemptsByUserInTenant(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
  }
): Promise<number> {
  return quizAttemptsCollection(db).countDocuments({
    tenantId: params.tenantId,
    userId: params.userId,
  });
}
