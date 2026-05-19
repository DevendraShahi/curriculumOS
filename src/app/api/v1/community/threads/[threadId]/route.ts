import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext, resolveTenantId } from "@/lib/services/auth-context";
import {
  getCommunityThreadDetail,
  parseCommentsCursor,
  parseCommentsLimit,
} from "@/lib/services/community-service";
import type { ActorContext } from "@/lib/services/auth-context";
import { serverEnv } from "@/lib/server-env";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    const authState = await auth();
    let actor: ActorContext | null = null;

    try {
      actor = await requireActorContext(request);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "UNAUTHORIZED") {
        throw error;
      }
    }

    const { threadId } = await context.params;
    const tenantId =
      request.nextUrl.searchParams.get("tenantId") ||
      actor?.tenantId ||
      resolveTenantId(authState.orgId) ||
      serverEnv.APP_DEFAULT_TENANT_ID;

    const result = await getCommunityThreadDetail({
      tenantId,
      threadId,
      actor,
      commentsLimit: parseCommentsLimit(request.nextUrl.searchParams.get("commentsLimit")),
      commentsCursor: parseCommentsCursor(
        request.nextUrl.searchParams.get("commentsCursor")
      ),
    });

    return jsonOk(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
