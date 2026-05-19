import { ObjectId, type Db, type Filter } from "mongodb";
import { projectsCollection } from "@/lib/db/collections";
import type { ProjectDocument } from "@/lib/db/models";

type ListPublishedProjectsOptions = {
  tenantId: string;
  courseId?: ObjectId;
  limit?: number;
};

function buildProjectLookupFilters(projectIdOrSlug: string): Filter<ProjectDocument>[] {
  const filters: Filter<ProjectDocument>[] = [{ slug: projectIdOrSlug }];

  if (ObjectId.isValid(projectIdOrSlug)) {
    filters.push({ _id: new ObjectId(projectIdOrSlug) });
  }

  return filters;
}

export async function listPublishedProjects(
  db: Db,
  options: ListPublishedProjectsOptions
): Promise<ProjectDocument[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  return projectsCollection(db)
    .find({
      tenantId: options.tenantId,
      isPublished: true,
      status: "published",
      ...(options.courseId ? { courseId: options.courseId } : {}),
    })
    .sort({ courseId: 1, order: 1, updatedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getPublishedProjectByIdOrSlug(
  db: Db,
  params: {
    tenantId: string;
    projectIdOrSlug: string;
  }
): Promise<ProjectDocument | null> {
  const lookup = params.projectIdOrSlug.trim();
  if (!lookup) return null;

  return projectsCollection(db).findOne({
    tenantId: params.tenantId,
    isPublished: true,
    status: "published",
    $or: buildProjectLookupFilters(lookup),
  });
}
