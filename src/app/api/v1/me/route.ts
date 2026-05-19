import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { getMe } from "@/lib/services/user-service";

export async function GET() {
  try {
    const actor = await requireActorContext();
    const me = await getMe(actor);
    return jsonOk(me);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
