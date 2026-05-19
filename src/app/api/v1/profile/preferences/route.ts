import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { updateProfilePreferences } from "@/lib/services/profile-service";

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_PROFILE_PREFERENCES", 400);
    }
    const preferences = await updateProfilePreferences(actor, body);
    return jsonOk(preferences);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
