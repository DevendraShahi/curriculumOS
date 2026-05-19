"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CommunityThread = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  commentsCount: number;
  votesScore: number;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    username: string | null;
    imageUrl: string | null;
  } | null;
  viewerVote: -1 | 0 | 1;
};

type CommunityComment = {
  id: string;
  threadId: string;
  author: {
    id: string;
    fullName: string;
    username: string | null;
    imageUrl: string | null;
  } | null;
  body: string;
  parentCommentId: string | null;
  depth: number;
  votesScore: number;
  createdAt: string;
  viewerVote: -1 | 0 | 1;
};

const avatarColors = [
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))}m ago`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))}h ago`;
  }
  return `${Math.max(1, Math.round(diff / day))}d ago`;
}

function voteLabel(viewerVote: -1 | 0 | 1, direction: 1 | -1): string {
  if (direction === 1) {
    return viewerVote === 1 ? "Upvoted" : "Upvote";
  }
  return viewerVote === -1 ? "Downvoted" : "Downvote";
}

export function DiscussionThreadClient(props: {
  initialThread: CommunityThread;
  initialComments: CommunityComment[];
  signedIn: boolean;
}) {
  const [thread, setThread] = useState(props.initialThread);
  const [comments, setComments] = useState(props.initialComments);
  const [posting, setPosting] = useState(false);
  const [votingTarget, setVotingTarget] = useState<string | null>(null);
  const [topLevelDraft, setTopLevelDraft] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      if (left !== right) return left - right;
      return a.id.localeCompare(b.id);
    });
  }, [comments]);

  async function vote(targetType: "thread" | "comment", targetId: string, value: 1 | -1) {
    if (!props.signedIn) {
      setError("Sign in to vote.");
      return;
    }
    setVotingTarget(`${targetType}:${targetId}:${value}`);
    setError(null);
    try {
      const response = await fetch("/api/v1/community/votes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetType,
          targetId,
          value,
        }),
      });
      const payload = (await response.json()) as
        | {
            ok: true;
            data: {
              targetType: "thread" | "comment";
              targetId: string;
              votesScore: number;
              viewerVote: -1 | 0 | 1;
            };
          }
        | {
            ok: false;
            error: string;
          };

      if (!response.ok || !payload.ok) {
        setError("Unable to record vote.");
        return;
      }

      if (payload.data.targetType === "thread") {
        setThread((current) => ({
          ...current,
          votesScore: payload.data.votesScore,
          viewerVote: payload.data.viewerVote,
        }));
      } else {
        setComments((current) =>
          current.map((comment) =>
            comment.id === payload.data.targetId
              ? {
                  ...comment,
                  votesScore: payload.data.votesScore,
                  viewerVote: payload.data.viewerVote,
                }
              : comment
          )
        );
      }
    } catch {
      setError("Unable to record vote.");
    } finally {
      setVotingTarget(null);
    }
  }

  async function submitComment(body: string, parentCommentId?: string | null) {
    if (!props.signedIn) {
      setError("Sign in to post an answer.");
      return;
    }
    const normalized = body.trim();
    if (!normalized) return;

    setPosting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/community/threads/${thread.id}/comments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          body: normalized,
          parentCommentId: parentCommentId ?? undefined,
        }),
      });
      const payload = (await response.json()) as
        | {
            ok: true;
            data: CommunityComment;
          }
        | {
            ok: false;
            error: string;
          };
      if (!response.ok || !payload.ok) {
        setError("Unable to post comment.");
        return;
      }

      setComments((current) => [...current, payload.data]);
      setThread((current) => ({
        ...current,
        commentsCount: current.commentsCount + 1,
      }));
      if (parentCommentId) {
        setReplyParentId(null);
        setReplyDraft("");
      } else {
        setTopLevelDraft("");
      }
    } catch {
      setError("Unable to post comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="flex items-center gap-2 sm:gap-4 h-12 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 shrink-0">
        <Link href="/community" className="text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer" aria-label="Back to Community">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </Link>
        <div className="h-4 w-[1px] bg-[var(--border)]" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Community</span>
        <span className="text-[var(--muted-foreground)]">/</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] truncate">Discussion</span>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 lg:gap-8">
        <div className="min-w-0">
          {error ? (
            <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1 sm:gap-2 shrink-0 pt-1">
                <button
                  type="button"
                  onClick={() => void vote("thread", thread.id, 1)}
                  disabled={votingTarget === `thread:${thread.id}:1`}
                  className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] h-10 sm:h-7 px-2 border ${
                    thread.viewerVote === 1
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                  aria-label={voteLabel(thread.viewerVote, 1)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                  <span className="hidden sm:inline">{thread.votesScore}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void vote("thread", thread.id, -1)}
                  disabled={votingTarget === `thread:${thread.id}:-1`}
                  className={`flex items-center justify-center font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] h-10 sm:h-7 px-2 border ${
                    thread.viewerVote === -1
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                  aria-label={voteLabel(thread.viewerVote, -1)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(thread.tags.length > 0 ? thread.tags : ["general"]).map((tag) => (
                    <Link
                      key={tag}
                      href={`/community?tag=${encodeURIComponent(tag)}`}
                      className="border border-[var(--border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
                <h1 className="text-2xl text-[var(--foreground)] tracking-tight font-medium mb-6">
                  {thread.title}
                </h1>
                <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap mb-8">
                  {thread.body}
                </div>
                <div className="flex items-center gap-3 border-t border-[var(--border)] pt-5">
                  <div
                    className={`w-7 h-7 flex items-center justify-center text-[10px] font-bold ${
                      avatarColors[thread.id.length % avatarColors.length]
                    }`}
                  >
                    {initials(thread.author?.fullName ?? "Unknown User")}
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {thread.author?.fullName ?? "Unknown User"}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Posted {formatRelativeTime(thread.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--surface)] mb-8">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {thread.commentsCount} Answers
              </h2>
            </div>
            <div className="px-6">
              {sortedComments.map((comment) => (
                <div
                  key={comment.id}
                  className={`${comment.depth > 0 ? "ml-3 sm:ml-6 md:ml-8 border-l border-[var(--border)] pl-3 sm:pl-4 md:pl-6" : ""}`}
                >
                  <div className="py-4 sm:py-5 border-b border-[var(--border)] last:border-b-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className={`w-7 h-7 flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColors[comment.id.length % avatarColors.length]}`}>
                        {initials(comment.author?.fullName ?? "Unknown User")}
                      </div>
                      <div className="flex-1 flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                        <span className="text-sm font-medium text-[var(--foreground)] truncate">
                          {comment.author?.fullName ?? "Unknown User"}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] shrink-0">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-[var(--foreground)] leading-relaxed mb-3 sm:mb-4 pl-0 sm:pl-10 whitespace-pre-wrap">
                      {comment.body}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 pl-0 sm:pl-10 flex-wrap">
                      <button
                        type="button"
                        onClick={() => void vote("comment", comment.id, 1)}
                        disabled={votingTarget === `comment:${comment.id}:1`}
                        className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] h-10 sm:h-7 px-2 border ${
                          comment.viewerVote === 1
                            ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                            : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        }`}
                        aria-label={voteLabel(comment.viewerVote, 1)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                        <span className="hidden sm:inline">{comment.votesScore}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void vote("comment", comment.id, -1)}
                        disabled={votingTarget === `comment:${comment.id}:-1`}
                        className={`flex items-center justify-center font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] h-10 sm:h-7 px-2 border ${
                          comment.viewerVote === -1
                            ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5"
                            : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        }`}
                        aria-label={voteLabel(comment.viewerVote, -1)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyParentId((current) =>
                            current === comment.id ? null : comment.id
                          );
                          setReplyDraft("");
                        }}
                        className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer ml-2"
                      >
                        Reply
                      </button>
                    </div>

                    {replyParentId === comment.id ? (
                      <div className="mt-3 sm:mt-4 pl-0 sm:pl-10 flex flex-col gap-2">
                        <textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          placeholder="Write a reply..."
                          rows={3}
                          className="w-full border border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyParentId(null);
                              setReplyDraft("");
                            }}
                            className="h-10 sm:h-8 px-4 border border-[var(--border)] font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={posting || replyDraft.trim().length === 0}
                            onClick={() => void submitComment(replyDraft, comment.id)}
                            className="h-10 sm:h-8 px-4 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4 sm:mb-5">
              Post an Answer
            </h2>
            <textarea
              value={topLevelDraft}
              onChange={(event) => setTopLevelDraft(event.target.value)}
              placeholder={props.signedIn ? "Share your knowledge. Be specific and detailed." : "Sign in to post an answer."}
              rows={4}
              disabled={!props.signedIn}
              className="w-full border border-[var(--border)] bg-[var(--background)] px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-colors resize-none mb-3 sm:mb-4 disabled:opacity-70"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!props.signedIn || posting || topLevelDraft.trim().length === 0}
                onClick={() => void submitComment(topLevelDraft, null)}
                className="h-12 sm:h-10 px-6 sm:px-8 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
              >
                Post Answer
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-6 shrink-0">
          <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">
              Thread Stats
            </h2>
            <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
              {[
                ["Asked", formatRelativeTime(thread.createdAt)],
                ["Answers", String(thread.commentsCount)],
                ["Votes", String(thread.votesScore)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center px-4 py-3 bg-[var(--surface)]">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {label}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--foreground)]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
