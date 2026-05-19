import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { patchPlaygroundSessionFiles } from "@/lib/services/playground-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { sessionId } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_PLAYGROUND_FILE_PATCH", 400);
    }

    const session = await patchPlaygroundSessionFiles(actor, sessionId, body);
    return jsonOk(session);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
