// ObjectId removed — unused import
import { getCourseByIdOrSlug } from "@/lib/repositories/course-repository";
import { getEnrollment } from "@/lib/repositories/enrollment-repository";
import { getPublishedProjectByIdOrSlug } from "@/lib/repositories/project-repository";
import { getRubricByIdOrSlug } from "@/lib/repositories/rubric-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";

export async function getProjectRuntime(params: {
  tenantId: string;
  courseIdOrSlug: string;
  projectIdOrSlug: string;
  actor?: ActorContext | null;
}) {
  const db = await getMongoDb();

  const course = await getCourseByIdOrSlug(db, params.tenantId, params.courseIdOrSlug);
  if (!course || course.status !== "published") {
    throw new Error("COURSE_NOT_FOUND");
  }

  const project = await getPublishedProjectByIdOrSlug(db, {
    tenantId: params.tenantId,
    projectIdOrSlug: params.projectIdOrSlug,
  });

  if (!project || project.courseId.toString() !== course._id.toString()) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  let viewer: {
    isAuthenticated: boolean;
    isEnrolled: boolean;
    enrollmentStatus: "active" | "paused" | "completed" | "dropped" | "not_enrolled";
  } = {
    isAuthenticated: false,
    isEnrolled: false,
    enrollmentStatus: "not_enrolled",
  };

  if (!project.isPublished && !params.actor) {
    throw new Error("UNAUTHORIZED");
  }

  if (params.actor) {
    const user = await syncActorToUserDocument(params.actor);
    const enrollment = await getEnrollment(db, params.tenantId, user._id, course._id);

    if (!project.isPublished && !enrollment) {
      throw new Error("ENROLLMENT_REQUIRED");
    }

    viewer = {
      isAuthenticated: true,
      isEnrolled: Boolean(enrollment),
      enrollmentStatus: enrollment?.status ?? "not_enrolled",
    };
  }

  // Fetch related rubrics
  const rubrics = [];
  if (project.rubric && Array.isArray(project.rubric)) {
    for (const rubricLookup of project.rubric) {
      const rubricDoc = await getRubricByIdOrSlug(db, {
        tenantId: params.tenantId,
        rubricIdOrSlug: rubricLookup,
      });
      if (rubricDoc && rubricDoc.courseId.toString() === course._id.toString()) {
        rubrics.push({
          id: rubricDoc._id.toString(),
          slug: rubricDoc.slug,
          title: rubricDoc.title,
          bodyMarkdown: rubricDoc.bodyMarkdown,
        });
      }
    }
  }

  return {
    tenantId: params.tenantId,
    course: {
      id: course._id.toString(),
      slug: course.slug,
      title: course.title,
      category: course.category ?? "",
      level: course.level ?? null,
    },
    project: {
      id: project._id.toString(),
      slug: project.slug,
      title: project.title,
      summary: project.summary ?? "",
      bodyMarkdown: project.bodyMarkdown ?? "",
      estimatedMinutes: project.estimatedMinutes,
      rubrics,
    },
    viewer,
  };
}
