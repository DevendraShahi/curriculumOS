import { ObjectId } from "mongodb";
import { usersCollection } from "@/lib/db/collections";
import {
  createDiscussionComment,
  getDiscussionCommentById,
  listDiscussionCommentsByThread,
  adjustDiscussionCommentVotesScore,
  type DiscussionCommentsCursor,
} from "@/lib/repositories/community-comment-repository";
import {
  listDiscussionTags,
  bumpDiscussionTagUsage,
} from "@/lib/repositories/community-tag-repository";
import {
  createDiscussionThread,
  getDiscussionThreadById,
  listDiscussionThreads,
  bumpDiscussionThreadAfterComment,
  adjustDiscussionThreadVotesScore,
  type DiscussionThreadsCursor,
} from "@/lib/repositories/community-thread-repository";
import {
  aggregateDiscussionVotesCastByUser,
  deleteDiscussionVoteById,
  getDiscussionVoteByUserTarget,
  listDiscussionVotesByUserForTargets,
  setDiscussionVoteValue,
  upsertDiscussionVote,
} from "@/lib/repositories/community-vote-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";
import type {
  DiscussionCommentDocument,
  DiscussionThreadDocument,
  DiscussionVoteDocument,
} from "@/lib/db/models";

const DEFAULT_THREAD_LIMIT = 20;
const MAX_THREAD_LIMIT = 100;
const DEFAULT_COMMENT_LIMIT = 30;
const MAX_COMMENT_LIMIT = 200;
const DEFAULT_TAG_LIMIT = 30;
const MAX_TAG_LIMIT = 100;
const DEFAULT_LEADERBOARD_LIMIT = 20;
const MAX_LEADERBOARD_LIMIT = 100;
const MAX_COMMENT_DEPTH = 5;

type UserMap = Map<
  string,
  {
    id: string;
    fullName: string;
    username: string | null;
    imageUrl: string | null;
  }
>;

export type CommunityThreadDto = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  pinned: boolean;
  visibility: DiscussionThreadDocument["visibility"];
  status: DiscussionThreadDocument["status"];
  commentsCount: number;
  votesScore: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    fullName: string;
    username: string | null;
    imageUrl: string | null;
  } | null;
  viewerVote: -1 | 0 | 1;
};

export type CommunityCommentDto = {
  id: string;
  threadId: string;
  author: {
    id: string;
    fullName: string;
    username: string | null;
    imageUrl: string | null;
  } | null;
  body: string;
  parentCommentId: string | null;
  depth: number;
  isAnswer: boolean;
  status: DiscussionCommentDocument["status"];
  votesScore: number;
  createdAt: string;
  updatedAt: string;
  viewerVote: -1 | 0 | 1;
};

function toSafeFullName(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "Unknown User";
}

async function buildUserMap(
  params: {
    db: Awaited<ReturnType<typeof getMongoDb>>;
    tenantId: string;
    userIds: ObjectId[];
  }
): Promise<UserMap> {
  const uniqueIds = Array.from(
    new Map(params.userIds.map((id) => [id.toString(), id])).values()
  );
  if (uniqueIds.length === 0) return new Map();

  const rows = await usersCollection(params.db)
    .find({
      tenantId: params.tenantId,
      _id: { $in: uniqueIds },
    })
    .project({
      _id: 1,
      fullName: 1,
      username: 1,
      imageUrl: 1,
    })
    .toArray();

  return new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        id: row._id.toString(),
        fullName: toSafeFullName(row.fullName),
        username: row.username ?? null,
        imageUrl: row.imageUrl ?? null,
      },
    ])
  );
}

function parseLimit(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function encodeThreadsCursor(cursor: DiscussionThreadsCursor): string {
  return `${cursor.lastActivityAt.getTime()}:${cursor.id.toString()}`;
}

export function parseThreadsCursor(value: string | null): DiscussionThreadsCursor | undefined {
  if (!value) return undefined;
  const [timestampRaw, idRaw] = value.split(":");
  if (!timestampRaw || !idRaw) {
    throw new Error("INVALID_COMMUNITY_CURSOR");
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp) || !ObjectId.isValid(idRaw)) {
    throw new Error("INVALID_COMMUNITY_CURSOR");
  }

  return {
    lastActivityAt: new Date(timestamp),
    id: new ObjectId(idRaw),
  };
}

