import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
import { listPublicProjectsService } from "@/lib/services/project-service";

async function resolveViewerActor(): Promise<ActorContext | null> {
  try {
    return await requireActorContext();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return null;
    }
    throw error;
  }
}

function formatEstimatedMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "TBD";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export default async function ProjectsPage() {
  const authState = await auth();
  const actor = await resolveViewerActor();
  const tenantId = actor?.tenantId ?? resolveTenantId(authState.orgId);

  const projects = await listPublicProjectsService({
    tenantId,
    actor,
    limit: 24,
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12 lg:py-14 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
        Projects
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Capstone Projects</h1>
      <p className="mt-4 max-w-2xl text-sm text-[var(--muted-foreground)]">
        Production-style deliverables sourced from live curriculum modules. Submit iterations as you improve implementation quality.
      </p>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <article key={project.id} className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {project.course?.title ?? "Course"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {formatEstimatedMinutes(project.estimatedMinutes)}
              </span>
            </div>

            <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--foreground)]">
              {project.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
              {project.summary || "Implement the project brief and submit your build for review."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {project.rubric.slice(0, 3).map((criterion) => (
                <span
                  key={criterion}
                  className="border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]"
                >
                  {criterion}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {project.viewerLatestSubmission
                  ? `Last: ${project.viewerLatestSubmission.status.replace("_", " ")}`
                  : "No Submission"}
              </span>
              {project.lesson ? (
                <Link
                  href={`/curriculum/${project.course?.slug ?? ""}/lesson/${project.lesson.id}`}
                  className="inline-flex h-9 items-center bg-[var(--accent)] px-4 font-mono text-[10px] uppercase tracking-widest text-white hover:opacity-90"
                >
                  Open Lesson
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {projects.length === 0 ? (
        <div className="mt-10 border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
          No published projects available yet.
        </div>
      ) : null}
    </main>
  );
}
