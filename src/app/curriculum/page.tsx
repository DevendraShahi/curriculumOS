import { Metadata } from "next";
import Link from "next/link";
import { fetchCourses, fetchCoursesCatalog } from "@/lib/api";
import { resolveCourseCardImage } from "@/lib/course-card-image";
import { ContourBackground } from "@/components/ui/ContourBackground";
import { DitheringCourseCard } from "@/components/ui/DitheringCourseCard";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Explore Curriculum | CURRICULUM.OS",
  description:
    "Discover modular, high-intensity technical training paths designed for absolute precision and architectural mastery.",
};

type CurriculumSearchParams = {
  category?: string | string[];
  level?: string | string[];
  q?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
  cursor?: string | string[];
};

type CurriculumSort = "published_desc" | "updated_desc";
type CurriculumLevel = "all" | "beginner" | "intermediate" | "advanced";

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeSort(value: string | undefined): CurriculumSort {
  return value === "updated_desc" ? "updated_desc" : "published_desc";
}

function normalizeLevel(value: string | undefined): CurriculumLevel {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "beginner" ||
    normalized === "intermediate" ||
    normalized === "advanced"
  ) {
    return normalized;
  }
  return "all";
}

function buildCurriculumHref(params: {
  category?: string | null;
  level?: CurriculumLevel | null;
  query?: string | null;
  tag?: string | null;
  sort?: CurriculumSort | null;
  cursor?: string | null;
}): string {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.level && params.level !== "all") query.set("level", params.level);
  if (params.query) query.set("q", params.query);
  if (params.tag) query.set("tag", params.tag);
  if (params.sort && params.sort !== "published_desc") {
    query.set("sort", params.sort);
  }
  if (params.cursor) query.set("cursor", params.cursor);
  const encoded = query.toString();
  return encoded ? `/curriculum?${encoded}` : "/curriculum";
}

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<CurriculumSearchParams>;
}) {
  const params = await searchParams;
  const selectedCategory = firstString(params.category)?.trim() ?? "all";
  const selectedLevel = normalizeLevel(firstString(params.level));
  const selectedQuery = firstString(params.q)?.trim() ?? "";
  const selectedTag = firstString(params.tag)?.trim() ?? "";
  const selectedSort = normalizeSort(firstString(params.sort)?.trim());
  const selectedCursor = firstString(params.cursor)?.trim() ?? "";

  const [allCourses, coursesPage] = await Promise.all([
    fetchCourses(),
    fetchCoursesCatalog({
      limit: 8,
      q: selectedQuery || undefined,
      category: selectedCategory === "all" ? undefined : selectedCategory,
      level: selectedLevel === "all" ? undefined : selectedLevel,
      tag: selectedTag || undefined,
      sort: selectedSort,
      cursor: selectedCursor || undefined,
    }),
  ]);

  const categories = Array.from(
    new Set(
      allCourses
        .map((course) => course.category?.trim())
        .filter((category): category is string => Boolean(category))
    )
  ).sort((a, b) => a.localeCompare(b));

  const tags = Array.from(
    new Set(
      allCourses
        .flatMap((course) => course.tags)
        .map((tag) => tag.trim())
        .filter((tag): tag is string => Boolean(tag))
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);

  return (
    <>
      <ContourBackground />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
          Explore Curriculum
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--muted-foreground)]">
          Discover modular, high-intensity technical training paths designed for
          absolute precision and architectural mastery.
        </p>
      </header>

      <div className="mt-12">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full pb-2 -mb-2">
          <Link
            href={buildCurriculumHref({
              category: null,
              level: selectedLevel,
              query: selectedQuery || null,
              tag: selectedTag || null,
              sort: selectedSort,
              cursor: null,
            })}
            className={`border border-[var(--border)] px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              selectedCategory === "all"
                ? "bg-[#1a1a1a] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200"
                : "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            }`}
          >
            All
          </Link>
          {categories.map((category) => {
            const isActive = category === selectedCategory;
            return (
              <Link
                key={category}
                href={buildCurriculumHref({
                  category,
                  level: selectedLevel,
                  query: selectedQuery || null,
                  tag: selectedTag || null,
                  sort: selectedSort,
                  cursor: null,
                })}
                className={`border border-[var(--border)] px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  isActive
                    ? "bg-[#1a1a1a] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    : "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {category}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 overflow-x-auto max-w-full pb-2 -mb-2">
          <Link
            href={buildCurriculumHref({
              category: selectedCategory === "all" ? null : selectedCategory,
              level: selectedLevel,
              query: selectedQuery || null,
              tag: null,
              sort: selectedSort,
              cursor: null,
            })}
            className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
              !selectedTag
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            All Tags
          </Link>
          {tags.map((tag) => {
            const active = tag === selectedTag;
            return (
              <Link
                key={tag}
                href={buildCurriculumHref({
                  category: selectedCategory === "all" ? null : selectedCategory,
                  level: selectedLevel,
                  query: selectedQuery || null,
                  tag,
                  sort: selectedSort,
                  cursor: null,
                })}
                className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tag}
              </Link>
            );
          })}
        </div>
        <form action="/curriculum" method="get" className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] gap-2">
          {selectedCategory !== "all" ? (
            <input type="hidden" name="category" value={selectedCategory} />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={selectedQuery}
            placeholder="Search curriculum..."
            className="h-9 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          <input
            type="search"
            name="tag"
            defaultValue={selectedTag}
            placeholder="Filter by tag..."
            className="h-9 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          <select
            name="level"
            defaultValue={selectedLevel}
            className="h-9 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs uppercase tracking-widest text-[var(--foreground)]"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="h-9 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs uppercase tracking-widest text-[var(--foreground)]"
          >
            <option value="published_desc">Newest</option>
            <option value="updated_desc">Recently Updated</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center bg-[var(--foreground)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--surface)]"
          >
            Apply
          </button>
        </form>
        <div className="mt-4 border-b border-[var(--border)]" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        {coursesPage.items.map((course) => {
          const image = resolveCourseCardImage({
            slug: course.slug,
            imageUrl: course.imageUrl,
          });

          return (
            <DitheringCourseCard key={course.id} course={course} image={image} />
          );
        })}
      </div>
      {coursesPage.items.length === 0 ? (
        <div className="mt-10 border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
          No courses match this filter.
        </div>
      ) : null}

      {coursesPage.pageInfo.hasMore && coursesPage.pageInfo.nextCursor ? (
        <div className="mt-8 flex justify-center">
          <Link
            href={buildCurriculumHref({
              category: selectedCategory === "all" ? null : selectedCategory,
              level: selectedLevel,
              query: selectedQuery || null,
              tag: selectedTag || null,
              sort: selectedSort,
              cursor: coursesPage.pageInfo.nextCursor,
            })}
            className="inline-flex h-10 items-center border border-[var(--border)] bg-[var(--surface)] px-6 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]"
          >
            Next Page
          </Link>
        </div>
      ) : null}
      </main>
    </>
  );
}
