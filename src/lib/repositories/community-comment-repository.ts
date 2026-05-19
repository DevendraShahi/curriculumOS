import { ObjectId, type Db } from "mongodb";
import { discussionCommentsCollection } from "@/lib/db/collections";
import type { DiscussionCommentDocument } from "@/lib/db/models";

export type DiscussionCommentsCursor = {
  createdAt: Date;
  id: ObjectId;
};

export async function getDiscussionCommentById(
  db: Db,
  params: {
    tenantId: string;
    commentId: ObjectId;
  }
): Promise<DiscussionCommentDocument | null> {
  return discussionCommentsCollection(db).findOne({
    tenantId: params.tenantId,
    _id: params.commentId,
  });
}

export async function createDiscussionComment(
  db: Db,
  params: {
    tenantId: string;
    threadId: ObjectId;
    authorUserId: ObjectId;
    body: string;
    parentCommentId?: ObjectId | null;
    depth: number;
    isAnswer?: boolean;
  }
): Promise<DiscussionCommentDocument> {
  const now = new Date();

  const document: DiscussionCommentDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    threadId: params.threadId,
    authorUserId: params.authorUserId,
    body: params.body,
    parentCommentId: params.parentCommentId ?? null,
    depth: params.depth,
    isAnswer: params.isAnswer ?? false,
    status: "visible",
    votesScore: 0,
    createdAt: now,
    updatedAt: now,
  };

  await discussionCommentsCollection(db).insertOne(document);
  return document;
}

export async function listDiscussionCommentsByThread(
  db: Db,
  params: {
    tenantId: string;
    threadId: ObjectId;
    limit: number;
    cursor?: DiscussionCommentsCursor;
  }
): Promise<DiscussionCommentDocument[]> {
  const filter = {
    tenantId: params.tenantId,
    threadId: params.threadId,
    status: "visible",
    ...(params.cursor
      ? {
          $or: [
            { createdAt: { $gt: params.cursor.createdAt } },
            {
              createdAt: params.cursor.createdAt,
              _id: { $gt: params.cursor.id },
            },
          ],
        }
      : {}),
  } as const;

  return discussionCommentsCollection(db)
    .find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(params.limit)
    .toArray();
}

export async function adjustDiscussionCommentVotesScore(
  db: Db,
  params: {
    tenantId: string;
    commentId: ObjectId;
    delta: number;
  }
): Promise<DiscussionCommentDocument | null> {
  const now = new Date();
  return discussionCommentsCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      _id: params.commentId,
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