function encodeCommentsCursor(cursor: DiscussionCommentsCursor): string {
  return `${cursor.createdAt.getTime()}:${cursor.id.toString()}`;
}

export function parseCommentsCursor(
  value: string | null
): DiscussionCommentsCursor | undefined {
  if (!value) return undefined;
  const [timestampRaw, idRaw] = value.split(":");
  if (!timestampRaw || !idRaw) {
    throw new Error("INVALID_COMMUNITY_CURSOR");
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp) || !ObjectId.isValid(idRaw)) {
    throw new Error("INVALID_COMMUNITY_CURSOR");
  }

  return {
    createdAt: new Date(timestamp),
    id: new ObjectId(idRaw),
  };
}

function parseQueryBoolean(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new Error("INVALID_COMMUNITY_FILTER");
}

function normalizeOptionalString(
  value: unknown,
  options: { min: number; max: number }
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length < options.min || normalized.length > options.max) {
    throw new Error("INVALID_COMMUNITY_THREAD");
  }
  return normalized;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function normalizeCategory(value: unknown): string | undefined {
  const category = normalizeOptionalString(value, { min: 2, max: 40 });
  if (!category) return undefined;
  const slug = slugify(category);
  if (!slug) throw new Error("INVALID_COMMUNITY_THREAD");
  return slug;
}

function normalizeVisibility(
  value: unknown
): DiscussionThreadDocument["visibility"] | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "public") return "public";
  if (value === "tenant_members") return "tenant_members";
  if (value === "private") return "tenant_members";
  throw new Error("INVALID_COMMUNITY_THREAD");
}

function normalizeTags(value: unknown): Array<{ slug: string; label: string }> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error("INVALID_COMMUNITY_THREAD");
  }

  const unique = new Map<string, string>();
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error("INVALID_COMMUNITY_THREAD");
    }
    const label = item.trim();
    if (!label) continue;
    if (label.length > 30) {
      throw new Error("INVALID_COMMUNITY_THREAD");
    }
    const slug = slugify(label);
    if (!slug) {
      throw new Error("INVALID_COMMUNITY_THREAD");
    }
    if (!unique.has(slug)) {
      unique.set(slug, label);
    }
  }

  if (unique.size > 8) {
    throw new Error("INVALID_COMMUNITY_THREAD");
  }

  return Array.from(unique.entries()).map(([slug, label]) => ({ slug, label }));
}

function toThreadDto(params: {
  thread: DiscussionThreadDocument;
  users: UserMap;
  viewerVote?: number;
}): CommunityThreadDto {
  return {
    id: params.thread._id.toString(),
    title: params.thread.title,
    body: params.thread.body,
    category: params.thread.category ?? null,
    tags: params.thread.tags,
    pinned: params.thread.pinned,
    visibility: params.thread.visibility,
    status: params.thread.status,
    commentsCount: params.thread.commentsCount,
    votesScore: params.thread.votesScore,
    lastActivityAt: params.thread.lastActivityAt.toISOString(),
    createdAt: params.thread.createdAt.toISOString(),
    updatedAt: params.thread.updatedAt.toISOString(),
    author: params.users.get(params.thread.authorUserId.toString()) ?? null,
    viewerVote: params.viewerVote === 1 ? 1 : params.viewerVote === -1 ? -1 : 0,
  };
}

function toCommentDto(params: {
  comment: DiscussionCommentDocument;
  users: UserMap;
  viewerVote?: number;
}): CommunityCommentDto {
  return {
    id: params.comment._id.toString(),
    threadId: params.comment.threadId.toString(),
    author: params.users.get(params.comment.authorUserId.toString()) ?? null,
    body: params.comment.body,
    parentCommentId: params.comment.parentCommentId?.toString() ?? null,
    depth: params.comment.depth,
    isAnswer: params.comment.isAnswer,
    status: params.comment.status,
    votesScore: params.comment.votesScore,
    createdAt: params.comment.createdAt.toISOString(),
    updatedAt: params.comment.updatedAt.toISOString(),
    viewerVote: params.viewerVote === 1 ? 1 : params.viewerVote === -1 ? -1 : 0,
  };
}

export function parseThreadsLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_THREAD_LIMIT, MAX_THREAD_LIMIT);
}

export function parseCommentsLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_COMMENT_LIMIT, MAX_COMMENT_LIMIT);
}

