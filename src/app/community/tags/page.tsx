import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
import { listCommunityTagsByUsage } from "@/lib/services/community-service";

type TagsSearchParams = {
  q?: string | string[];
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
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

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<TagsSearchParams>;
}) {
  const params = await searchParams;
  const query = firstString(params.q)?.trim().toLowerCase() ?? "";

  const authState = await auth();
  const actor = await resolveViewerActor();
  const tenantId = actor?.tenantId ?? resolveTenantId(authState.orgId);

  const tagsResult = await listCommunityTagsByUsage({
    tenantId,
    limit: 120,
  });

  const filteredTags = tagsResult.items.filter((tag) => {
    if (!query) return true;
    return (
      tag.label.toLowerCase().includes(query) ||
      tag.slug.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Link href="/community" className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer">
                  Community
                </Link>
                <span className="text-[var(--muted-foreground)]">/</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">
                  Tags
                </span>
              </div>
              <h1 className="text-3xl font-medium tracking-tight text-[var(--foreground)]">
                Tags
              </h1>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {tagsResult.items.length} tags ranked by usage.
              </p>
            </div>

            <form action="/community/tags" method="get" className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Filter tags..."
                className="h-10 w-full sm:w-64 border border-[var(--border)] bg-[var(--background)] pl-9 pr-4 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-colors"
                aria-label="Filter tags"
              />
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {filteredTags.length === 0 ? (
          <div className="border border-[var(--border)] bg-[var(--surface)] p-16 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              No tags match this filter
            </p>
          </div>
        ) : (
          <div className="bg-[var(--border)] border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px">
            {filteredTags.map((tag) => (
              <Link
                key={tag.slug}
                href={`/community?tag=${encodeURIComponent(tag.slug)}`}
                className="bg-[var(--surface)] p-5 hover:bg-[var(--surface-2)] transition-colors group flex flex-col gap-3"
              >
                <div className="inline-flex self-start items-center border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                  {tag.label}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed flex-1">
                  Slug: {tag.slug}
                </p>
                <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  <span className="text-[var(--foreground)] text-[10px]">
                    {tag.usageCount}
                  </span>
                  threads
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
