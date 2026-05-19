import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import {
  listPlaygroundSessionRuns,
  parsePlaygroundRunLimit,
  parsePlaygroundRunsCursor,
} from "@/lib/services/playground-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { sessionId } = await context.params;
    const result = await listPlaygroundSessionRuns(actor, {
      sessionId,
      limit: parsePlaygroundRunLimit(request.nextUrl.searchParams.get("limit")),
      cursor: parsePlaygroundRunsCursor(
        request.nextUrl.searchParams.get("cursor")
      ),
    });

    return jsonOk(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
