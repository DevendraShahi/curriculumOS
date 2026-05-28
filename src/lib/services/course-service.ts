import { ObjectId } from "mongodb";
import {
  listCourses,
  getCourseByIdOrSlug,
  type CourseListCursor,
  type CourseListSort,
} from "@/lib/repositories/course-repository";
import {
  listPublishedLessonsByCourse,
  listPublishedModulesByCourse,
} from "@/lib/repositories/syllabus-repository";
import { getMongoDb } from "@/lib/mongodb";

export type CourseListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  imageUrl: string | null;
  category: string;
  level: "beginner" | "intermediate" | "advanced" | null;
  tags: string[];
  status: string;
  visibility: string;
  modulesCount: number;
  lessonsCount: number;
  durationMinutes: number;
  publishedAt: string | null;
  updatedAt: string;
};

export type CourseLevelFilter = "beginner" | "intermediate" | "advanced";

export type CourseDetail = CourseListItem & {
  modules: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    order: number;
    durationMinutes: number;
    lessonsCount: number;
    lessons: Array<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      order: number;
      durationMinutes: number;
      contentType: "text" | "video" | "project" | "quiz";
      isPreview: boolean;
    }>;
  }>;
};

type CourseCatalogPage = {
  items: CourseListItem[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

function toCourseListItem(course: {
  _id: ObjectId;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  tags?: string[];
  status: string;
  visibility: string;
  modulesCount: number;
  lessonsCount: number;
  durationMinutes: number;
  publishedAt?: Date | null;
  updatedAt: Date;
}): CourseListItem {
  return {
    id: course._id.toString(),
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description ?? "",
    imageUrl: course.imageUrl ?? null,
    category: course.category ?? "",
    level: course.level ?? null,
    tags: course.tags ?? [],
    status: course.status,
    visibility: course.visibility,
    modulesCount: course.modulesCount,
    lessonsCount: course.lessonsCount,
    durationMinutes: course.durationMinutes,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    updatedAt: course.updatedAt.toISOString(),
  };
}

function encodeCourseCursor(cursor: CourseListCursor): string {
  return `${cursor.timestamp.getTime()}:${cursor.id.toString()}`;
}

export function parseCourseCursor(value: string | null): CourseListCursor | undefined {
  if (!value) return undefined;
  const [timestampRaw, idRaw] = value.split(":");
  if (!timestampRaw || !idRaw) {
    throw new Error("INVALID_COURSE_CURSOR");
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    throw new Error("INVALID_COURSE_CURSOR");
  }

  if (!ObjectId.isValid(idRaw)) {
    throw new Error("INVALID_COURSE_CURSOR");
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_COURSE_CURSOR");
  }

  return {
    timestamp: date,
    id: new ObjectId(idRaw),
  };
}

export function parseCourseLimit(value: string | null): number {
  if (!value) return 24;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 24;
  return Math.min(Math.max(parsed, 1), 100);
}

export function parseCourseSort(value: string | null): CourseListSort {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "published_desc" || normalized === "newest") {
    return "published_desc";
  }
  if (normalized === "updated_desc" || normalized === "recent") {
    return "updated_desc";
  }
  throw new Error("INVALID_COURSE_FILTER");
}

export function parseCourseLevel(value: string | null): CourseLevelFilter | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized === "beginner" ||
    normalized === "intermediate" ||
    normalized === "advanced"
  ) {
    return normalized;
  }
  throw new Error("INVALID_COURSE_FILTER");
}

function normalizeOptionalFilter(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function listPublicCoursesCatalog(params: {
  tenantId: string;
  limit?: number;
  search?: string;
  category?: string;
  level?: CourseLevelFilter;
  tag?: string;
  sort?: CourseListSort;
  cursor?: CourseListCursor;
}): Promise<CourseCatalogPage> {
  const db = await getMongoDb();
  const result = await listCourses(db, {
    tenantId: params.tenantId,
    statuses: ["published"],
    limit: params.limit,
    search: normalizeOptionalFilter(params.search),
    category: normalizeOptionalFilter(params.category),
    level: params.level,
    tag: normalizeOptionalFilter(params.tag),
    sort: params.sort ?? "published_desc",
    cursor: params.cursor,
  });

  return {
    items: result.items.map(toCourseListItem),
    pageInfo: {
      hasMore: result.hasMore,
      nextCursor: result.nextCursor ? encodeCourseCursor(result.nextCursor) : null,
    },
  };
}

export async function listPublicCourses(params: {
  tenantId: string;
  limit?: number;
  search?: string;
  category?: string;
  level?: CourseLevelFilter;
  tag?: string;
  sort?: CourseListSort;
  cursor?: CourseListCursor;
}): Promise<CourseListItem[]> {
  const result = await listPublicCoursesCatalog(params);
  return result.items;
}

export async function getPublicCourseByIdOrSlug(params: {
  tenantId: string;
  courseIdOrSlug: string;
}): Promise<CourseDetail | null> {
  const db = await getMongoDb();
  const course = await getCourseByIdOrSlug(
    db,
    params.tenantId,
    params.courseIdOrSlug
  );

  if (!course || course.status !== "published") {
    return null;
  }

  const [modules, lessons] = await Promise.all([
    listPublishedModulesByCourse(db, params.tenantId, course._id),
    listPublishedLessonsByCourse(db, params.tenantId, course._id),
  ]);

  const lessonsByModule = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = lesson.moduleId.toString();
    const arr = lessonsByModule.get(key) ?? [];
    arr.push(lesson);
    lessonsByModule.set(key, arr);
  }

  return {
    id: course._id.toString(),
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description ?? "",
    imageUrl: course.imageUrl ?? null,
    category: course.category ?? "",
    level: course.level ?? null,
    tags: course.tags ?? [],
    status: course.status,
    visibility: course.visibility,
    modulesCount: course.modulesCount,
    lessonsCount: course.lessonsCount,
    durationMinutes: course.durationMinutes,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    updatedAt: course.updatedAt.toISOString(),
    modules: modules.map((module) => {
      const moduleLessonsById = lessonsByModule.get(module._id.toString()) ?? [];
      const moduleLessonsBySlug = lessonsByModule.get(module.slug) ?? [];
      const moduleLessonsMap = new Map<string, (typeof lessons)[number]>();
      for (const lesson of moduleLessonsById) {
        moduleLessonsMap.set(lesson._id.toString(), lesson);
      }
      for (const lesson of moduleLessonsBySlug) {
        moduleLessonsMap.set(lesson._id.toString(), lesson);
      }
      const moduleLessons = Array.from(moduleLessonsMap.values()).sort(
        (a, b) => a.order - b.order
      );
      return {
        id: module._id.toString(),
        slug: module.slug,
        title: module.title,
        description: module.description ?? "",
        order: module.order,
        durationMinutes: module.durationMinutes,
        lessonsCount: module.lessonsCount,
        lessons: moduleLessons.map((lesson) => ({
          id: lesson._id.toString(),
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary ?? lesson.description ?? "",
          order: lesson.order,
          durationMinutes: lesson.durationMinutes,
          contentType: lesson.contentType,
          isPreview: lesson.isPreview,
        })),
      };
    }),
  };
}
