import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { applyCommunityVote } from "@/lib/services/community-service";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_COMMUNITY_VOTE", 400);
    }

    const result = await applyCommunityVote(actor, body);
    return jsonOk(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
