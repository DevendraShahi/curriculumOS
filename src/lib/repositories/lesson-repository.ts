import { ObjectId, type Db, type Filter } from "mongodb";
import { lessonsCollection, modulesCollection } from "@/lib/db/collections";
import type { LessonDocument, ModuleDocument } from "@/lib/db/models";

function buildLessonLookupFilters(
  lessonIdOrSlug: string
): Filter<LessonDocument>[] {
  const filters: Filter<LessonDocument>[] = [{ slug: lessonIdOrSlug }];

  if (ObjectId.isValid(lessonIdOrSlug)) {
    filters.push({ _id: new ObjectId(lessonIdOrSlug) });
  }

  return filters;
}

export async function getPublishedLessonByIdOrSlugInCourse(
  db: Db,
  params: {
    tenantId: string;
    courseId: ObjectId;
    lessonIdOrSlug: string;
  }
): Promise<LessonDocument | null> {
  const lookup = params.lessonIdOrSlug.trim();
  if (!lookup) return null;

  return lessonsCollection(db).findOne({
    tenantId: params.tenantId,
    courseId: params.courseId,
    isPublished: true,
    $or: buildLessonLookupFilters(lookup),
  });
}

export async function listPublishedLessonsByCourse(
  db: Db,
  params: {
    tenantId: string;
    courseId: ObjectId;
  }
): Promise<LessonDocument[]> {
  return lessonsCollection(db)
    .find({
      tenantId: params.tenantId,
      courseId: params.courseId,
      isPublished: true,
    })
    .sort({ moduleId: 1, order: 1, _id: 1 })
    .toArray();
}

export async function listPublishedModulesByCourse(
  db: Db,
  params: {
    tenantId: string;
    courseId: ObjectId;
  }
): Promise<ModuleDocument[]> {
  return modulesCollection(db)
    .find({
      tenantId: params.tenantId,
      courseId: params.courseId,
      isPublished: true,
    })
    .sort({ order: 1, _id: 1 })
    .toArray();
}
