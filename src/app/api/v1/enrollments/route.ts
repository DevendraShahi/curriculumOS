import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import {
  enrollCurrentActor,
  listCurrentActorEnrollments,
} from "@/lib/services/learning-service";

type EnrollRequestBody = {
  courseId?: string;
  source?: "direct" | "cohort" | "coupon" | "admin";
};

function isValidEnrollSource(value: unknown): value is EnrollRequestBody["source"] {
  return value === "direct" || value === "cohort" || value === "coupon" || value === "admin";
}

export async function GET() {
  try {
    const actor = await requireActorContext();
    const items = await listCurrentActorEnrollments(actor);
    return jsonOk({
      items,
      count: items.length,
    });
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorContext();
    const body = (await request.json()) as EnrollRequestBody;

    if (!body?.courseId || !body.courseId.trim()) {
      return jsonError("INVALID_COURSE_ID", 400);
    }

    const enrollment = await enrollCurrentActor(actor, {
      courseId: body.courseId.trim(),
      source: isValidEnrollSource(body.source) ? body.source : "direct",
    });

    return jsonOk(enrollment, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
