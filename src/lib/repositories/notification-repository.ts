import { ObjectId, type Db, type Filter } from "mongodb";
import { notificationsCollection } from "@/lib/db/collections";
import type { NotificationDocument } from "@/lib/db/models";

export type NotificationCursor = {
  createdAt: Date;
  id: ObjectId;
};

function unreadFilter(): Filter<NotificationDocument> {
  return {
    $or: [{ readAt: null }, { readAt: { $exists: false } }],
  };
}

export async function listNotificationsByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    limit: number;
    cursor?: NotificationCursor;
    unreadOnly?: boolean;
  }
): Promise<NotificationDocument[]> {
  const conditions: Filter<NotificationDocument>[] = [
    {
      tenantId: params.tenantId,
      userId: params.userId,
    },
  ];

  if (params.unreadOnly) {
    conditions.push(unreadFilter());
  }

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

  const queryFilter: Filter<NotificationDocument> =
    conditions.length === 1 ? conditions[0] : { $and: conditions };

  return notificationsCollection(db)
    .find(queryFilter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(params.limit)
    .toArray();
}

export async function countUnreadNotificationsByUser(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
  }
): Promise<number> {
  return notificationsCollection(db).countDocuments({
    tenantId: params.tenantId,
    userId: params.userId,
    ...unreadFilter(),
  });
}

export async function markNotificationReadById(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    notificationId: ObjectId;
  }
): Promise<NotificationDocument | null> {
  const now = new Date();
  return notificationsCollection(db).findOneAndUpdate(
    {
      _id: params.notificationId,
      tenantId: params.tenantId,
      userId: params.userId,
    },
    {
      $set: {
        readAt: now,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    }
  );
}
