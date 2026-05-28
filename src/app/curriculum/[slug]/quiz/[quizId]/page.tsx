"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type QuizQuestion = {
  index: number;
  prompt: string;
  options: string[];
};

type QuizRuntimeData = {
  course: {
    id: string;
    slug: string;
    title: string;
  };
  lesson: {
    id: string;
    slug: string;
    title: string;
  };
  quiz: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    passingScore: number;
    timeLimitMinutes: number;
    questionCount: number;
    questions: QuizQuestion[];
  };
  viewer: {
    isAuthenticated: boolean;
    isEnrolled: boolean;
    attemptsCount: number;
  };
};

type QuizSubmitResult = {
  attempt: {
    id: string;
    scorePercent: number;
    passed: boolean;
  };
  evaluation: {
    questionCount: number;
    correctCount: number;
    scorePercent: number;
    passingScore: number;
    passed: boolean;
    review: Array<{
      index: number;
      prompt: string;
      selectedIndex: number;
      correctIndex: number;
      isCorrect: boolean;
      explanation: string | null;
    }>;
  };
  meta: {
    replayed: boolean;
  };
};

function buildIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `quiz-${crypto.randomUUID()}`;
  }

  return `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function QuizPage() {
  const params = useParams<{ slug: string; quizId: string }>();
  const [runtime, setRuntime] = useState<QuizRuntimeData | null>(null);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);

  const idempotencyKeyRef = useRef<string>(buildIdempotencyKey());

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/courses/${encodeURIComponent(params.slug)}/quizzes/${encodeURIComponent(
            params.quizId
          )}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as
          | { ok: true; data: QuizRuntimeData }
          | { ok: false; error: string };

        if (!response.ok || !payload.ok) {
          const parsedError = payload.ok ? "INTERNAL_ERROR" : payload.error;
          throw new Error(parsedError || "INTERNAL_ERROR");
        }

        if (cancelled) return;

        setRuntime(payload.data);
        setAnswers(Array.from({ length: payload.data.quiz.questionCount }, () => null));
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error) {
          if (loadError.message === "UNAUTHORIZED") {
            setError("Sign in to access this quiz.");
            return;
          }
          if (loadError.message === "ENROLLMENT_REQUIRED") {
            setError("Enroll in this course to attempt this quiz.");
            return;
          }
        }
        setError("Failed to load quiz runtime.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRuntime();
    return () => {
      cancelled = true;
    };
  }, [params.quizId, params.slug]);

  const answeredCount = useMemo(
    () => answers.filter((value) => Number.isInteger(value)).length,
    [answers]
  );

  const canSubmit = runtime && answeredCount === runtime.quiz.questionCount && !submitting;

  function selectAnswer(questionIndex: number, optionIndex: number) {
    if (result) return;

    setAnswers((previous) => {
      const next = [...previous];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  async function submitAttempt() {
    if (!runtime || !canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(
        `/api/v1/courses/${encodeURIComponent(params.slug)}/quizzes/${encodeURIComponent(
          params.quizId
        )}/attempts`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKeyRef.current,
          },
          body: JSON.stringify({
            answers: answers.map((value) => value ?? -1),
            durationSeconds: runtime.quiz.timeLimitMinutes * 60,
          }),
        }
      );

      const payload = (await response.json()) as
        | { ok: true; data: QuizSubmitResult }
        | { ok: false; error: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "INTERNAL_ERROR" : payload.error || "INTERNAL_ERROR");
      }

      setResult(payload.data);
    } catch (submitAttemptError) {
      if (submitAttemptError instanceof Error) {
        if (submitAttemptError.message === "UNAUTHORIZED") {
          setSubmitError("Sign in and try again.");
          return;
        }
        if (submitAttemptError.message === "ENROLLMENT_REQUIRED") {
          setSubmitError("Enroll in this course to submit the quiz.");
          return;
        }
      }

      setSubmitError("Quiz submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-3xl border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
          Loading quiz runtime...
        </div>
      </div>
    );
  }

  if (error || !runtime) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8">
        <div className="mx-auto max-w-3xl space-y-4 border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
            {error || "Quiz unavailable."}
          </p>
          <Link
            href={`/curriculum/${params.slug}`}
            className="inline-flex h-10 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]"
          >
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col rounded-none">
      <header className="flex items-center justify-between h-12 border-b border-[var(--border)] bg-[var(--surface)] px-4 shrink-0 rounded-none">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/curriculum/${params.slug}`}
            className="text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            aria-label="Exit Quiz"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </Link>
          <div className="h-4 w-[1px] bg-[var(--border)]" />
          <span className="font-mono text-[10px] text-[var(--foreground)] uppercase tracking-widest truncate">
            {runtime.quiz.title}
          </span>
        </div>

        <div className="flex-1 max-w-md mx-8 flex items-center gap-4 hidden sm:flex">
          <span className="font-mono text-[9px] text-[var(--muted-foreground)] uppercase tracking-widest shrink-0">
            {answeredCount} / {runtime.quiz.questionCount}
          </span>
          <div className="flex-1 flex gap-px bg-[var(--border)] h-1.5 rounded-none p-[1px]">
            {runtime.quiz.questions.map((question, index) => (
              <div
                key={question.index}
                className={answers[index] === null ? "flex-1 bg-[var(--background)]" : "flex-1 bg-[var(--accent)]"}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-6">
        <div className="w-full max-w-3xl">
          <div className="mb-8 border border-[var(--border)] bg-[var(--surface)] p-5">
            <h1 className="text-xl sm:text-2xl font-medium text-[var(--foreground)] tracking-tight">
              {runtime.quiz.summary || runtime.lesson.title}
            </h1>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              {runtime.quiz.questionCount} Questions • Passing Score {runtime.quiz.passingScore}% • Attempt #{runtime.viewer.attemptsCount + (result ? 1 : 0)}
            </p>
          </div>

          <div className="space-y-6">
            {runtime.quiz.questions.map((question, questionIndex) => (
              <section key={question.index} className="border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-5 py-4">
                  <h2 className="text-base font-medium text-[var(--foreground)] tracking-tight">
                    Q{questionIndex + 1}. {question.prompt || (question as Record<string, unknown>).question as string}
                  </h2>
                </div>

                <div className="flex flex-col gap-px bg-[var(--border)]">
                  {question.options.map((option, optionIndex) => {
                    const selected = answers[questionIndex] === optionIndex;
                    const review = result?.evaluation.review[questionIndex] ?? null;

                    let optionClass = "bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--foreground)]";
                    if (review) {
                      if (optionIndex === review.correctIndex) {
                        optionClass = "bg-[#21B8A8]/10 text-[var(--foreground)]";
                      } else if (selected) {
                        optionClass = "bg-[#FF7A2F]/10 text-[var(--foreground)]";
                      } else {
                        optionClass = "bg-[var(--surface)] text-[var(--muted-foreground)] opacity-70";
                      }
                    } else if (selected) {
                      optionClass = "bg-[var(--accent)]/10 text-[var(--foreground)]";
                    }

                    return (
                      <button
                        key={`${question.index}-${optionIndex}`}
                        onClick={() => selectAnswer(questionIndex, optionIndex)}
                        disabled={Boolean(result)}
                        className={`w-full text-left p-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)] rounded-none flex items-start gap-4 ${optionClass}`}
                      >
                        <div className={`mt-0.5 shrink-0 w-4 h-4 border flex items-center justify-center rounded-none font-mono text-[10px] ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--muted-foreground)] bg-[var(--background)]"}`}>
                          {selected && !review ? "×" : ""}
                          {review && optionIndex === review.correctIndex ? <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#21B8A8" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><polyline points="20 6 9 17 4 12" /></svg> : null}
                          {review && selected && optionIndex !== review.correctIndex ? <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF7A2F" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> : null}
                        </div>
                        <span className="text-sm leading-relaxed">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 min-h-[120px]">
            {!result ? (
              <div className="flex flex-col items-end gap-3">
                {submitError ? (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#FF7A2F]">{submitError}</p>
                ) : null}
                <button
                  onClick={submitAttempt}
                  disabled={!canSubmit}
                  className="h-10 px-8 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            ) : (
              <div className={`p-6 border ${result.evaluation.passed ? "border-[#21B8A8] bg-[#21B8A8]/5" : "border-[#FF7A2F] bg-[#FF7A2F]/5"} rounded-none`}>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                  <div>
                    <h3 className={`text-lg font-medium mb-3 tracking-tight ${result.evaluation.passed ? "text-[#21B8A8]" : "text-[#FF7A2F]"}`}>
                      {result.evaluation.passed ? "Passed." : "Needs another pass."}
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                      Score: {result.evaluation.scorePercent}% ({result.evaluation.correctCount}/{result.evaluation.questionCount}) • Required: {result.evaluation.passingScore}%
                    </p>
                    {result.evaluation.review.find((item) => !item.isCorrect)?.explanation ? (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                        {result.evaluation.review.find((item) => !item.isCorrect)?.explanation}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/curriculum/${params.slug}/lesson/${runtime.lesson.id}`}
                    className="shrink-0 h-10 px-8 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--foreground)] inline-flex items-center"
                  >
                    Continue
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
