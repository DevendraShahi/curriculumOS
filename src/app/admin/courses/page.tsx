import { requireAdmin } from "@/lib/auth-admin";
import { getMongoDb } from "@/lib/mongodb";
import { coursesCollection } from "@/lib/db/collections";
import { CreateCourseForm } from "./CreateCourseForm";
import { CourseStatusToggle } from "./CourseStatusToggle";
import { DeleteCourseButton } from "./DeleteCourseButton";
import { CourseMediaManager } from "./[courseId]/CourseMediaManager";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default async function AdminCoursesPage() {
  await requireAdmin();
  
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";
  const db = await getMongoDb();
  const courses = await coursesCollection(db).find({ tenantId }).sort({ createdAt: -1 }).toArray();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Manage Curriculum</h1>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-2">
          OVERVIEW OF ALL COURSES IN TENANT
        </p>
      </div>

      <CreateCourseForm />

      <div className="border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-px bg-[var(--border)]">
        <div className="bg-[var(--surface-2)] p-4 flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Existing Courses</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Count: {courses.length}</span>
        </div>
        
        {courses.length === 0 ? (
          <div className="bg-[var(--surface)] p-12 text-center text-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-widest">
            NO COURSES FOUND. CREATE ONE ABOVE.
          </div>
        ) : (
          courses.map((course) => (
            <div key={course._id.toString()} className="bg-[var(--surface)] p-4 flex justify-between items-center hover:bg-[var(--surface-2)] transition-colors group border-b border-[var(--border)] last:border-b-0">
              <div className="flex-1">
                <Link 
                  href={`/admin/courses/${course._id.toString()}`}
                  className="block mb-3"
                >
                  <h3 className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{course.title}</h3>
                  <div className="flex gap-4 mt-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">SLUG: {course.slug}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">STATUS: {course.status}</span>
                  </div>
                </Link>
                <CourseMediaManager
                  courseId={course._id.toString()}
                  courseSlug={course.slug}
                  initialImageUrl={course.imageUrl}
                  initialVideoUrl={course.videoUrl}
                  compact={true}
                />
              </div>
              <div className="flex items-center gap-4">
                <CourseStatusToggle courseId={course._id.toString()} status={course.status} />
                <DeleteCourseButton courseId={course._id.toString()} />
                <Link href={`/admin/courses/${course._id.toString()}`}>
                  <ChevronRight className="text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors" size={20} />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
