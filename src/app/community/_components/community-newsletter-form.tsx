"use client";

import { useState } from "react";

type LeadCaptureResponse = {
  ok: boolean;
  error?: string;
};

function messageForError(code: string): string {
  if (code === "INVALID_LEAD_CAPTURE") {
    return "Enter a valid email address.";
  }
  return "Could not subscribe right now. Try again.";
}

export function CommunityNewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/leads/newsletter", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          source: "community_newsletter",
          metadata: {
            page: "/community",
          },
        }),
      });

      const payload = (await response.json()) as LeadCaptureResponse;
      if (!response.ok || !payload.ok) {
        setError(messageForError(payload.error ?? "INTERNAL_ERROR"));
        return;
      }

      setSuccess("Subscribed. We will send community updates to your inbox.");
      setEmail("");
    } catch {
      setError("Could not subscribe right now. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10 border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 border border-[var(--border)] flex items-center justify-center text-[var(--accent)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Stay in the loop</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Get the best discussions and updates delivered to your inbox.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          className="h-9 flex-1 border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-9 bg-[var(--accent)] px-4 font-mono text-[10px] uppercase tracking-widest text-white disabled:opacity-60"
        >
          {submitting ? "Subscribing" : "Subscribe"}
        </button>
      </form>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-600">{success}</p> : null}
    </div>
  );
}
