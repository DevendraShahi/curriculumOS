import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
import { getCommunityThreadDetail } from "@/lib/services/community-service";
import { DiscussionThreadClient } from "@/app/community/discussion/[id]/discussion-thread-client";

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

export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authState = await auth();
  const actor = await resolveViewerActor();
  const tenantId = actor?.tenantId ?? resolveTenantId(authState.orgId);
  let detail: Awaited<ReturnType<typeof getCommunityThreadDetail>> | null = null;
  let accessRestricted = false;

  try {
    detail = await getCommunityThreadDetail({
      tenantId,
      threadId: id,
      actor,
      commentsLimit: 120,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "THREAD_NOT_FOUND" || error.message === "INVALID_THREAD_ID") {
        notFound();
      }
      if (error.message === "FORBIDDEN") {
        accessRestricted = true;
      }
    }
    if (!accessRestricted) {
      throw error;
    }
  }

  if (accessRestricted) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16 sm:px-6">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Access Required
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Sign in to view this discussion
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            This thread is visible to tenant members only.
          </p>
        </div>
      </main>
    );
  }

  if (!detail) {
    notFound();
  }

  return (
    <DiscussionThreadClient
      initialThread={detail.thread}
      initialComments={detail.comments.items}
      signedIn={Boolean(actor)}
    />
  );
}
