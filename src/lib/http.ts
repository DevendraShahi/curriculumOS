import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status }
  );
}

export function jsonError(
  error: string,
  status = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function mapServiceError(error: unknown): {
  status: number;
  code: string;
} {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

  switch (message) {
    case "UNAUTHORIZED":
      return { status: 401, code: message };
    case "INVALID_OBJECT_ID":
    case "INVALID_COURSE_ID":
    case "INVALID_LESSON_ID":
    case "INVALID_PROJECT_ID":
    case "INVALID_QUIZ_ID":
    case "INVALID_NOTIFICATION_ID":
    case "INVALID_NOTIFICATION_CURSOR":
    case "INVALID_NOTIFICATION_FILTER":
    case "INVALID_COURSE_CURSOR":
    case "INVALID_COURSE_FILTER":
    case "INVALID_THREAD_ID":
    case "INVALID_COMMENT_ID":
    case "INVALID_COMMUNITY_THREAD":
    case "INVALID_COMMUNITY_COMMENT":
    case "INVALID_COMMUNITY_VOTE":
    case "INVALID_COMMUNITY_CURSOR":
    case "INVALID_COMMUNITY_FILTER":
    case "INVALID_QUIZ_ANSWERS":
    case "INVALID_LEAD_CAPTURE":
    case "INVALID_PLAYGROUND_TEMPLATE":
    case "INVALID_PLAYGROUND_SESSION":
    case "INVALID_PLAYGROUND_FILE_PATCH":
    case "INVALID_PLAYGROUND_RUN":
    case "INVALID_PLAYGROUND_CURSOR":
    case "INVALID_PLAYGROUND_FILTER":
    case "INVALID_URL":
    case "INVALID_IDEMPOTENCY_KEY":
    case "INVALID_PROFILE_PREFERENCES":
    case "LESSON_NOT_IN_COURSE":
      return { status: 400, code: message };
    case "COURSE_NOT_FOUND":
    case "LESSON_NOT_FOUND":
    case "QUIZ_NOT_FOUND":
    case "PROJECT_NOT_FOUND":
    case "NOTIFICATION_NOT_FOUND":
    case "PLAYGROUND_TEMPLATE_NOT_FOUND":
    case "PLAYGROUND_SESSION_NOT_FOUND":
      return { status: 404, code: message };
    case "COURSE_NOT_ENROLLABLE":
    case "IDEMPOTENCY_KEY_REUSED":
    case "IDEMPOTENCY_REQUEST_IN_PROGRESS":
    case "PLAYGROUND_SESSION_ARCHIVED":
      return { status: 409, code: message };
    case "FORBIDDEN":
      return { status: 403, code: message };
    case "ENROLLMENT_REQUIRED":
    case "THREAD_LOCKED":
      return { status: 409, code: message };
    case "RATE_LIMITED_PROGRESS_WRITE":
      return { status: 429, code: message };
    case "THREAD_NOT_FOUND":
    case "COMMENT_NOT_FOUND":
    case "PARENT_COMMENT_NOT_FOUND":
      return { status: 404, code: message };
    default:
      return { status: 500, code: "INTERNAL_ERROR" };
  }
}
