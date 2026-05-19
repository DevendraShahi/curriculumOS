import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import {
  listCurrentActorProjectSubmissions,
  parseProjectLimit,
  submitCurrentActorProject,
} from "@/lib/services/project-service";
import { requireActorContext } from "@/lib/services/auth-context";

type SubmitProjectBody = {
  summary?: unknown;
  repositoryUrl?: unknown;
  liveUrl?: unknown;
  notes?: unknown;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { projectId } = await context.params;

    const items = await listCurrentActorProjectSubmissions(actor, {
      projectIdOrSlug: projectId,
      limit: parseProjectLimit(request.nextUrl.searchParams.get("limit")),
    });

    return jsonOk({
      items,
      count: items.length,
    });
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { projectId } = await context.params;
    const body = (await request.json()) as SubmitProjectBody;

    const submission = await submitCurrentActorProject(actor, {
      projectIdOrSlug: projectId,
      summary: body?.summary,
      repositoryUrl: body?.repositoryUrl,
      liveUrl: body?.liveUrl,
      notes: body?.notes,
    });

    return jsonOk(submission, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
