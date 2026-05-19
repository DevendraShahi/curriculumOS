import { ObjectId, type Db } from "mongodb";
import { discussionVotesCollection } from "@/lib/db/collections";
import type { DiscussionVoteDocument } from "@/lib/db/models";

export async function getDiscussionVoteByUserTarget(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    targetType: DiscussionVoteDocument["targetType"];
    targetId: ObjectId;
  }
): Promise<DiscussionVoteDocument | null> {
  return discussionVotesCollection(db).findOne({
    tenantId: params.tenantId,
    userId: params.userId,
    targetType: params.targetType,
    targetId: params.targetId,
  });
}

export async function upsertDiscussionVote(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    targetType: DiscussionVoteDocument["targetType"];
    targetId: ObjectId;
    value: 1 | -1;
  }
): Promise<DiscussionVoteDocument> {
  const now = new Date();
  const document: DiscussionVoteDocument = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    targetType: params.targetType,
    targetId: params.targetId,
    value: params.value,
    createdAt: now,
    updatedAt: now,
  };

  await discussionVotesCollection(db).insertOne(document);
  return document;
}

export async function setDiscussionVoteValue(
  db: Db,
  params: {
    tenantId: string;
    voteId: ObjectId;
    value: 1 | -1;
  }
): Promise<DiscussionVoteDocument | null> {
  const now = new Date();
  return discussionVotesCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      _id: params.voteId,
    },
    {
      $set: {
        value: params.value,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    }
  );
}

export async function deleteDiscussionVoteById(
  db: Db,
  params: {
    tenantId: string;
    voteId: ObjectId;
  }
): Promise<void> {
  await discussionVotesCollection(db).deleteOne({
    tenantId: params.tenantId,
    _id: params.voteId,
  });
}

export async function listDiscussionVotesByUserForTargets(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    targetType: DiscussionVoteDocument["targetType"];
    targetIds: ObjectId[];
  }
): Promise<DiscussionVoteDocument[]> {
  if (params.targetIds.length === 0) return [];

  return discussionVotesCollection(db)
    .find({
      tenantId: params.tenantId,
      userId: params.userId,
      targetType: params.targetType,
      targetId: { $in: params.targetIds },
    })
    .toArray();
}

export async function aggregateDiscussionVotesCastByUser(
  db: Db,
  tenantId: string
): Promise<Array<{ userId: ObjectId; count: number }>> {
  const rows = await discussionVotesCollection(db)
    .aggregate<{ _id: ObjectId; count: number }>([
      {
        $match: {
          tenantId,
        },
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  return rows.map((row) => ({
    userId: row._id,
    count: row.count,
  }));
}
