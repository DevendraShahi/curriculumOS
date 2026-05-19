import { ObjectId, type Db, type Filter } from "mongodb";
import { quizzesCollection } from "@/lib/db/collections";
import type { QuizDocument } from "@/lib/db/models";

function buildQuizLookupFilters(quizIdOrSlug: string): Filter<QuizDocument>[] {
  const filters: Filter<QuizDocument>[] = [{ slug: quizIdOrSlug }];

  if (ObjectId.isValid(quizIdOrSlug)) {
    filters.push({ _id: new ObjectId(quizIdOrSlug) });
  }

  return filters;
}

export async function getPublishedQuizByIdOrSlugInCourse(
  db: Db,
  params: {
    tenantId: string;
    courseId: ObjectId;
    quizIdOrSlug: string;
  }
): Promise<QuizDocument | null> {
  const lookup = params.quizIdOrSlug.trim();
  if (!lookup) return null;

  return quizzesCollection(db).findOne({
    tenantId: params.tenantId,
    courseId: params.courseId,
    isPublished: true,
    status: "published",
    $or: buildQuizLookupFilters(lookup),
  });
}
