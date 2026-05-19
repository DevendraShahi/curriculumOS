import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import {
  parseOptionalDurationSeconds,
  submitQuizAttempt,
} from "@/lib/services/assessment-service";
import { requireActorContext } from "@/lib/services/auth-context";

type SubmitQuizAttemptBody = {
  answers?: number[];
  durationSeconds?: number;
  idempotencyKey?: string;
};

function normalizeIdempotencyKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { courseId, quizId } = await context.params;
    const body = (await request.json()) as SubmitQuizAttemptBody;

    const idempotencyKey =
      normalizeIdempotencyKey(request.headers.get("idempotency-key")) ??
      normalizeIdempotencyKey(body?.idempotencyKey);

    if (!Array.isArray(body?.answers)) {
      return jsonError("INVALID_QUIZ_ANSWERS", 400);
    }

    const result = await submitQuizAttempt({
      actor,
      courseIdOrSlug: courseId,
      quizIdOrSlug: quizId,
      answers: body.answers,
      durationSeconds: parseOptionalDurationSeconds(body.durationSeconds),
      idempotencyKey,
    });

    const status = result.meta.replayed ? 200 : 201;
    const response = jsonOk(result, status);

    if (result.progress?.meta?.rateLimit) {
      response.headers.set(
        "X-RateLimit-Limit",
        result.progress.meta.rateLimit.limitPerMinute.toString()
      );
      response.headers.set(
        "X-RateLimit-Remaining",
        result.progress.meta.rateLimit.remaining.toString()
      );
      response.headers.set(
        "X-RateLimit-Reset",
        result.progress.meta.rateLimit.resetAt
      );
    }

    return response;
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
