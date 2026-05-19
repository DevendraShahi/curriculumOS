import { ObjectId, type Db, type Filter } from "mongodb";
import { discussionThreadsCollection } from "@/lib/db/collections";
import type { DiscussionThreadDocument } from "@/lib/db/models";

export type DiscussionThreadsCursor = {
  lastActivityAt: Date;
  id: ObjectId;
};

type ListDiscussionThreadsOptions = {
  tenantId: string;
  visibility: Array<DiscussionThreadDocument["visibility"]>;
  statuses?: Array<DiscussionThreadDocument["status"]>;
  category?: string;
  tag?: string;
  search?: string;
  pinnedOnly?: boolean;
  limit: number;
  cursor?: DiscussionThreadsCursor;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listDiscussionThreads(
  db: Db,
  options: ListDiscussionThreadsOptions
): Promise<DiscussionThreadDocument[]> {
  const filter: Filter<DiscussionThreadDocument> = {
    tenantId: options.tenantId,
    visibility: { $in: options.visibility },
  };

  if (options.statuses && options.statuses.length > 0) {
    filter.status = { $in: options.statuses };
  }

  if (options.category) {
    filter.category = options.category;
  }

  if (options.tag) {
    filter.tags = options.tag;
  }

  if (typeof options.pinnedOnly === "boolean") {
    filter.pinned = options.pinnedOnly;
  }

  if (options.search) {
    const regex = escapeRegex(options.search);
    filter.$or = [
      { title: { $regex: regex, $options: "i" } },
      { body: { $regex: regex, $options: "i" } },
    ];
  }

  if (options.cursor) {
    filter.$and = [
      ...(filter.$and ?? []),
      {
        $or: [
          { lastActivityAt: { $lt: options.cursor.lastActivityAt } },
          {
            lastActivityAt: options.cursor.lastActivityAt,
            _id: { $lt: options.cursor.id },
          },
        ],
      },
    ];
  }

  return discussionThreadsCollection(db)
    .find(filter)
    .sort({ pinned: -1, lastActivityAt: -1, _id: -1 })
    .limit(options.limit)
    .toArray();
}

export async function getDiscussionThreadById(
  db: Db,
  params: {
    tenantId: string;
    threadId: ObjectId;
  }
): Promise<DiscussionThreadDocument | null> {
  return discussionThreadsCollection(db).findOne({
    tenantId: params.tenantId,
    _id: params.threadId,
  });
}

export async function createDiscussionThread(
  db: Db,
  params: {
    tenantId: string;
    authorUserId: ObjectId;
    title: string;
    body: string;
    category?: string;
    tags: string[];
    pinned?: boolean;
    visibility: DiscussionThreadDocument["visibility"];
    status?: DiscussionThreadDocument["status"];
  }
): Promise<DiscussionThreadDocument> {
  const now = new Date();

  const document: DiscussionThreadDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    authorUserId: params.authorUserId,
    title: params.title,
    body: params.body,
    category: params.category,
    tags: params.tags,
    pinned: params.pinned ?? false,
    visibility: params.visibility,
    status: params.status ?? "open",
    answerCommentId: null,
    commentsCount: 0,
    votesScore: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await discussionThreadsCollection(db).insertOne(document);
  return document;
}

export async function bumpDiscussionThreadAfterComment(
  db: Db,
  params: {
    tenantId: string;
    threadId: ObjectId;
    activityAt: Date;
  }
): Promise<void> {
  await discussionThreadsCollection(db).updateOne(
    {
      tenantId: params.tenantId,
      _id: params.threadId,
    },
    {
      $inc: { commentsCount: 1 },
      $set: {
        lastActivityAt: params.activityAt,
        updatedAt: params.activityAt,
      },
    }
  );
}

export async function adjustDiscussionThreadVotesScore(
  db: Db,
  params: {
    tenantId: string;
    threadId: ObjectId;
    delta: number;
  }
): Promise<DiscussionThreadDocument | null> {
  const now = new Date();
  return discussionThreadsCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      _id: params.threadId,
    },
    {
      $inc: { votesScore: params.delta },
      $set: {
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    }
  );
}
