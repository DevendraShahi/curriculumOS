import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { getProfileOverview } from "@/lib/services/profile-service";

export async function GET(request: Request) {
  try {
    const actor = await requireActorContext(request);
    const overview = await getProfileOverview(actor);
    return jsonOk(overview);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
