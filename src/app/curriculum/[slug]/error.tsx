"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function CourseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry
    console.error("Course Route Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
        Something went wrong!
      </h2>
      <p className="mb-6 max-w-md text-[var(--muted-foreground)]">
        We encountered an error loading this course. {error.message ? `(${error.message})` : ""}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--accent)]/90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
