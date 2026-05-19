import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { runCurrentActorPlaygroundSession } from "@/lib/services/playground-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { sessionId } = await context.params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const run = await runCurrentActorPlaygroundSession(actor, sessionId, body);
    return jsonOk(run, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
