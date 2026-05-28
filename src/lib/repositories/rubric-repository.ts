import { ObjectId, type Db, type Filter } from "mongodb";
import { rubricsCollection } from "@/lib/db/collections";
import type { RubricDocument } from "@/lib/db/models";

function buildRubricLookupFilters(rubricIdOrSlug: string): Filter<RubricDocument>[] {
  const filters: Filter<RubricDocument>[] = [{ slug: rubricIdOrSlug }];

  if (ObjectId.isValid(rubricIdOrSlug)) {
    filters.push({ _id: new ObjectId(rubricIdOrSlug) });
  }

  return filters;
}

export async function getRubricByIdOrSlug(
  db: Db,
  params: {
    tenantId: string;
    rubricIdOrSlug: string;
  }
): Promise<RubricDocument | null> {
  const lookup = params.rubricIdOrSlug.trim();
  if (!lookup) return null;

  return rubricsCollection(db).findOne({
    tenantId: params.tenantId,
    $or: buildRubricLookupFilters(lookup),
  });
}

export async function listRubricsByCourseId(
  db: Db,
  tenantId: string,
  courseId: ObjectId
): Promise<RubricDocument[]> {
  return rubricsCollection(db)
    .find({
      tenantId,
      courseId,
    })
    .sort({ slug: 1 })
    .toArray();
}
