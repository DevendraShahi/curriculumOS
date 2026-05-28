import { ObjectId, type Db, type Filter } from "mongodb";
import { capstonesCollection } from "@/lib/db/collections";
import type { CapstoneDocument } from "@/lib/db/models";

function buildCapstoneLookupFilters(capstoneIdOrSlug: string): Filter<CapstoneDocument>[] {
  const filters: Filter<CapstoneDocument>[] = [{ slug: capstoneIdOrSlug }];

  if (ObjectId.isValid(capstoneIdOrSlug)) {
    filters.push({ _id: new ObjectId(capstoneIdOrSlug) });
  }

  return filters;
}

export async function getCapstoneByIdOrSlug(
  db: Db,
  params: {
    tenantId: string;
    capstoneIdOrSlug: string;
  }
): Promise<CapstoneDocument | null> {
  const lookup = params.capstoneIdOrSlug.trim();
  if (!lookup) return null;

  return capstonesCollection(db).findOne({
    tenantId: params.tenantId,
    $or: buildCapstoneLookupFilters(lookup),
  });
}

export async function listCapstonesByCourseId(
  db: Db,
  tenantId: string,
  courseId: ObjectId
): Promise<CapstoneDocument[]> {
  return capstonesCollection(db)
    .find({
      tenantId,
      courseId,
    })
    .sort({ slug: 1 })
    .toArray();
}
