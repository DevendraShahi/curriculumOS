import {
  getPublicCourseByIdOrSlug,
  listPublicCourses,
  listPublicCoursesCatalog,
  parseCourseCursor,
  type CourseListItem,
} from "@/lib/services/course-service";
import { serverEnv } from "@/lib/server-env";

export interface Course {
  id: string;
  slug?: string;
  title: string;
  category: string;
  tags: string[];
  level: "beginner" | "intermediate" | "advanced" | null;
  duration: string;
  modulesCount: number;
  description: string;
  price: string;
  instructor: {
    name: string;
    role: string;
    avatar: string;
  };
  modules: Module[];
}

export interface Module {
  id: string;
  slug?: string;
  title: string;
  duration: string;
  description: string;
  isOpen: boolean;
  lessons?: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "TBD";
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours === 0) return `${remMinutes}m`;
  if (remMinutes === 0) return `${hours}h`;
  return `${hours}h ${remMinutes}m`;
}

function buildModules(count: number, description: string): Module[] {
  const safeCount = Math.max(1, Math.min(count || 1, 20));

  return Array.from({ length: safeCount }).map((_, index) => ({
    id: String(index + 1).padStart(2, "0"),
    title: `Module ${index + 1}`,
    duration: `${20 + index * 10}m`,
    description:
      description || "Detailed lesson outcomes and practical exercises.",
    isOpen: index === 0,
  }));
}

function mapToUICourse(course: {
  id: string;
  slug: string;
  title: string;
  category: string;
  tags?: string[];
  level: "beginner" | "intermediate" | "advanced" | null;
  durationMinutes: number;
  description: string;
  summary: string;
  modulesCount: number;
  modules?: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    durationMinutes: number;
    lessons: Array<{
      id: string;
      slug: string;
      title: string;
    }>;
  }>;
}): Course {
  const contentDescription = course.description || course.summary;
  const mappedModules =
    course.modules && course.modules.length > 0
      ? course.modules.map((module, index) => ({
          id: String(index + 1).padStart(2, "0"),
          slug: module.slug,
          title: module.title,
          duration: formatDuration(module.durationMinutes),
          description:
            module.description || "Detailed lesson outcomes and practical exercises.",
          isOpen: index === 0,
          lessons: module.lessons.map((lesson) => ({
            id: lesson.id,
            slug: lesson.slug,
            title: lesson.title,
          })),
        }))
      : buildModules(course.modulesCount, contentDescription);

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    category: course.category || "GENERAL",
    tags: course.tags ?? [],
    level: course.level ?? null,
    duration: formatDuration(course.durationMinutes),
    modulesCount: mappedModules.length,
    description: contentDescription,
    price: "$149 USD",
    instructor: {
      name: "Echo11 Faculty",
      role: "Curriculum Team",
      avatar:
        "https://api.dicebear.com/7.x/notionists/svg?seed=echo11&backgroundColor=f1f5f9",
    },
    modules: mappedModules,
  };
}

function mapCourseListItemToUICourse(course: CourseListItem): Course {
  return mapToUICourse({
    id: course.id,
    slug: course.slug,
    title: course.title,
    category: course.category,
    level: course.level,
    durationMinutes: course.durationMinutes,
    description: course.description,
    summary: course.summary,
    tags: course.tags,
    modulesCount: course.modulesCount,
    modules: [],
  });
}

export async function fetchCourses(): Promise<Course[]> {
  try {
    const items = await listPublicCourses({
      tenantId: serverEnv.APP_DEFAULT_TENANT_ID,
      limit: 24,
    });

    return items.map(mapToUICourse);
  } catch (error) {
    console.error("API Error:", error);
    return [];
  }
}

export async function fetchCoursesCatalog(params: {
  limit?: number;
  q?: string;
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  tag?: string;
  sort?: "published_desc" | "updated_desc";
  cursor?: string;
}): Promise<{
  items: Course[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}> {
  try {
    const result = await listPublicCoursesCatalog({
      tenantId: serverEnv.APP_DEFAULT_TENANT_ID,
      limit: params.limit,
      search: params.q,
      category: params.category,
      level: params.level,
      tag: params.tag,
      sort: params.sort,
      cursor: parseCourseCursor(params.cursor ?? null),
    });

    return {
      items: result.items.map(mapCourseListItemToUICourse),
      pageInfo: result.pageInfo,
    };
  } catch (error) {
    console.error("API Error:", error);
    return {
      items: [],
      pageInfo: {
        hasMore: false,
        nextCursor: null,
      },
    };
  }
}

export async function fetchCourseDetails(id: string): Promise<Course | null> {
  try {
    const course = await getPublicCourseByIdOrSlug({
      tenantId: serverEnv.APP_DEFAULT_TENANT_ID,
      courseIdOrSlug: id,
    });

    if (!course) return null;

    return mapToUICourse(course);
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}
