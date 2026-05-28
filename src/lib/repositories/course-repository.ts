import { ObjectId, type Db, type Filter } from "mongodb";
import { coursesCollection } from "@/lib/db/collections";
import type { CourseDocument, CourseStatus } from "@/lib/db/models";

export type CourseListSort = "published_desc" | "updated_desc";

export type CourseListCursor = {
  timestamp: Date;
  id: ObjectId;
};

type ListCoursesOptions = {
  tenantId: string;
  statuses?: CourseStatus[];
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  tag?: string;
  sort?: CourseListSort;
  cursor?: CourseListCursor;
  limit?: number;
  search?: string;
};

export type ListCoursesResult = {
  items: CourseDocument[];
  hasMore: boolean;
  nextCursor: CourseListCursor | null;
};

function resolveSort(
  value: CourseListSort | undefined
): { sort: CourseListSort; field: "publishedAt" | "updatedAt" } {
  const sort = value ?? "published_desc";
  if (sort === "updated_desc") {
    return { sort, field: "updatedAt" };
  }
  return { sort: "published_desc", field: "publishedAt" };
}

export async function listCourses(
  db: Db,
  options: ListCoursesOptions
): Promise<ListCoursesResult> {
  const filter: Filter<CourseDocument> = {
    tenantId: options.tenantId,
  };

  if (options.statuses && options.statuses.length > 0) {
    filter.status = { $in: options.statuses };
  }

  if (options.category) {
    filter.category = options.category;
  }

  if (options.level) {
    filter.level = options.level;
  }

  if (options.tag) {
    filter.tags = options.tag;
  }

  if (options.search) {
    const escaped = options.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { summary: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }

  const sortConfig = resolveSort(options.sort);
  // Keep published courses visible even when legacy records are missing publishedAt.
  // We still sort by publishedAt first, but we no longer exclude null/absent values.

  if (options.cursor) {
    const cursorFilter: Filter<CourseDocument> = {
      $or: [
        { [sortConfig.field]: { $lt: options.cursor.timestamp } },
        {
          [sortConfig.field]: options.cursor.timestamp,
          _id: { $lt: options.cursor.id },
        },
      ],
    };

    filter.$and = filter.$and
      ? [...filter.$and, cursorFilter]
      : [cursorFilter];
  }

  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const rows = await coursesCollection(db)
    .find(filter)
    .sort({
      [sortConfig.field]: -1,
      _id: -1,
    })
    .limit(limit + 1)
    .toArray();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? {
        timestamp:
          (items[items.length - 1][sortConfig.field] as Date | null | undefined) ??
          items[items.length - 1].updatedAt,
        id: items[items.length - 1]._id,
      }
    : null;

  return {
    items,
    hasMore,
    nextCursor,
  };
}

export async function getCourseByIdOrSlug(
  db: Db,
  tenantId: string,
  courseIdOrSlug: string
): Promise<CourseDocument | null> {
  const filters: Filter<CourseDocument>[] = [
    { tenantId, slug: courseIdOrSlug },
  ];

  if (ObjectId.isValid(courseIdOrSlug)) {
    filters.push({
      tenantId,
      _id: new ObjectId(courseIdOrSlug),
    });
  }

  return coursesCollection(db).findOne({
    $or: filters,
  });
}
