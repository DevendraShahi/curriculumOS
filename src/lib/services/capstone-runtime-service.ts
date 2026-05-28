// ObjectId removed — unused import
import { getCourseByIdOrSlug } from "@/lib/repositories/course-repository";
import { getEnrollment } from "@/lib/repositories/enrollment-repository";
import { getCapstoneByIdOrSlug } from "@/lib/repositories/capstone-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";

export async function getCapstoneRuntime(params: {
  tenantId: string;
  courseIdOrSlug: string;
  capstoneIdOrSlug: string;
  actor?: ActorContext | null;
}) {
  const db = await getMongoDb();

  const course = await getCourseByIdOrSlug(db, params.tenantId, params.courseIdOrSlug);
  if (!course || course.status !== "published") {
    throw new Error("COURSE_NOT_FOUND");
  }

  const capstone = await getCapstoneByIdOrSlug(db, {
    tenantId: params.tenantId,
    capstoneIdOrSlug: params.capstoneIdOrSlug,
  });

  if (!capstone || capstone.courseId.toString() !== course._id.toString()) {
    throw new Error("CAPSTONE_NOT_FOUND");
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

  if (!capstone.isPublished && !params.actor) {
    throw new Error("UNAUTHORIZED");
  }

  if (params.actor) {
    const user = await syncActorToUserDocument(params.actor);
    const enrollment = await getEnrollment(db, params.tenantId, user._id, course._id);

    if (!capstone.isPublished && !enrollment) {
      throw new Error("ENROLLMENT_REQUIRED");
    }

    viewer = {
      isAuthenticated: true,
      isEnrolled: Boolean(enrollment),
      enrollmentStatus: enrollment?.status ?? "not_enrolled",
    };
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
    capstone: {
      id: capstone._id.toString(),
      slug: capstone.slug,
      title: capstone.title,
      bodyMarkdown: capstone.bodyMarkdown ?? "",
    },
    viewer,
  };
}