export function parseTagsLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_TAG_LIMIT, MAX_TAG_LIMIT);
}

export function parseLeaderboardLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_LEADERBOARD_LIMIT, MAX_LEADERBOARD_LIMIT);
}

export async function listCommunityThreads(params: {
  tenantId: string;
  actor?: ActorContext | null;
  limit: number;
  cursor?: DiscussionThreadsCursor;
  category?: string;
  tag?: string;
  search?: string;
  pinnedOnly?: boolean;
}): Promise<{
  items: CommunityThreadDto[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}> {
  const db = await getMongoDb();
  const viewerUser = params.actor ? await syncActorToUserDocument(params.actor) : null;
  const visibility: Array<DiscussionThreadDocument["visibility"]> = viewerUser
    ? ["public", "tenant_members"]
    : ["public"];

  const rows = await listDiscussionThreads(db, {
    tenantId: params.tenantId,
    visibility,
    statuses: ["open", "locked"],
    category: params.category,
    tag: params.tag,
    search: params.search,
    pinnedOnly: params.pinnedOnly,
    limit: params.limit + 1,
    cursor: params.cursor,
  });

  const hasMore = rows.length > params.limit;
  const visibleRows = hasMore ? rows.slice(0, params.limit) : rows;
  const userMap = await buildUserMap({
    db,
    tenantId: params.tenantId,
    userIds: visibleRows.map((row) => row.authorUserId),
  });

  let viewerVoteMap = new Map<string, number>();
  if (viewerUser) {
    const votes = await listDiscussionVotesByUserForTargets(db, {
      tenantId: params.tenantId,
      userId: viewerUser._id,
      targetType: "thread",
      targetIds: visibleRows.map((row) => row._id),
    });
    viewerVoteMap = new Map(votes.map((vote) => [vote.targetId.toString(), vote.value]));
  }

  const nextCursor =
    hasMore && visibleRows.length > 0
      ? encodeThreadsCursor({
          lastActivityAt: visibleRows[visibleRows.length - 1].lastActivityAt,
          id: visibleRows[visibleRows.length - 1]._id,
        })
      : null;

  return {
    items: visibleRows.map((thread) =>
      toThreadDto({
        thread,
        users: userMap,
        viewerVote: viewerVoteMap.get(thread._id.toString()) ?? 0,
      })
    ),
    pageInfo: {
      hasMore,
      nextCursor,
    },
  };
}

export async function createCommunityThread(
  actor: ActorContext,
  input: unknown
): Promise<CommunityThreadDto> {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_COMMUNITY_THREAD");
  }

  const payload = input as {
    title?: unknown;
    body?: unknown;
    category?: unknown;
    tags?: unknown;
    visibility?: unknown;
  };

  const title = normalizeOptionalString(payload.title, { min: 6, max: 180 });
  const body = normalizeOptionalString(payload.body, { min: 10, max: 40_000 });
  if (!title || !body) {
    throw new Error("INVALID_COMMUNITY_THREAD");
  }

  const category = normalizeCategory(payload.category);
  const tags = normalizeTags(payload.tags);
  const visibility = normalizeVisibility(payload.visibility) ?? "public";

  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const thread = await createDiscussionThread(db, {
    tenantId: actor.tenantId,
    authorUserId: user._id,
    title,
    body,
    category,
    tags: tags.map((tag) => tag.slug),
    visibility,
  });

  const now = new Date();
  await Promise.all(
    tags.map((tag) =>
      bumpDiscussionTagUsage(db, {
        tenantId: actor.tenantId,
        slug: tag.slug,
        label: tag.label,
        incrementBy: 1,
        occurredAt: now,
      })
    )
  );

  const users = new Map([
    [
      user._id.toString(),
      {
        id: user._id.toString(),
        fullName: toSafeFullName(user.fullName),
        username: user.username ?? null,
        imageUrl: user.imageUrl ?? null,
      },
    ],
  ]);

  return toThreadDto({
    thread,
    users,
    viewerVote: 0,
  });
}

function assertThreadReadable(
  thread: DiscussionThreadDocument,
  actor: ActorContext | null | undefined
) {
  if (thread.visibility === "public") return;
  if (!actor) {
    throw new Error("FORBIDDEN");
  }
}

