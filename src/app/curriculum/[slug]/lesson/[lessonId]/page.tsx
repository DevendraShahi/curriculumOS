import { LessonRuntimeClient } from "@/components/curriculum/LessonRuntimeClient";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;

  return <LessonRuntimeClient slug={slug} lessonId={lessonId} />;
}
