import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SandboxShell } from "@/components/sandbox/sandbox-shell";
import { normalizeExerciseType } from "@/lib/sandbox/exercise-type";
import { mapExerciseToSandboxLesson } from "@/lib/sandbox/map-exercise-to-sandbox-lesson";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getSandboxSession } from "@/lib/sandbox/get-sandbox-session";

// Define the shape we expect from the API.
// We map this into SandboxLesson for the new shell.
type ApiExercise = {
  id?: string;
  type?: string;
  title?: string | null;
  description?: string | null;
  instructions?: string | null;
  goal?: string | null;
  task?: string | null;
  starterCode?: string | null;
  validatorId?: "html-css-separation" | "default" | null;
  files?: unknown[] | null;
  starterFiles?: unknown[] | null;
  hints?: unknown[] | null;
};

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const returnHref = `/curriculum/${slug}/lesson/${lessonId}`;

  let exercises: ApiExercise[] = [];
  let courseId = slug;

  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    
    const response = await fetch(
      `${protocol}://${host}/api/v1/courses/${slug}/lessons/${lessonId}`,
      {
        cache: "no-store",
        headers: {
          cookie: headersList.get("cookie") || "",
        }
      }
    );

    const payload = await response.json();
    if (payload.ok && payload.data?.lesson?.exercises) {
      exercises = payload.data.lesson.exercises;
      if (payload.data?.course?.id) {
        courseId = payload.data.course.id;
      }
    }
  } catch (e) {
    console.error("Failed to load exercises via API:", e);
  }

  if (exercises.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#05070A] p-8 text-zinc-100 font-mono">
        <div className="text-center space-y-4 border border-white/10 bg-[#080B10] p-8 rounded-lg">
          <h1 className="text-xl uppercase tracking-widest text-cyan-400">No Exercises Found</h1>
          <p className="text-sm tracking-widest text-zinc-400">We couldn&apos;t find interactive exercises for this lesson.</p>
          <Link href={returnHref} className="block mt-6">
            <Button className="rounded-md bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 uppercase tracking-widest text-[10px] hover:bg-cyan-400/20">Back to Lesson</Button>
          </Link>
        </div>
      </div>
    );
  }

  const firstSandboxExercise =
    exercises.find((exercise) => normalizeExerciseType(exercise.type) === "sandbox") ??
    null;

  if (!firstSandboxExercise) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#05070A] p-8 text-zinc-100 font-mono">
        <div className="text-center space-y-4 border border-white/10 bg-[#080B10] p-8 rounded-lg">
          <h1 className="text-xl uppercase tracking-widest text-cyan-400">Unsupported Exercise Type</h1>
          <p className="text-sm tracking-widest text-zinc-400">This lesson has exercises, but none are supported in the sandbox yet.</p>
          <Link href={returnHref} className="block mt-6">
            <Button className="rounded-md bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 uppercase tracking-widest text-[10px] hover:bg-cyan-400/20">Back to Lesson</Button>
          </Link>
        </div>
      </div>
    );
  }

  const normalizedType = normalizeExerciseType(firstSandboxExercise.type);

  if (normalizedType !== "sandbox") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#05070A] p-8 text-zinc-100 font-mono">
        <div className="text-center space-y-4 border border-white/10 bg-[#080B10] p-8 rounded-lg">
          <h1 className="text-xl uppercase tracking-widest text-cyan-400">Unsupported Exercise Type</h1>
          <p className="text-sm tracking-widest text-zinc-400">Exercise type &quot;{firstSandboxExercise.type}&quot; is not supported yet.</p>
          <Link href={returnHref} className="block mt-6">
            <Button className="rounded-md bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 uppercase tracking-widest text-[10px] hover:bg-cyan-400/20">Back to Lesson</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Map API exercise data to the internal SandboxLesson shape
  const sandboxLesson = mapExerciseToSandboxLesson(firstSandboxExercise);
  const exerciseId = firstSandboxExercise.id?.trim() || `exercise-${lessonId}`;
  
  let initialSession = null;
  const { userId } = await auth();
  
  if (userId) {
    try {
      initialSession = await getSandboxSession({
        userId,
        lessonId,
        exerciseId,
      });
    } catch (e) {
      console.error("Failed to fetch sandbox session:", e);
    }
  }

  return (
    <SandboxShell
      courseId={courseId}
      lessonId={lessonId}
      exerciseId={exerciseId}
      lesson={sandboxLesson}
      returnHref={returnHref}
      initialSession={initialSession}
    />
  );
}
