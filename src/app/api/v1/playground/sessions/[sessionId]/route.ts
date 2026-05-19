import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { getPlaygroundSessionDetail } from "@/lib/services/playground-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { sessionId } = await context.params;
    const session = await getPlaygroundSessionDetail(actor, sessionId);
    return jsonOk(session);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
