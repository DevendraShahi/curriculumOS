import { ObjectId, type Db } from "mongodb";
import { discussionTagsCollection } from "@/lib/db/collections";
import type { DiscussionTagDocument } from "@/lib/db/models";

export async function bumpDiscussionTagUsage(
  db: Db,
  params: {
    tenantId: string;
    slug: string;
    label: string;
    incrementBy?: number;
    occurredAt?: Date;
  }
): Promise<DiscussionTagDocument> {
  const now = params.occurredAt ?? new Date();
  const incrementBy = params.incrementBy ?? 1;

  const document = await discussionTagsCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      slug: params.slug,
    },
    {
      $inc: { usageCount: incrementBy },
      $set: {
        label: params.label,
        lastUsedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: params.tenantId,
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!document) {
    const fallback = await discussionTagsCollection(db).findOne({
      tenantId: params.tenantId,
      slug: params.slug,
    });
    if (!fallback) {
      throw new Error("INTERNAL_ERROR");
    }
    return fallback;
  }

  return document;
}

export async function listDiscussionTags(
  db: Db,
  params: {
    tenantId: string;
    limit: number;
  }
): Promise<DiscussionTagDocument[]> {
  return discussionTagsCollection(db)
    .find({
      tenantId: params.tenantId,
    })
    .sort({ usageCount: -1, updatedAt: -1, _id: 1 })
    .limit(params.limit)
    .toArray();
}
