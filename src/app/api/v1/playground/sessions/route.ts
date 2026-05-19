import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import {
  createCurrentActorPlaygroundSession,
  listCurrentActorPlaygroundSessions,
  parsePlaygroundSessionLimit,
} from "@/lib/services/playground-service";

function parseSessionStatus(
  value: string | null
): "active" | "archived" | undefined {
  if (!value) return undefined;
  if (value === "active" || value === "archived") return value;
  throw new Error("INVALID_PLAYGROUND_FILTER");
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    const searchParams = request.nextUrl.searchParams;
    const result = await listCurrentActorPlaygroundSessions(actor, {
      limit: parsePlaygroundSessionLimit(searchParams.get("limit")),
      status: parseSessionStatus(searchParams.get("status")),
    });

    return jsonOk(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_PLAYGROUND_SESSION", 400);
    }

    const session = await createCurrentActorPlaygroundSession(actor, body);
    return jsonOk(session, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
