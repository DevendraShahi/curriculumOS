import { ObjectId, type Db, type Filter } from "mongodb";
import { playgroundRunsCollection } from "@/lib/db/collections";
import type { PlaygroundRunDocument } from "@/lib/db/models";

export type PlaygroundRunsCursor = {
  createdAt: Date;
  id: ObjectId;
};

export async function createPlaygroundRun(
  db: Db,
  params: {
    tenantId: string;
    sessionId: ObjectId;
    userId: ObjectId;
    mode: PlaygroundRunDocument["mode"];
    runtime: string;
    status: PlaygroundRunDocument["status"];
    exitCode?: number | null;
    summary?: string;
    rawLog?: string;
    checks?: PlaygroundRunDocument["checks"];
    startedAt?: Date | null;
    finishedAt?: Date | null;
    durationMs?: number | null;
  }
): Promise<PlaygroundRunDocument> {
  const now = new Date();
  const document: PlaygroundRunDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    userId: params.userId,
    mode: params.mode,
    status: params.status,
    runtime: params.runtime,
    exitCode: params.exitCode ?? null,
    summary: params.summary,
    rawLog: params.rawLog,
    checks: params.checks,
    startedAt: params.startedAt ?? null,
    finishedAt: params.finishedAt ?? null,
    durationMs: params.durationMs ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await playgroundRunsCollection(db).insertOne(document);
  return document;
}

export async function listPlaygroundRunsBySession(
  db: Db,
  params: {
    tenantId: string;
    sessionId: ObjectId;
    limit: number;
    cursor?: PlaygroundRunsCursor;
  }
): Promise<PlaygroundRunDocument[]> {
  const conditions: Filter<PlaygroundRunDocument>[] = [
    {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
    },
  ];

  if (params.cursor) {
    conditions.push({
      $or: [
        { createdAt: { $lt: params.cursor.createdAt } },
        {
          createdAt: params.cursor.createdAt,
          _id: { $lt: params.cursor.id },
        },
      ],
    });
  }

  const filter =
    conditions.length === 1
      ? conditions[0]
      : ({ $and: conditions } as Filter<PlaygroundRunDocument>);

  return playgroundRunsCollection(db)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(params.limit)
    .toArray();
}
