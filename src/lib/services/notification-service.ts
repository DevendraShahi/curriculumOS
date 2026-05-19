import { ObjectId } from "mongodb";
import {
  countUnreadNotificationsByUser,
  listNotificationsByUser,
  markNotificationReadById,
  type NotificationCursor,
} from "@/lib/repositories/notification-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 100;

type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationListResponse = {
  items: NotificationDto[];
  unreadCount: number;
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

function toNotificationDto(document: {
  _id: ObjectId;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationDto {
  return {
    id: document._id.toString(),
    type: document.type,
    title: document.title,
    body: document.body,
    actionUrl: document.actionUrl ?? null,
    metadata: document.metadata ?? null,
    readAt: document.readAt?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

export function parseNotificationLimit(value: string | null): number {
  if (!value) return DEFAULT_NOTIFICATION_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_NOTIFICATION_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_NOTIFICATION_LIMIT);
}

function encodeNotificationCursor(cursor: NotificationCursor): string {
  return `${cursor.createdAt.getTime()}:${cursor.id.toString()}`;
}

export function parseNotificationCursor(
  value: string | null
): NotificationCursor | undefined {
  if (!value) return undefined;
  const [timestampRaw, idRaw] = value.split(":");
  if (!timestampRaw || !idRaw) {
    throw new Error("INVALID_NOTIFICATION_CURSOR");
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    throw new Error("INVALID_NOTIFICATION_CURSOR");
  }

  if (!ObjectId.isValid(idRaw)) {
    throw new Error("INVALID_NOTIFICATION_CURSOR");
  }

  const createdAt = new Date(timestamp);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("INVALID_NOTIFICATION_CURSOR");
  }

  return {
    createdAt,
    id: new ObjectId(idRaw),
  };
}

export function parseUnreadOnly(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new Error("INVALID_NOTIFICATION_FILTER");
}

export async function listCurrentActorNotifications(
  actor: ActorContext,
  params: {
    limit: number;
    cursor?: NotificationCursor;
    unreadOnly?: boolean;
  }
): Promise<NotificationListResponse> {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const queryLimit = Math.min(Math.max(params.limit, 1), MAX_NOTIFICATION_LIMIT);

  const [rows, unreadCount] = await Promise.all([
    listNotificationsByUser(db, {
      tenantId: actor.tenantId,
      userId: user._id,
      limit: queryLimit + 1,
      cursor: params.cursor,
      unreadOnly: params.unreadOnly,
    }),
    countUnreadNotificationsByUser(db, {
      tenantId: actor.tenantId,
      userId: user._id,
    }),
  ]);

  const hasMore = rows.length > queryLimit;
  const visibleRows = hasMore ? rows.slice(0, queryLimit) : rows;
  const nextCursor = hasMore
    ? encodeNotificationCursor({
        createdAt: visibleRows[visibleRows.length - 1].createdAt,
        id: visibleRows[visibleRows.length - 1]._id,
      })
    : null;

  return {
    items: visibleRows.map(toNotificationDto),
    unreadCount,
    pageInfo: {
      hasMore,
      nextCursor,
    },
  };
}

export async function markCurrentActorNotificationRead(
  actor: ActorContext,
  notificationId: string
): Promise<NotificationDto> {
  if (!ObjectId.isValid(notificationId)) {
    throw new Error("INVALID_NOTIFICATION_ID");
  }

  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const updated = await markNotificationReadById(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    notificationId: new ObjectId(notificationId),
  });

  if (!updated) {
    throw new Error("NOTIFICATION_NOT_FOUND");
  }

  return toNotificationDto(updated);
}
