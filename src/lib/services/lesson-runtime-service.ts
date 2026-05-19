import { ObjectId } from "mongodb";
import { quizzesCollection } from "@/lib/db/collections";
import { getCourseByIdOrSlug } from "@/lib/repositories/course-repository";
import { getEnrollment } from "@/lib/repositories/enrollment-repository";
import {
  getPublishedLessonByIdOrSlugInCourse,
  listPublishedLessonsByCourse,
  listPublishedModulesByCourse,
} from "@/lib/repositories/lesson-repository";
import { getProgressByUserLesson } from "@/lib/repositories/progress-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";

function sortLessonsByModuleOrder(params: {
  lessons: Awaited<ReturnType<typeof listPublishedLessonsByCourse>>;
  modules: Awaited<ReturnType<typeof listPublishedModulesByCourse>>;
}) {
  const moduleOrder = new Map(
    params.modules.map((module, index) => [
      module._id.toString(),
      module.order ?? index + 1,
    ])
  );

  return params.lessons.slice().sort((a, b) => {
    const moduleDelta =
      (moduleOrder.get(a.moduleId.toString()) ?? 0) -
      (moduleOrder.get(b.moduleId.toString()) ?? 0);
    if (moduleDelta !== 0) return moduleDelta;

    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a._id.toString().localeCompare(b._id.toString());
  });
}

export async function getLessonRuntime(params: {
  tenantId: string;
  courseIdOrSlug: string;
  lessonIdOrSlug: string;
  actor?: ActorContext | null;
}) {
  const db = await getMongoDb();

  const course = await getCourseByIdOrSlug(db, params.tenantId, params.courseIdOrSlug);
  if (!course || course.status !== "published") {
    throw new Error("COURSE_NOT_FOUND");
  }

  const lesson = await getPublishedLessonByIdOrSlugInCourse(db, {
    tenantId: params.tenantId,
    courseId: course._id,
    lessonIdOrSlug: params.lessonIdOrSlug,
  });

  if (!lesson) {
    throw new Error("LESSON_NOT_FOUND");
  }

  let viewer: {
    isAuthenticated: boolean;
    isEnrolled: boolean;
    enrollmentStatus: "active" | "paused" | "completed" | "dropped" | "not_enrolled";
    progress: {
      state: "not_started" | "in_progress" | "completed";
      progressPercent: number;
      timeSpentSeconds: number;
      updatedAt: string;
    } | null;
  } = {
    isAuthenticated: false,
    isEnrolled: false,
    enrollmentStatus: "not_enrolled",
    progress: null,
  };

  if (!lesson.isPreview && !params.actor) {
    throw new Error("UNAUTHORIZED");
  }

  if (params.actor) {
    const user = await syncActorToUserDocument(params.actor);
    const enrollment = await getEnrollment(
      db,
      params.tenantId,
      user._id,
      course._id
    );

    if (!lesson.isPreview && !enrollment) {
      throw new Error("ENROLLMENT_REQUIRED");
    }

    const progress = await getProgressByUserLesson(
      db,
      params.tenantId,
      user._id,
      lesson._id.toString()
    );

    viewer = {
      isAuthenticated: true,
      isEnrolled: Boolean(enrollment),
      enrollmentStatus: enrollment?.status ?? "not_enrolled",
      progress: progress
        ? {
            state: progress.state,
            progressPercent: progress.progressPercent,
            timeSpentSeconds: progress.timeSpentSeconds ?? 0,
            updatedAt: progress.updatedAt.toISOString(),
          }
        : null,
    };
  }

  const [modules, lessons, linkedQuiz] = await Promise.all([
    listPublishedModulesByCourse(db, {
      tenantId: params.tenantId,
      courseId: course._id,
    }),
    listPublishedLessonsByCourse(db, {
      tenantId: params.tenantId,
      courseId: course._id,
    }),
    quizzesCollection(db).findOne(
      {
        tenantId: params.tenantId,
        courseId: course._id,
        lessonId: lesson._id,
        isPublished: true,
        status: "published",
      },
      {
        projection: {
          _id: 1,
          slug: 1,
          title: 1,
          questionCount: 1,
        },
      }
    ),
  ]);

  const orderedLessons = sortLessonsByModuleOrder({ lessons, modules });
  const lessonIndex = orderedLessons.findIndex((item) => item._id.equals(lesson._id));
  const previous = lessonIndex > 0 ? orderedLessons[lessonIndex - 1] : null;
  const next = lessonIndex >= 0 ? orderedLessons[lessonIndex + 1] ?? null : null;
  const foundModule = modules.find((item) => item._id.equals(lesson.moduleId)) ?? null;

  return {
    tenantId: params.tenantId,
    course: {
      id: course._id.toString(),
      slug: course.slug,
      title: course.title,
      category: course.category ?? "",
      level: course.level ?? null,
    },
    module: foundModule
      ? {
          id: foundModule._id.toString(),
          slug: foundModule.slug,
          title: foundModule.title,
          order: foundModule.order,
        }
      : null,
    lesson: {
      id: lesson._id.toString(),
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary ?? lesson.description ?? "",
      contentType: lesson.contentType,
      durationMinutes: lesson.durationMinutes,
      isPreview: lesson.isPreview,
      learningObjectives: lesson.learningObjectives ?? [],
      instructions: lesson.instructions ?? [],
      bodyMarkdown: lesson.bodyMarkdown ?? "",
      starterFiles: lesson.starterFiles ?? [],
      expectedOutput: lesson.expectedOutput ?? [],
      linkedQuiz: linkedQuiz
        ? {
            id: linkedQuiz._id.toString(),
            slug: linkedQuiz.slug,
            title: linkedQuiz.title,
            questionCount: linkedQuiz.questionCount,
          }
        : null,
    },
    navigation: {
      position: lessonIndex >= 0 ? lessonIndex + 1 : 1,
      totalLessons: orderedLessons.length,
      previous: previous
        ? {
            id: previous._id.toString(),
            slug: previous.slug,
            title: previous.title,
          }
        : null,
      next: next
        ? {
            id: next._id.toString(),
            slug: next.slug,
            title: next.title,
          }
        : null,
    },
    viewer,
  };
}

export function parseCourseObjectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error("INVALID_COURSE_ID");
  }

  return new ObjectId(value);
}
