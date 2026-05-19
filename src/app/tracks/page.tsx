import Link from "next/link";
import { fetchCourses } from "@/lib/api";

type TrackCourse = Awaited<ReturnType<typeof fetchCourses>>[number];

type TrackItem = {
  id: string;
  name: string;
  courses: TrackCourse[];
};

function toTrackId(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export default async function TracksPage() {
  const courses = await fetchCourses();
  const tracks: TrackItem[] = Array.from(
    courses.reduce(
      (acc: Map<string, TrackItem>, course: TrackCourse): Map<string, TrackItem> => {
        const name = course.category?.trim() || "General";
        const id = toTrackId(name) || "general";
        const existing = acc.get(id);
        if (existing) {
          existing.courses.push(course);
          return acc;
        }
        acc.set(id, {
          id,
          name,
          courses: [course],
        });
        return acc;
      },
      new Map<string, TrackItem>()
    ).values()
  ).sort(
    (a, b) =>
      b.courses.length - a.courses.length || a.name.localeCompare(b.name)
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12 lg:py-14 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
        Tracks
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Learning Tracks</h1>
      <p className="mt-4 max-w-2xl text-sm text-[var(--muted-foreground)]">
        Category-based tracks generated from currently published courses.
      </p>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tracks.map((track) => (
          <article
            key={track.id}
            className="border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {track.name}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {track.courses.length} Courses
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {track.courses.slice(0, 4).map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/curriculum/${course.slug ?? course.id}`}
                    className="text-sm text-[var(--foreground)] hover:text-[var(--accent)]"
                  >
                    {course.title}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={`/curriculum?category=${encodeURIComponent(track.name.toLowerCase())}`}
              className="mt-5 inline-flex h-9 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)]"
            >
              Open Track
            </Link>
          </article>
        ))}
      </section>

      {tracks.length === 0 ? (
        <div className="mt-10 border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
          No tracks available yet.
        </div>
      ) : null}
    </main>
  );
}
