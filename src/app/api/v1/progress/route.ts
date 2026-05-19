import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import {
  getCurrentActorProgress,
  upsertCurrentActorLessonProgress,
} from "@/lib/services/learning-service";

type ProgressWriteBody = {
  courseId?: string;
  lessonId?: string;
  moduleId?: string;
  idempotencyKey?: string;
  state?: "not_started" | "in_progress" | "completed";
  progressPercent?: number;
  timeSpentSeconds?: number;
};

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function normalizeState(
  value: unknown
): "not_started" | "in_progress" | "completed" | undefined {
  if (value === "not_started") return value;
  if (value === "in_progress") return value;
  if (value === "completed") return value;
  return undefined;
}

function normalizeIdempotencyKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    const courseId = request.nextUrl.searchParams.get("courseId") || undefined;
    const data = await getCurrentActorProgress(actor, { courseId });
    return jsonOk(data);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    const body = (await request.json()) as ProgressWriteBody;

    if (!body.courseId || !body.courseId.trim()) {
      return jsonError("INVALID_COURSE_ID", 400);
    }

    if (!body.lessonId || !body.lessonId.trim()) {
      return jsonError("INVALID_LESSON_ID", 400);
    }

    const headerIdempotencyKey = normalizeIdempotencyKey(
      request.headers.get("idempotency-key")
    );
    const bodyIdempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
    const idempotencyKey = headerIdempotencyKey ?? bodyIdempotencyKey;

    const result = await upsertCurrentActorLessonProgress(actor, {
      courseId: body.courseId.trim(),
      lessonId: body.lessonId.trim(),
      moduleId: body.moduleId?.trim(),
      idempotencyKey,
      state: normalizeState(body.state),
      progressPercent: normalizeNumber(body.progressPercent),
      timeSpentSeconds: normalizeNumber(body.timeSpentSeconds),
    });

    const status = result.meta.idempotency.replayed ? 200 : 201;
    const response = jsonOk(result, status);
    if (result.meta.rateLimit) {
      response.headers.set(
        "X-RateLimit-Limit",
        result.meta.rateLimit.limitPerMinute.toString()
      );
      response.headers.set(
        "X-RateLimit-Remaining",
        result.meta.rateLimit.remaining.toString()
      );
      response.headers.set("X-RateLimit-Reset", result.meta.rateLimit.resetAt);
    }
    return response;
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
