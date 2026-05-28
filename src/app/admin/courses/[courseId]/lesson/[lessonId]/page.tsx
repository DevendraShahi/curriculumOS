/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAdmin } from "@/lib/auth-admin";
import { getMongoDb } from "@/lib/mongodb";
import { lessonsCollection, quizzesCollection, coursesCollection } from "@/lib/db/collections";
import { ObjectId } from "mongodb";
import { LessonBuilderWrapper } from "./LessonBuilderWrapper";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function LessonBuilderPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  await requireAdmin();
  const { courseId, lessonId } = await params;

  if (!ObjectId.isValid(courseId) || !ObjectId.isValid(lessonId)) {
    notFound();
  }

  const db = await getMongoDb();
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";
  
  const courseObjId = new ObjectId(courseId);
  const lessonObjId = new ObjectId(lessonId);

  const course = await coursesCollection(db).findOne({ _id: courseObjId, tenantId });
  if (!course) {
    notFound();
  }

  const lesson = await lessonsCollection(db).findOne({ _id: lessonObjId, courseId: courseObjId, tenantId });
  if (!lesson) {
    notFound();
  }

  // Find associated quiz (if any)
  const quiz = await quizzesCollection(db).findOne({ lessonId: lesson.id as any, tenantId });

  const initialData = {
    bodyMarkdown: lesson.bodyMarkdown || "",
    exercises: lesson.exercises || [],
    resources: lesson.resources || { externalResources: [] },
    quiz: quiz ? { questions: quiz.questions } : null,
    videoUrl: lesson.videoUrl,
    videoProvider: lesson.videoProvider,
    starterFiles: lesson.starterFiles,
    learningObjectives: lesson.learningObjectives,
    prerequisites: lesson.prerequisites,
    outcomes: lesson.outcomes,
    instructions: lesson.instructions,
    expectedOutput: lesson.expectedOutput,
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl mx-auto mb-8">
        <Link href={`/admin/courses/${courseId}`} className="inline-flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 font-mono text-[10px] uppercase tracking-widest">
          <ArrowLeft size={14} className="mr-2" /> BACK TO COURSE: {course.title}
        </Link>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-6 mb-8">
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Lesson: {lesson.title}</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
            ID: {lesson.id}
          </p>
        </div>
      </div>

      <LessonBuilderWrapper lessonId={lessonId} initialData={initialData} />
    </div>
  );
}