export async function getCommunityThreadDetail(params: {
  tenantId: string;
  threadId: string;
  actor?: ActorContext | null;
  commentsLimit: number;
  commentsCursor?: DiscussionCommentsCursor;
}): Promise<{
  thread: CommunityThreadDto;
  comments: {
    items: CommunityCommentDto[];
    pageInfo: {
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}> {
  if (!ObjectId.isValid(params.threadId)) {
    throw new Error("INVALID_THREAD_ID");
  }

  const db = await getMongoDb();
  const thread = await getDiscussionThreadById(db, {
    tenantId: params.tenantId,
    threadId: new ObjectId(params.threadId),
  });

  if (!thread || thread.status === "archived") {
    throw new Error("THREAD_NOT_FOUND");
  }

  assertThreadReadable(thread, params.actor);
  const viewerUser = params.actor ? await syncActorToUserDocument(params.actor) : null;

  const commentRows = await listDiscussionCommentsByThread(db, {
    tenantId: params.tenantId,
    threadId: thread._id,
    limit: params.commentsLimit + 1,
    cursor: params.commentsCursor,
  });
  const hasMore = commentRows.length > params.commentsLimit;
  const visibleComments = hasMore
    ? commentRows.slice(0, params.commentsLimit)
    : commentRows;

  const userMap = await buildUserMap({
    db,
    tenantId: params.tenantId,
    userIds: [thread.authorUserId, ...visibleComments.map((row) => row.authorUserId)],
  });

  let threadViewerVote = 0;
  let commentVotesById = new Map<string, number>();
  if (viewerUser) {
    const [threadVote, commentVotes] = await Promise.all([
      getDiscussionVoteByUserTarget(db, {
        tenantId: params.tenantId,
        userId: viewerUser._id,
        targetType: "thread",
        targetId: thread._id,
      }),
      listDiscussionVotesByUserForTargets(db, {
        tenantId: params.tenantId,
        userId: viewerUser._id,
        targetType: "comment",
        targetIds: visibleComments.map((row) => row._id),
      }),
    ]);

    threadViewerVote = threadVote?.value ?? 0;
    commentVotesById = new Map(
      commentVotes.map((vote) => [vote.targetId.toString(), vote.value])
    );
  }

  const nextCursor =
    hasMore && visibleComments.length > 0
      ? encodeCommentsCursor({
          createdAt: visibleComments[visibleComments.length - 1].createdAt,
          id: visibleComments[visibleComments.length - 1]._id,
        })
      : null;

  return {
    thread: toThreadDto({
      thread,
      users: userMap,
      viewerVote: threadViewerVote,
    }),
    comments: {
      items: visibleComments.map((comment) =>
        toCommentDto({
          comment,
          users: userMap,
          viewerVote: commentVotesById.get(comment._id.toString()) ?? 0,
        })
      ),
      pageInfo: {
        hasMore,
        nextCursor,
      },
    },
  };
}

function normalizeCommentBody(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("INVALID_COMMUNITY_COMMENT");
  }
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 20_000) {
    throw new Error("INVALID_COMMUNITY_COMMENT");
  }
  return normalized;
}

function parseOptionalObjectId(value: unknown, errorCode: string): ObjectId | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw new Error(errorCode);
  }
  return new ObjectId(value);
}

