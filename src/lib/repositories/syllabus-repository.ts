import { type Db, type ObjectId } from "mongodb";
import { lessonsCollection, modulesCollection } from "@/lib/db/collections";
import type { LessonDocument, ModuleDocument } from "@/lib/db/models";

export async function listPublishedModulesByCourse(
  db: Db,
  tenantId: string,
  courseId: ObjectId
): Promise<ModuleDocument[]> {
  return modulesCollection(db)
    .find({
      tenantId,
      courseId,
      isPublished: true,
    })
    .sort({ order: 1 })
    .toArray();
}

export async function listPublishedLessonsByCourse(
  db: Db,
  tenantId: string,
  courseId: ObjectId
): Promise<LessonDocument[]> {
  return lessonsCollection(db)
    .find({
      tenantId,
      courseId,
      isPublished: true,
    })
    .sort({ moduleId: 1, order: 1 })
    .toArray();
}

export async function countPublishedLessonsByCourse(
  db: Db,
  tenantId: string,
  courseId: ObjectId
): Promise<number> {
  return lessonsCollection(db).countDocuments({
    tenantId,
    courseId,
    isPublished: true,
  });
}

export async function countPublishedLessonsByCourses(
  db: Db,
  tenantId: string,
  courseIds: ObjectId[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await lessonsCollection(db)
    .aggregate<{ _id: ObjectId; count: number }>([
      {
        $match: {
          tenantId,
          courseId: { $in: courseIds },
          isPublished: true,
        },
      },
      {
        $group: {
          _id: "$courseId",
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}
