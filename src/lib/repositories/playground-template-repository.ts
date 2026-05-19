import { ObjectId, type Db, type Filter } from "mongodb";
import { playgroundTemplatesCollection } from "@/lib/db/collections";
import type { PlaygroundTemplateDocument } from "@/lib/db/models";

type ListPlaygroundTemplatesOptions = {
  tenantId: string;
  visibility: PlaygroundTemplateDocument["visibility"][];
  isPublished?: boolean;
  limit: number;
  tag?: string;
  search?: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listPlaygroundTemplates(
  db: Db,
  options: ListPlaygroundTemplatesOptions
): Promise<PlaygroundTemplateDocument[]> {
  const filter: Filter<PlaygroundTemplateDocument> = {
    tenantId: options.tenantId,
    visibility: { $in: options.visibility },
  };

  if (typeof options.isPublished === "boolean") {
    filter.isPublished = options.isPublished;
  }

  if (options.tag) {
    filter.tags = options.tag;
  }

  if (options.search) {
    const pattern = escapeRegex(options.search);
    filter.$or = [
      { title: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ];
  }

  return playgroundTemplatesCollection(db)
    .find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(options.limit)
    .toArray();
}

export async function getPlaygroundTemplateByIdOrSlug(
  db: Db,
  params: {
    tenantId: string;
    templateIdOrSlug: string;
  }
): Promise<PlaygroundTemplateDocument | null> {
  const idOrSlugFilter: Filter<PlaygroundTemplateDocument> = {
    tenantId: params.tenantId,
    $or: [
      { slug: params.templateIdOrSlug },
      ...(params.templateIdOrSlug.match(/^[a-fA-F0-9]{24}$/)
        ? [{ _id: new ObjectId(params.templateIdOrSlug) }]
        : []),
    ],
  };

  return playgroundTemplatesCollection(db).findOne(idOrSlugFilter);
}
