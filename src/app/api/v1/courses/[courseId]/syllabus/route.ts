import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { getPublicCourseByIdOrSlug } from "@/lib/services/course-service";
import { getCurrentActorProgress, listCurrentActorEnrollments } from "@/lib/services/learning-service";
import { requireActorContext, resolveTenantId } from "@/lib/services/auth-context";
import { serverEnv } from "@/lib/server-env";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await context.params;
    const authResult = await auth();
    const tenantId =
      request.nextUrl.searchParams.get("tenantId") ||
      resolveTenantId(authResult.orgId) ||
      serverEnv.APP_DEFAULT_TENANT_ID;

    const course = await getPublicCourseByIdOrSlug({
      tenantId,
      courseIdOrSlug: courseId,
    });

    if (!course) {
      return jsonError("COURSE_NOT_FOUND", 404);
    }

    let viewer:
      | {
          isAuthenticated: boolean;
          enrollmentStatus: "active" | "paused" | "completed" | "dropped" | "not_enrolled";
          progressSummary: {
            totalLessons: number;
            completedLessons: number;
            inProgressLessons: number;
            completionPercent: number;
          } | null;
        }
      | null = null;

    const progressByLesson = new Map<
      string,
      {
        state: "not_started" | "in_progress" | "completed";
        progressPercent: number;
        lastActivityAt: string | null;
      }
    >();

    const shouldResolveViewer =
      Boolean(authResult.userId) ||
      Boolean(request.headers.get("x-test-auth-bypass"));

    if (shouldResolveViewer) {
      try {
        const actor = await requireActorContext(request);
        const [enrollments, progress] = await Promise.all([
          listCurrentActorEnrollments(actor),
          getCurrentActorProgress(actor, { courseId: course.id }),
        ]);

        const enrollment =
          enrollments.find((item) => item.courseId === course.id) ?? null;

        for (const item of progress.items) {
          progressByLesson.set(item.lessonId, {
            state: item.state,
            progressPercent: item.progressPercent,
            lastActivityAt: item.lastActivityAt,
          });
        }

        viewer = {
          isAuthenticated: true,
          enrollmentStatus: enrollment?.status ?? "not_enrolled",
          progressSummary: progress.summary,
        };
      } catch (viewerError) {
        if (
          !(viewerError instanceof Error) ||
          viewerError.message !== "UNAUTHORIZED"
        ) {
          throw viewerError;
        }
      }
    }

    const modules = course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        progress:
          progressByLesson.get(lesson.id) ??
          progressByLesson.get(lesson.slug) ??
          null,
      })),
    }));

    return jsonOk({
      tenantId,
      course: {
        ...course,
        modules,
      },
      viewer,
    });
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
