import { type Db, MongoServerError, ObjectId } from "mongodb";
import {
  progressWriteIdempotencyCollection,
  progressWriteRateLimitsCollection,
} from "@/lib/db/collections";
import type {
  ProgressWriteIdempotencyDocument,
  ProgressWriteIdempotencyScope,
} from "@/lib/db/models";

const RATE_LIMIT_SCOPE: ProgressWriteIdempotencyScope = "api_v1_progress_post";

function toUserHex(userId: ObjectId): string {
  return userId.toHexString();
}

function buildIdempotencyRecordId(params: {
  tenantId: string;
  userId: ObjectId;
  scope: ProgressWriteIdempotencyScope;
  key: string;
}): string {
  return `${params.scope}:${params.tenantId}:${toUserHex(params.userId)}:${params.key}`;
}

export async function beginProgressWriteIdempotency(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    key: string;
    requestHash: string;
    expiresAt: Date;
    scope?: ProgressWriteIdempotencyScope;
  }
): Promise<
  | {
      kind: "start";
      recordId: string;
      key: string;
    }
  | {
      kind: "replay";
      key: string;
      responseData: Record<string, unknown>;
    }
> {
  const scope = params.scope ?? RATE_LIMIT_SCOPE;
  const key = params.key;
  const now = new Date();
  const recordId = buildIdempotencyRecordId({
    tenantId: params.tenantId,
    userId: params.userId,
    scope,
    key,
  });

  const pendingRecord: ProgressWriteIdempotencyDocument = {
    _id: recordId,
    tenantId: params.tenantId,
    userId: params.userId,
    scope,
    key,
    requestHash: params.requestHash,
    status: "pending",
    expiresAt: params.expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await progressWriteIdempotencyCollection(db).insertOne(pendingRecord);
    return { kind: "start", recordId, key };
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }
  }

  const existing = await progressWriteIdempotencyCollection(db).findOne({
    _id: recordId,
  });
  if (!existing) {
    throw new Error("IDEMPOTENCY_REQUEST_IN_PROGRESS");
  }

  if (existing.requestHash !== params.requestHash) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }

  if (existing.status === "completed" && existing.responseData) {
    return {
      kind: "replay",
      key,
      responseData: existing.responseData,
    };
  }

  throw new Error("IDEMPOTENCY_REQUEST_IN_PROGRESS");
}

export async function completeProgressWriteIdempotency(
  db: Db,
  params: {
    recordId: string;
    responseData: Record<string, unknown>;
  }
): Promise<void> {
  await progressWriteIdempotencyCollection(db).updateOne(
    {
      _id: params.recordId,
      status: "pending",
    },
    {
      $set: {
        status: "completed",
        responseData: params.responseData,
        updatedAt: new Date(),
      },
    }
  );
}

export async function abortProgressWriteIdempotency(
  db: Db,
  recordId: string
): Promise<void> {
  await progressWriteIdempotencyCollection(db).deleteOne({
    _id: recordId,
    status: "pending",
  });
}

export async function consumeProgressWriteRateLimit(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    limit: number;
    windowMs: number;
    scope?: ProgressWriteIdempotencyScope;
  }
): Promise<{
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
}> {
  const scope = params.scope ?? RATE_LIMIT_SCOPE;
  const nowMs = Date.now();
  const windowMs = Math.max(1_000, params.windowMs);
  const windowStartMs = nowMs - (nowMs % windowMs);
  const resetAt = new Date(windowStartMs + windowMs);
  const bucketId = `${scope}:${params.tenantId}:${toUserHex(params.userId)}:${windowStartMs}`;
  const now = new Date(nowMs);

  const bucket = await progressWriteRateLimitsCollection(db).findOneAndUpdate(
    { _id: bucketId },
    {
      $setOnInsert: {
        _id: bucketId,
        tenantId: params.tenantId,
        userId: params.userId,
        scope,
        windowStartMs,
        createdAt: now,
      },
      $inc: { count: 1 },
      $set: {
        updatedAt: now,
        expiresAt: new Date(windowStartMs + 10 * windowMs),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!bucket) {
    throw new Error("RATE_LIMITED_PROGRESS_WRITE");
  }

  const limit = Math.max(1, params.limit);
  const count = bucket.count;
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count <= limit,
    count,
    remaining,
    resetAt,
  };
}
