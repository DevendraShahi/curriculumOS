import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { createCommunityComment } from "@/lib/services/community-service";

type CreateCommentBody = {
  body?: unknown;
  parentCommentId?: unknown;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { threadId } = await context.params;

    let body: CreateCommentBody;
    try {
      body = (await request.json()) as CreateCommentBody;
    } catch {
      return jsonError("INVALID_COMMUNITY_COMMENT", 400);
    }

    const comment = await createCommunityComment(actor, {
      threadId,
      body: body?.body,
      parentCommentId: body?.parentCommentId,
    });

    return jsonOk(comment, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
