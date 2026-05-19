"use client";

import { useState } from "react";

type LeadResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

function messageForLeadError(code: string): string {
  if (code === "INVALID_LEAD_CAPTURE") {
    return "Enter a valid email address.";
  }
  return "Unable to submit request right now. Try again.";
}

export function RequestAccessCta() {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
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
          fullName: fullName.trim() || undefined,
          source: "homepage_request_access",
          metadata: {
            page: "/",
          },
        }),
      });
      const payload = (await response.json()) as LeadResponse;
      if (!response.ok || !payload.ok) {
        const code = "error" in payload ? payload.error : "INTERNAL_ERROR";
        setError(messageForLeadError(code));
        return;
      }
      setSuccess("Request received. We will reach out when access opens.");
      setEmail("");
      setFullName("");
    } catch {
      setError("Unable to submit request right now. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex h-12 items-center gap-3 bg-[#1a1a1a] px-8 text-[11px] font-semibold uppercase tracking-widest text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        Request Access{" "}
        <span aria-hidden className="font-normal text-base leading-none">
          →
        </span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm border border-[var(--border)] bg-[var(--surface)] p-4">
      <form onSubmit={submitLead} className="space-y-3">
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name (optional)"
          className="h-10 w-full border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        />
        <input
          type="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-10 w-full border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center bg-[#1a1a1a] px-4 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-black disabled:opacity-60"
          >
            {submitting ? "Submitting" : "Submit"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex h-10 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      </form>
      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-xs text-emerald-600">{success}</p> : null}
    </div>
  );
}
