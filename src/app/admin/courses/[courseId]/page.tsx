import { requireAdmin } from "@/lib/auth-admin";
import { getMongoDb } from "@/lib/mongodb";
import { coursesCollection, modulesCollection, lessonsCollection } from "@/lib/db/collections";
import { ObjectId } from "mongodb";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CurriculumManager } from "./CurriculumManager";
import { CourseMediaManager } from "./CourseMediaManager";
import { DeleteCourseButton } from "./DeleteCourseButton";
import { notFound } from "next/navigation";

export default async function CourseManagerPage({ params }: { params: Promise<{ courseId: string }> }) {
  await requireAdmin();
  const { courseId } = await params;
  
  if (!ObjectId.isValid(courseId)) {
    notFound();
  }

  const db = await getMongoDb();
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";
  const courseObjId = new ObjectId(courseId);

  const course = await coursesCollection(db).findOne({ _id: courseObjId, tenantId });
  if (!course) {
    notFound();
  }

  const modules = await modulesCollection(db).find({ courseId: courseObjId, tenantId }).sort({ order: 1 }).toArray();
  const lessons = await lessonsCollection(db).find({ courseId: courseObjId, tenantId }).sort({ order: 1 }).toArray();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/admin/courses" className="inline-flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 font-mono text-[10px] uppercase tracking-widest">
        <ArrowLeft size={14} className="mr-2" /> BACK TO COURSES
      </Link>

      <div className="mb-8 border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{course.title}</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
              SLUG: {course.slug} | STATUS: {course.status}
            </p>
          </div>
          <DeleteCourseButton courseId={courseId} title={course.title} />
        </div>
        <div className="mt-4 text-sm text-[var(--muted-foreground)] border-t border-[var(--border)] pt-4">
          {course.description || "No description provided."}
        </div>
      </div>

      <CourseMediaManager
        courseId={courseId}
        courseSlug={course.slug}
        initialImageUrl={course.imageUrl}
        initialVideoUrl={course.videoUrl}
      />

      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">Curriculum Outline</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
          MANAGE MODULES AND LESSONS
        </p>
      </div>

      <CurriculumManager 
        courseId={courseId} 
        modules={modules} 
        lessons={lessons} 
      />
    </div>
  );
}
