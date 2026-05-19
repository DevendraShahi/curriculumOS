import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
import {
  getCommunityLeaderboard,
  listCommunityTagsByUsage,
  listCommunityThreads,
} from "@/lib/services/community-service";
import { CommunityNewsletterForm } from "@/app/community/_components/community-newsletter-form";

type CommunitySearchParams = {
  q?: string | string[];
  category?: string | string[];
  tag?: string | string[];
};

type FilterParams = {
  query?: string | null;
  category?: string | null;
  tag?: string | null;
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toCategoryLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toTagLabel(value: string): string {
  return toCategoryLabel(value);
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  const deltaMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < hour) {
    const minutes = Math.max(1, Math.round(deltaMs / minute));
    return `${minutes}m ago`;
  }

  if (deltaMs < day) {
    const hours = Math.max(1, Math.round(deltaMs / hour));
    return `${hours}h ago`;
  }

  if (deltaMs < day * 7) {
    const days = Math.max(1, Math.round(deltaMs / day));
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recent";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}...`;
}

function buildCommunityHref(filters: FilterParams): string {
  const query = new URLSearchParams();
  if (filters.query) query.set("q", filters.query);
  if (filters.category) query.set("category", filters.category);
  if (filters.tag) query.set("tag", filters.tag);

  const encoded = query.toString();
  return encoded ? `/community?${encoded}` : "/community";
}

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

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<CommunitySearchParams>;
}) {
  const params = await searchParams;
  const selectedQuery = firstString(params.q)?.trim() || null;
  const selectedCategory = firstString(params.category)?.trim() || null;
  const selectedTag = firstString(params.tag)?.trim().toLowerCase() || null;

  const authState = await auth();
  const actor = await resolveViewerActor();
  const tenantId = actor?.tenantId ?? resolveTenantId(authState.orgId);

  const [pinnedThreadsResult, latestThreadsResult, leaderboardResult, tagsResult] =
    await Promise.all([
      listCommunityThreads({
        tenantId,
        actor,
        limit: 6,
        pinnedOnly: true,
        category: selectedCategory ?? undefined,
        tag: selectedTag ?? undefined,
        search: selectedQuery ?? undefined,
      }),
      listCommunityThreads({
        tenantId,
        actor,
        limit: 30,
        category: selectedCategory ?? undefined,
        tag: selectedTag ?? undefined,
        search: selectedQuery ?? undefined,
      }),
      getCommunityLeaderboard({
        tenantId,
        limit: 5,
      }),
      listCommunityTagsByUsage({
        tenantId,
        limit: 10,
      }),
    ]);

  const pinnedThreads = pinnedThreadsResult.items.slice(0, 3);
  const latestThreads = latestThreadsResult.items
    .filter((thread) => !thread.pinned)
    .slice(0, 8);

  const visibleThreadsById = new Map(
    [...pinnedThreads, ...latestThreads].map((thread) => [thread.id, thread])
  );
  const visibleThreads = Array.from(visibleThreadsById.values());

  const contributors = leaderboardResult.items;
  const tags = tagsResult.items;

  const categories = Array.from(
    new Set(
      latestThreadsResult.items
        .map((thread) => thread.category)
        .filter((category): category is string => Boolean(category))
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12);

  const totalAnswers = visibleThreads.reduce(
    (sum, thread) => sum + thread.commentsCount,
    0
  );

  const metrics = [
    { value: formatCompact(visibleThreads.length), label: "Visible Threads" },
    { value: formatCompact(pinnedThreads.length), label: "Pinned" },
    { value: formatCompact(totalAnswers), label: "Answers" },
    { value: formatCompact(contributors.length), label: "Contributors" },
  ];

  const avatarColors = [
    "bg-blue-100 text-blue-700",
    "bg-rose-100 text-rose-700",
    "bg-green-100 text-green-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-teal-100 text-teal-700",
  ];

  const initials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const hasFilters = Boolean(selectedQuery || selectedCategory || selectedTag);

  return (
    <div className="bg-[var(--background)] min-h-screen">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                Community
              </h1>
              <p className="mt-2 text-[var(--muted-foreground)] max-w-xs leading-relaxed text-sm">
                Connect with engineers, ask questions, and grow together.
              </p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <Link
                  href="/community/new"
                  className="inline-flex h-9 items-center gap-2 bg-[var(--accent)] px-5 font-mono text-[10px] uppercase tracking-widest text-white hover:opacity-90 transition-opacity"
                >
                  New Discussion
                </Link>
                <Link
                  href="/community/tags"
                  className="inline-flex h-9 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-5 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                >
                  Browse Tags
                </Link>
              </div>
            </div>
            <div className="flex gap-6 sm:gap-10 shrink-0 flex-wrap justify-around sm:justify-start">
              {metrics.map((metric) => (
                <div key={metric.label} className="text-center">
                  <p className="text-2xl font-semibold text-[var(--foreground)]">
                    {metric.value}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px] lg:gap-12">
          <div className="min-w-0">
            <form action="/community" method="get" className="space-y-3 mb-8">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  name="q"
                  defaultValue={selectedQuery ?? ""}
                  placeholder="Search discussions..."
                  className="h-9 flex-1 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                />
                <select
                  name="category"
                  defaultValue={selectedCategory ?? ""}
                  className="h-9 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--foreground)]"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {toCategoryLabel(category)}
                    </option>
                  ))}
                </select>
                <select
                  name="tag"
                  defaultValue={selectedTag ?? ""}
                  className="h-9 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--foreground)]"
                >
                  <option value="">All Tags</option>
                  {tags.map((tag) => (
                    <option key={tag.slug} value={tag.slug}>
                      {tag.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center bg-[var(--foreground)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--surface)]"
                >
                  Apply
                </button>
              </div>
              {hasFilters ? (
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Filters Active
                  </p>
                  <Link
                    href="/community"
                    className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]"
                  >
                    Clear Filters
                  </Link>
                </div>
              ) : null}
            </form>

            <section aria-label="Featured Discussions">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Featured Discussions
              </h2>
              <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
                {pinnedThreads.length > 0 ? (
                  pinnedThreads.map((thread, idx) => (
                    <Link
                      href={`/community/discussion/${thread.id}`}
                      key={thread.id}
                      className="flex gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="flex flex-col items-center gap-1 shrink-0 w-8 sm:w-10 pt-0.5">
                        <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                          {thread.votesScore}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">
                            Pinned
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-2">
                          {thread.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2 sm:line-clamp-3">
                          {truncateText(thread.body, 100)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {thread.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]"
                            >
                              {toTagLabel(tag)}
                            </span>
                          ))}
                          {thread.tags.length > 2 && (
                            <span className="font-mono text-[9px] text-[var(--muted-foreground)] px-1">
                              +{thread.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right hidden sm:flex flex-col items-end">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColors[idx % avatarColors.length]}`}
                        >
                          {initials(thread.author?.fullName ?? "Unknown")}
                        </div>
                        <p className="mt-1 font-mono text-[9px] text-[var(--muted-foreground)]">
                          {formatShortDate(thread.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-xs text-[var(--muted-foreground)]">
                    No featured discussions found for this filter.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8" aria-label="Latest Discussions">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Latest Discussions
              </h2>
              <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
                {latestThreads.length > 0 ? (
                  latestThreads.map((thread, idx) => (
                    <Link
                      href={`/community/discussion/${thread.id}`}
                      key={thread.id}
                      className="flex gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="flex flex-col items-center gap-1 shrink-0 w-8 sm:w-10 pt-0.5">
                        <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                          {thread.votesScore}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-2">
                          {thread.title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {thread.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]"
                            >
                              {toTagLabel(tag)}
                            </span>
                          ))}
                          {thread.tags.length > 2 && (
                            <span className="font-mono text-[9px] text-[var(--muted-foreground)] px-1">
                              +{thread.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-start gap-2 sm:gap-4">
                        <div className="text-center hidden sm:block">
                          <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
                            {thread.commentsCount}
                          </p>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                            answers
                          </p>
                        </div>
                        <div className="text-right">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColors[idx % avatarColors.length]}`}
                          >
                            {initials(thread.author?.fullName ?? "Unknown")}
                          </div>
                          <p className="mt-1 font-mono text-[9px] text-[var(--muted-foreground)] whitespace-nowrap">
                            {formatRelativeTime(thread.lastActivityAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-xs text-[var(--muted-foreground)]">
                    No discussions matched your filters.
                  </div>
                )}
              </div>
            </section>

            <CommunityNewsletterForm />
          </div>

          <aside className="space-y-6" aria-label="Community sidebar">
            <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Top Contributors
              </h2>
              <ol className="space-y-3">
                {contributors.length > 0 ? (
                  contributors.map((entry, index) => (
                    <li key={entry.user?.id ?? `rank-${index}`} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-4 shrink-0">
                        {entry.rank}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColors[index % avatarColors.length]}`}
                      >
                        {initials(entry.user?.fullName ?? "Unknown")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--foreground)] truncate">
                          {entry.user?.fullName ?? "Unknown User"}
                        </p>
                        <p className="font-mono text-[9px] text-[var(--muted-foreground)]">
                          {entry.points} points
                        </p>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-[var(--muted-foreground)]">
                    No contributor activity yet.
                  </li>
                )}
              </ol>
            </div>

            <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Popular Tags
              </h2>
              <ul className="space-y-2.5">
                {tags.length > 0 ? (
                  tags.slice(0, 8).map((tag) => (
                    <li key={tag.slug} className="flex items-center justify-between">
                      <Link
                        href={buildCommunityHref({
                          query: selectedQuery,
                          category: selectedCategory,
                          tag: tag.slug,
                        })}
                        className="text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                      >
                        {tag.label}
                      </Link>
                      <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                        {tag.usageCount}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-[var(--muted-foreground)]">
                    No tags published yet.
                  </li>
                )}
              </ul>
              <Link
                href="/community/tags"
                className="mt-4 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]"
              >
                Browse All Tags →
              </Link>
            </div>

            <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
                Community Guidelines
              </h2>
              <ul className="space-y-2.5">
                {["Be respectful and inclusive", "Search before posting", "Stay on topic", "Share knowledge, not spam"].map((guideline, index) => (
                  <li key={guideline} className="flex items-center gap-2.5 text-xs text-[var(--foreground)]">
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                      {["□", "○", "◎", "◇"][index]}
                    </span>
                    {guideline}
                  </li>
                ))}
              </ul>
              <Link
                href="/community/guidelines"
                className="mt-4 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]"
              >
                Read Full Guidelines →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
