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
import { z } from "zod";

const SafeStringList = z.preprocess(
  (val) => {
    if (Array.isArray(val)) return val.map((item) => String(item ?? "").trim()).filter(Boolean);
    if (typeof val === "string") return val.trim() ? [val.trim()] : [];
    return [];
  },
  z.array(z.string())
);

const SafeExternalResource = z.preprocess(
  (val) => {
    if (!val || typeof val !== "object") return null;
    const row = val as Record<string, unknown>;
    const title = (typeof row.title === "string" && row.title.trim()) || (typeof row.name === "string" && row.name.trim()) || undefined;
    const url = (typeof row.url === "string" && row.url.trim()) || (typeof row.href === "string" && row.href.trim()) || (typeof row.link === "string" && row.link.trim()) || undefined;
    if (!title && !url && !row.description) return null;
    const kindRaw = (typeof row.kind === "string" ? row.kind.trim().toLowerCase() : "") || (typeof row.type === "string" ? row.type.trim().toLowerCase() : "") || "link";
    return {
      id: typeof row.id === "string" ? row.id.trim() : undefined,
      title,
      url,
      kind: ["link", "download", "doc", "repo", "video"].includes(kindRaw) ? kindRaw : "link",
      downloadable: row.downloadable === true || kindRaw === "download" || row.type === "download",
      fileName: typeof row.fileName === "string" ? row.fileName.trim() : undefined,
      description: typeof row.description === "string" ? row.description.trim() : undefined,
    };
  },
  z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    kind: z.enum(["link", "download", "doc", "repo", "video"]).catch("link"),
    downloadable: z.boolean().catch(false),
    fileName: z.string().optional(),
    description: z.string().optional(),
  }).nullable()
);

const SafeLessonResources = z.preprocess(
  (val) => (val && typeof val === "object" ? val : {}),
  z.object({
    externalResources: z.array(SafeExternalResource).transform(arr => arr.filter(Boolean)),
    learnerReference: SafeStringList,
    resourcePrompts: SafeStringList,
  })
);

export const ClientLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().catch(""),
  contentType: z.enum(["text", "video", "project", "quiz"]).catch("text"),
  durationMinutes: z.number().catch(0),
  isPreview: z.boolean().catch(false),
  learningObjectives: SafeStringList,
  outcomes: SafeStringList,
  instructions: SafeStringList,
  bodyMarkdown: z.string().catch(""),
  videoUrl: z.string().optional(),
  videoProvider: z.string().optional(),
  starterFiles: z.array(z.any()).catch([]),
  expectedOutput: SafeStringList,
  exercises: z.array(z.any()).catch([]),
  resources: SafeLessonResources,
  prerequisites: SafeStringList,
  linkedQuiz: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    questionCount: z.number(),
  }).nullable(),
});

function sortLessonsByModuleOrder(params: {
  lessons: Awaited<ReturnType<typeof listPublishedLessonsByCourse>>;
  modules: Awaited<ReturnType<typeof listPublishedModulesByCourse>>;
}) {
  const moduleOrder = new Map<string, number>();
  for (const [index, module] of params.modules.entries()) {
    const order = module.order ?? index + 1;
    moduleOrder.set(module._id.toString(), order);
    moduleOrder.set(module.slug, order);
  }

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
          lessonId: { $in: [lesson.id, lesson._id.toString()].filter(Boolean) },
          isPublished: true,
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
  const lessonModuleKey = lesson.moduleId?.toString() ?? "";
  const foundModule =
    modules.find((item) => item._id.toString() === lessonModuleKey) ??
    modules.find((item) => item.slug === lessonModuleKey) ??
    null;

  const parsedLesson = ClientLessonSchema.parse({
    id: lesson._id.toString(),
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary ?? lesson.description ?? "",
    contentType: lesson.contentType,
    durationMinutes: lesson.durationMinutes,
    isPreview: lesson.isPreview,
    learningObjectives: lesson.learningObjectives,
    outcomes: lesson.outcomes,
    instructions: lesson.instructions,
    bodyMarkdown: lesson.bodyMarkdown ?? "",
    videoUrl: lesson.videoUrl ?? undefined,
    videoProvider: lesson.videoProvider ?? undefined,
    starterFiles: lesson.starterFiles ?? [],
    expectedOutput: lesson.expectedOutput,
    exercises: lesson.exercises ?? [],
    resources: lesson.resources,
    prerequisites: lesson.prerequisites,
    linkedQuiz: linkedQuiz
      ? {
          id: linkedQuiz._id.toString(),
          slug: linkedQuiz.slug,
          title: linkedQuiz.title,
          questionCount: linkedQuiz.questionCount,
        }
      : null,
  });

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
    lesson: parsedLesson,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseCourseObjectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error("INVALID_COURSE_ID");
  }

  return new ObjectId(value);
}
