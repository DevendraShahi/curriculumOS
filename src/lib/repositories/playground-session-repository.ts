import { ObjectId, type Db } from "mongodb";
import { playgroundSessionsCollection } from "@/lib/db/collections";
import type { PlaygroundSessionDocument } from "@/lib/db/models";

type ListPlaygroundSessionsByUserOptions = {
  tenantId: string;
  userId: ObjectId;
  statuses?: PlaygroundSessionDocument["status"][];
  limit: number;
};

export async function createPlaygroundSession(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    templateId?: ObjectId | null;
    forkedFromSessionId?: ObjectId | null;
    title: string;
    visibility: PlaygroundSessionDocument["visibility"];
    status?: PlaygroundSessionDocument["status"];
    files: PlaygroundSessionDocument["files"];
  }
): Promise<PlaygroundSessionDocument> {
  const now = new Date();
  const document: PlaygroundSessionDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    templateId: params.templateId ?? null,
    forkedFromSessionId: params.forkedFromSessionId ?? null,
    title: params.title,
    visibility: params.visibility,
    status: params.status ?? "active",
    files: params.files,
    latestRunId: null,
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await playgroundSessionsCollection(db).insertOne(document);
  return document;
}

export async function getPlaygroundSessionById(
  db: Db,
  params: {
    tenantId: string;
    sessionId: ObjectId;
  }
): Promise<PlaygroundSessionDocument | null> {
  return playgroundSessionsCollection(db).findOne({
    tenantId: params.tenantId,
    _id: params.sessionId,
  });
}

export async function listPlaygroundSessionsByUser(
  db: Db,
  options: ListPlaygroundSessionsByUserOptions
): Promise<PlaygroundSessionDocument[]> {
  const filter: Record<string, unknown> = {
    tenantId: options.tenantId,
    userId: options.userId,
  };

  if (options.statuses && options.statuses.length > 0) {
    filter.status = { $in: options.statuses };
  }

  return playgroundSessionsCollection(db)
    .find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(options.limit)
    .toArray();
}

export async function updatePlaygroundSessionFiles(
  db: Db,
  params: {
    tenantId: string;
    sessionId: ObjectId;
    files: PlaygroundSessionDocument["files"];
  }
): Promise<PlaygroundSessionDocument | null> {
  return playgroundSessionsCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      _id: params.sessionId,
    },
    {
      $set: {
        files: params.files,
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    }
  );
}

export async function setPlaygroundSessionLatestRun(
  db: Db,
  params: {
    tenantId: string;
    sessionId: ObjectId;
    runId: ObjectId;
    runAt: Date;
  }
): Promise<PlaygroundSessionDocument | null> {
  return playgroundSessionsCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      _id: params.sessionId,
    },
    {
      $set: {
        latestRunId: params.runId,
        lastRunAt: params.runAt,
        updatedAt: params.runAt,
      },
    },
    {
      returnDocument: "after",
    }
  );
}