export async function createCommunityComment(
  actor: ActorContext,
  params: {
    threadId: string;
    body: unknown;
    parentCommentId?: unknown;
  }
): Promise<CommunityCommentDto> {
  if (!ObjectId.isValid(params.threadId)) {
    throw new Error("INVALID_THREAD_ID");
  }

  const db = await getMongoDb();
  const threadId = new ObjectId(params.threadId);
  const thread = await getDiscussionThreadById(db, {
    tenantId: actor.tenantId,
    threadId,
  });

  if (!thread || thread.status === "archived") {
    throw new Error("THREAD_NOT_FOUND");
  }
  if (thread.status === "locked") {
    throw new Error("THREAD_LOCKED");
  }

  const body = normalizeCommentBody(params.body);
  const parentCommentId = parseOptionalObjectId(
    params.parentCommentId,
    "INVALID_COMMENT_ID"
  );

  let depth = 0;
  if (parentCommentId) {
    const parentComment = await getDiscussionCommentById(db, {
      tenantId: actor.tenantId,
      commentId: parentCommentId,
    });

    if (!parentComment || !parentComment.threadId.equals(threadId)) {
      throw new Error("PARENT_COMMENT_NOT_FOUND");
    }
    if (parentComment.status !== "visible") {
      throw new Error("PARENT_COMMENT_NOT_FOUND");
    }

    depth = parentComment.depth + 1;
    if (depth > MAX_COMMENT_DEPTH) {
      throw new Error("INVALID_COMMUNITY_COMMENT");
    }
  }

  const user = await syncActorToUserDocument(actor);
  const comment = await createDiscussionComment(db, {
    tenantId: actor.tenantId,
    threadId,
    authorUserId: user._id,
    body,
    parentCommentId,
    depth,
    isAnswer: false,
  });

  await bumpDiscussionThreadAfterComment(db, {
    tenantId: actor.tenantId,
    threadId,
    activityAt: comment.createdAt,
  });

  return toCommentDto({
    comment,
    users: new Map([
      [
        user._id.toString(),
        {
          id: user._id.toString(),
          fullName: toSafeFullName(user.fullName),
          username: user.username ?? null,
          imageUrl: user.imageUrl ?? null,
        },
      ],
    ]),
    viewerVote: 0,
  });
}

export async function applyCommunityVote(
  actor: ActorContext,
  input: unknown
): Promise<{
  targetType: DiscussionVoteDocument["targetType"];
  targetId: string;
  votesScore: number;
  viewerVote: -1 | 0 | 1;
}> {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_COMMUNITY_VOTE");
  }

  const payload = input as {
    targetType?: unknown;
    targetId?: unknown;
    value?: unknown;
  };

  const targetType =
    payload.targetType === "thread" || payload.targetType === "comment"
      ? payload.targetType
      : null;
  if (!targetType) {
    throw new Error("INVALID_COMMUNITY_VOTE");
  }

  if (typeof payload.targetId !== "string" || !ObjectId.isValid(payload.targetId)) {
    throw new Error("INVALID_COMMUNITY_VOTE");
  }
  const targetId = new ObjectId(payload.targetId);

  const value = payload.value === 1 || payload.value === -1 ? payload.value : null;
  if (!value) {
    throw new Error("INVALID_COMMUNITY_VOTE");
  }

  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);

  if (targetType === "thread") {
    const thread = await getDiscussionThreadById(db, {
      tenantId: actor.tenantId,
      threadId: targetId,
    });
    if (!thread || thread.status === "archived") {
      throw new Error("THREAD_NOT_FOUND");
    }
  } else {
    const comment = await getDiscussionCommentById(db, {
      tenantId: actor.tenantId,
      commentId: targetId,
    });
    if (!comment || comment.status !== "visible") {
      throw new Error("COMMENT_NOT_FOUND");
    }
  }

  const existing = await getDiscussionVoteByUserTarget(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    targetType,
    targetId,
  });

  let delta = 0;
  let viewerVote: -1 | 0 | 1 = 0;

  if (!existing) {
    await upsertDiscussionVote(db, {
      tenantId: actor.tenantId,
      userId: user._id,
      targetType,
      targetId,
      value,
    });
    delta = value;
    viewerVote = value;
  } else if (existing.value === value) {
    await deleteDiscussionVoteById(db, {
      tenantId: actor.tenantId,
      voteId: existing._id,
    });
    delta = -existing.value;
    viewerVote = 0;
  } else {
    await setDiscussionVoteValue(db, {
      tenantId: actor.tenantId,
      voteId: existing._id,
      value,
    });
    delta = value - existing.value;
    viewerVote = value;
  }

  const updatedTarget =
    targetType === "thread"
      ? await adjustDiscussionThreadVotesScore(db, {
          tenantId: actor.tenantId,
          threadId: targetId,
          delta,
        })
      : await adjustDiscussionCommentVotesScore(db, {
          tenantId: actor.tenantId,
          commentId: targetId,
          delta,
        });

  if (!updatedTarget) {
    throw new Error(targetType === "thread" ? "THREAD_NOT_FOUND" : "COMMENT_NOT_FOUND");
  }

  return {
    targetType,
    targetId: targetId.toString(),
    votesScore: updatedTarget.votesScore,
    viewerVote,
  };
}

