import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
import {
  listCurrentActorPlaygroundSessions,
  listPlaygroundTemplatesCatalog,
} from "@/lib/services/playground-service";

type PlaygroundSearchParams = {
  tag?: string | string[];
  q?: string | string[];
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildPlaygroundHref(params: {
  tag?: string | null;
  query?: string | null;
}): string {
  const query = new URLSearchParams();

  if (params.tag) {
    query.set("tag", params.tag);
  }

  if (params.query) {
    query.set("q", params.query);
  }

  const encoded = query.toString();
  return encoded ? `/playground?${encoded}` : "/playground";
}

function formatTime(value: string | null): string {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<PlaygroundSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedTag = firstString(resolvedSearchParams.tag)?.trim() || null;
  const selectedQuery = firstString(resolvedSearchParams.q)?.trim() || null;

  const authState = await auth();
  const actor = await resolveViewerActor();
  const tenantId = actor?.tenantId ?? resolveTenantId(authState.orgId);

  const [allTemplatesResult, filteredTemplatesResult, sessionsResult] = await Promise.all([
    listPlaygroundTemplatesCatalog({
      tenantId,
      actor,
      limit: 24,
    }),
    selectedTag || selectedQuery
      ? listPlaygroundTemplatesCatalog({
          tenantId,
          actor,
          limit: 12,
          tag: selectedTag,
          query: selectedQuery,
        })
      : Promise.resolve(null),
    actor
      ? listCurrentActorPlaygroundSessions(actor, {
          limit: 8,
          status: "active",
        })
      : Promise.resolve({ items: [], count: 0 }),
  ]);

  const templates = filteredTemplatesResult?.items ?? allTemplatesResult.items.slice(0, 12);
  const allTemplates = allTemplatesResult.items;
  const sessions = sessionsResult.items;

  const templateById = new Map(
    [...allTemplates, ...templates].map((template) => [template.id, template])
  );

  const tagCounts = new Map<string, number>();
  for (const template of allTemplates) {
    for (const tag of template.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const availableTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);

  const activeSession = sessions[0] ?? null;
  const activeTemplate = activeSession?.templateId
    ? templateById.get(activeSession.templateId) ?? null
    : null;

  const activeTitle =
    activeSession?.title || activeTemplate?.title || templates[0]?.title || "Playground";
  const activeDescription =
    activeTemplate?.description ||
    templates[0]?.description ||
    "Build, test, and ship responsive interfaces with real APIs and tooling.";

  const readiness = sessions.length
    ? Math.min(
        100,
        Math.round(
          (sessions.filter((session) => session.lastRunAt !== null).length /
            sessions.length) *
            100
        )
      )
    : 0;

  const enterUrl = activeSession
    ? `/playground/sandbox?session=${encodeURIComponent(activeSession.id)}`
    : templates[0]
    ? `/playground/sandbox?template=${encodeURIComponent(templates[0].slug)}`
    : "/playground/sandbox";

  const recentOutput = sessions.slice(0, 6).map((session) => {
    const template = session.templateId
      ? templateById.get(session.templateId) ?? null
      : null;

    return {
      timestamp: formatTime(session.lastRunAt ?? session.updatedAt),
      text:
        session.lastRunAt !== null
          ? `Run completed for ${session.title}`
          : `Session ${session.title} ready`,
      secondary: template
        ? `${template.runtime} • ${session.files.length} files`
        : `${session.files.length} files`,
      highlight: session.lastRunAt !== null,
    };
  });

  const hasActiveFilters = Boolean(selectedTag || selectedQuery);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
      <section
        aria-label="Playground overview"
        className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12"
      >
        <div className="flex flex-col justify-between gap-10">
          <div>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-[64px]">
              Playground
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted-foreground)]">
              Interactive labs and sandboxes powered by live template and session data.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Environment filters">
              <Link
                href={buildPlaygroundHref({
                  tag: null,
                  query: selectedQuery,
                })}
                role="tab"
                aria-selected={!selectedTag}
                className={`inline-flex h-9 items-center px-4 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  !selectedTag
                    ? "bg-[var(--foreground)] text-[var(--surface)]"
                    : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--foreground)]"
                }`}
              >
                All Templates
              </Link>
              {availableTags.map((tag) => {
                const active = tag === selectedTag;
                return (
                  <Link
                    key={tag}
                    href={buildPlaygroundHref({
                      tag,
                      query: selectedQuery,
                    })}
                    role="tab"
                    aria-selected={active}
                    className={`inline-flex h-9 items-center px-4 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      active
                        ? "bg-[var(--foreground)] text-[var(--surface)]"
                        : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--foreground)]"
                    }`}
                  >
                    {tag}
                  </Link>
                );
              })}
              <Link
                href={enterUrl}
                className="inline-flex h-9 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] transition-colors duration-200 hover:border-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Code Sandbox
              </Link>
            </div>

            <form action="/playground" method="get" className="flex gap-2">
              {selectedTag ? <input type="hidden" name="tag" value={selectedTag} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={selectedQuery ?? ""}
                placeholder="Search templates"
                className="h-9 flex-1 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center bg-[var(--foreground)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--surface)]"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        <article
          className="border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8"
          aria-label="Active Environment"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Active Environment
              </span>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                {activeTitle}
              </h2>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
                {activeDescription}
              </p>
            </div>
            <div
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] animate-pulse"
              aria-label="Online"
            />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Templates Published
              </span>
              <span className="font-mono text-xs text-[var(--foreground)]">
                {allTemplates.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Active Sessions
              </span>
              <span className="font-mono text-xs text-[var(--foreground)]">{sessions.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Last Activity
              </span>
              <span className="font-mono text-xs text-[var(--foreground)]">
                {activeSession ? formatDate(activeSession.updatedAt) : "No sessions"}
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <p className="text-4xl font-semibold text-[var(--foreground)]">{readiness}%</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Session Readiness
            </p>
          </div>
        </article>
      </section>

      <section className="mt-16" aria-label="Playground templates">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {hasActiveFilters ? "Filtered Templates" : "Template Catalog"}
          </p>
          {hasActiveFilters ? (
            <Link
              href="/playground"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] hover:opacity-80"
            >
              Clear Filters
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-px bg-[var(--border)] sm:grid-cols-2">
          {(templates.length > 0 ? templates.slice(0, 8) : []).map((template) => (
            <Link
              key={template.id}
              href={`/playground/sandbox?template=${encodeURIComponent(template.slug)}`}
              className="group flex cursor-pointer flex-col gap-6 bg-[var(--surface)] p-8 transition-colors duration-200 hover:bg-[#f8fafc] dark:hover:bg-white/[0.02] sm:p-10"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-16 w-16 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]">
                  <span className="font-mono text-lg uppercase">
                    {template.runtime.slice(0, 2)}
                  </span>
                </div>
                <span className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  {template.starterFiles.length} files
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[var(--foreground)] transition-colors duration-200 group-hover:text-[var(--accent)]">
                  {template.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {template.description || "Open this template in sandbox and start building."}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span
                      key={`${template.id}-${tag}`}
                      className="border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {templates.length === 0 ? (
          <div className="border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
            No templates match the current filters.
          </div>
        ) : null}
      </section>

      <section className="mt-12" aria-label="Recent sessions">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Recent Sessions
          </p>
          {actor ? null : (
            <Link
              href="/sign-in?redirect_url=%2Fplayground"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] hover:opacity-80"
            >
              Sign In to Track Sessions
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.slice(0, 6).map((session) => {
            const template = session.templateId
              ? templateById.get(session.templateId) ?? null
              : null;
            return (
              <Link
                key={session.id}
                href={`/playground/sandbox?session=${encodeURIComponent(session.id)}`}
                className="border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--surface-2)]"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  {session.visibility}
                </p>
                <h3 className="mt-2 text-base font-semibold tracking-tight text-[var(--foreground)]">
                  {session.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {template ? `${template.title} • ${template.runtime}` : "Custom session"}
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  {session.files.length} files • updated {formatDate(session.updatedAt)}
                </p>
              </Link>
            );
          })}
        </div>

        {actor && sessions.length === 0 ? (
          <div className="border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
            No active sessions yet. Open a template to create your first sandbox session.
          </div>
        ) : null}
      </section>

      <section className="mt-px bg-[var(--border)]" aria-label="Enter playground">
        <div className="grid grid-cols-1 gap-px sm:grid-cols-[1fr_1.4fr]">
          <div className="flex items-center bg-[var(--surface)] p-8 sm:p-10">
            <Link
              href={enterUrl}
              className="inline-flex h-14 items-center gap-3 bg-[#1a1a1a] px-8 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] dark:bg-white dark:text-black"
              aria-label="Enter Playground"
            >
              Enter Playground
              <span aria-hidden="true" className="text-base font-normal leading-none">
                →
              </span>
            </Link>
          </div>

          <div className="bg-[var(--surface)] p-8 sm:p-10">
            <div className="mb-5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Recent Output
              </span>
            </div>
            <ul className="space-y-2 font-mono text-xs leading-relaxed" aria-label="Terminal output">
              {recentOutput.length > 0 ? (
                recentOutput.map((line, index) => (
                  <li
                    key={`${line.timestamp}-${index}`}
                    className={line.highlight ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}
                  >
                    <span className="mr-3">[{line.timestamp}]</span>
                    {line.text}
                    <span className="ml-2 text-[var(--muted-foreground)]">{line.secondary}</span>
                  </li>
                ))
              ) : (
                <li className="text-[var(--muted-foreground)]">
                  <span className="mr-3">[--:--:--]</span>
                  No sessions yet. Start a sandbox run to populate output.
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