export async function listCommunityTagsByUsage(params: {
  tenantId: string;
  limit: number;
}): Promise<{
  items: Array<{
    slug: string;
    label: string;
    usageCount: number;
    lastUsedAt: string | null;
    updatedAt: string;
  }>;
}> {
  const db = await getMongoDb();
  const rows = await listDiscussionTags(db, {
    tenantId: params.tenantId,
    limit: params.limit,
  });

  return {
    items: rows.map((row) => ({
      slug: row.slug,
      label: row.label,
      usageCount: row.usageCount,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function getCommunityLeaderboard(params: {
  tenantId: string;
  limit: number;
}): Promise<{
  items: Array<{
    rank: number;
    user: {
      id: string;
      fullName: string;
      username: string | null;
      imageUrl: string | null;
    } | null;
    stats: {
      threads: number;
      comments: number;
      votesCast: number;
      votesReceived: number;
    };
    points: number;
  }>;
}> {
  const db = await getMongoDb();
  const tenantFilter = { tenantId: params.tenantId };

  const [threadRows, commentRows, voteCastRows] = await Promise.all([
    db
      .collection("discussion_threads")
      .aggregate<{ _id: ObjectId; count: number; votesReceived: number }>([
        { $match: { ...tenantFilter, status: { $ne: "archived" } } },
        {
          $group: {
            _id: "$authorUserId",
            count: { $sum: 1 },
            votesReceived: { $sum: "$votesScore" },
          },
        },
      ])
      .toArray(),
    db
      .collection("discussion_comments")
      .aggregate<{ _id: ObjectId; count: number; votesReceived: number }>([
        { $match: { ...tenantFilter, status: "visible" } },
        {
          $group: {
            _id: "$authorUserId",
            count: { $sum: 1 },
            votesReceived: { $sum: "$votesScore" },
          },
        },
      ])
      .toArray(),
    aggregateDiscussionVotesCastByUser(db, params.tenantId),
  ]);

  const statsByUser = new Map<
    string,
    {
      userId: ObjectId;
      threads: number;
      comments: number;
      votesCast: number;
      votesReceived: number;
    }
  >();

  const ensureUser = (userId: ObjectId) => {
    const key = userId.toString();
    const existing = statsByUser.get(key);
    if (existing) return existing;
    const created = {
      userId,
      threads: 0,
      comments: 0,
      votesCast: 0,
      votesReceived: 0,
    };
    statsByUser.set(key, created);
    return created;
  };

  for (const row of threadRows) {
    const stats = ensureUser(row._id);
    stats.threads = row.count;
    stats.votesReceived += row.votesReceived;
  }

  for (const row of commentRows) {
    const stats = ensureUser(row._id);
    stats.comments = row.count;
    stats.votesReceived += row.votesReceived;
  }

  for (const row of voteCastRows) {
    const stats = ensureUser(row.userId);
    stats.votesCast = row.count;
  }

  const entries = Array.from(statsByUser.values()).map((entry) => {
    const points =
      entry.threads * 12 +
      entry.comments * 4 +
      entry.votesReceived * 2 +
      entry.votesCast;
    return {
      ...entry,
      points,
    };
  });

  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.userId.toString().localeCompare(b.userId.toString());
  });

  const topEntries = entries.slice(0, params.limit);
  const userMap = await buildUserMap({
    db,
    tenantId: params.tenantId,
    userIds: topEntries.map((entry) => entry.userId),
  });

  return {
    items: topEntries.map((entry, index) => ({
      rank: index + 1,
      user: userMap.get(entry.userId.toString()) ?? null,
      stats: {
        threads: entry.threads,
        comments: entry.comments,
        votesCast: entry.votesCast,
        votesReceived: entry.votesReceived,
      },
      points: entry.points,
    })),
  };
}

export function parseThreadListParams(searchParams: URLSearchParams): {
  limit: number;
  cursor?: DiscussionThreadsCursor;
  category?: string;
  tag?: string;
  search?: string;
  pinnedOnly?: boolean;
} {
  return {
    limit: parseThreadsLimit(searchParams.get("limit")),
    cursor: parseThreadsCursor(searchParams.get("cursor")),
    category: searchParams.get("category")?.trim() || undefined,
    tag: searchParams.get("tag")?.trim().toLowerCase() || undefined,
    search: searchParams.get("q")?.trim() || undefined,
    pinnedOnly: parseQueryBoolean(searchParams.get("pinnedOnly")),
  };
}
