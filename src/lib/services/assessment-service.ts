import { createHash } from "node:crypto";
import { lessonsCollection } from "@/lib/db/collections";
import { getCourseByIdOrSlug } from "@/lib/repositories/course-repository";
import { getEnrollment } from "@/lib/repositories/enrollment-repository";
import { createQuizAttempt, countQuizAttemptsByUser, getLatestQuizAttemptByUser } from "@/lib/repositories/quiz-attempt-repository";
import { getPublishedQuizByIdOrSlugInCourse } from "@/lib/repositories/quiz-repository";
import { getMongoDb } from "@/lib/mongodb";
import { upsertCurrentActorLessonProgress } from "@/lib/services/learning-service";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;

  if (normalized.length < 8 || normalized.length > 128) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }

  return normalized;
}

function buildQuizAttemptHash(params: {
  courseId: string;
  quizId: string;
  answers: number[];
  durationSeconds: number;
}): string {
  const payload = JSON.stringify({
    courseId: params.courseId,
    quizId: params.quizId,
    answers: params.answers,
    durationSeconds: params.durationSeconds,
  });

  return createHash("sha256").update(payload).digest("hex");
}

function sanitizeQuizQuestions(
  questions: Array<{
    prompt: string;
    options: string[];
  }>
) {
  return questions.map((question, index) => ({
    index,
    prompt: question.prompt,
    options: question.options,
  }));
}

function validateAnswers(params: {
  answers: number[];
  questionCount: number;
  questions: Array<{ options: string[] }>;
}) {
  if (params.answers.length !== params.questionCount) {
    throw new Error("INVALID_QUIZ_ANSWERS");
  }

  for (let i = 0; i < params.answers.length; i += 1) {
    const selected = params.answers[i];
    if (!Number.isInteger(selected)) {
      throw new Error("INVALID_QUIZ_ANSWERS");
    }

    const optionsLength = params.questions[i]?.options.length ?? 0;
    if (selected < 0 || selected >= optionsLength) {
      throw new Error("INVALID_QUIZ_ANSWERS");
    }
  }
}

export async function getQuizRuntime(params: {
  tenantId: string;
  courseIdOrSlug: string;
  quizIdOrSlug: string;
  actor?: ActorContext | null;
}) {
  const db = await getMongoDb();

  const course = await getCourseByIdOrSlug(db, params.tenantId, params.courseIdOrSlug);
  if (!course || course.status !== "published") {
    throw new Error("COURSE_NOT_FOUND");
  }

  const quiz = await getPublishedQuizByIdOrSlugInCourse(db, {
    tenantId: params.tenantId,
    courseId: course._id,
    quizIdOrSlug: params.quizIdOrSlug,
  });

  if (!quiz) {
    throw new Error("QUIZ_NOT_FOUND");
  }

  const lesson = await lessonsCollection(db).findOne({
    tenantId: params.tenantId,
    _id: quiz.lessonId,
    courseId: course._id,
    isPublished: true,
  });

  if (!lesson) {
    throw new Error("LESSON_NOT_FOUND");
  }

  if (!lesson.isPreview && !params.actor) {
    throw new Error("UNAUTHORIZED");
  }

  const baseViewer = {
    isAuthenticated: false,
    isEnrolled: false,
    enrollmentStatus: "not_enrolled" as
      | "active"
      | "paused"
      | "completed"
      | "dropped"
      | "not_enrolled",
    attemptsCount: 0,
    latestAttempt: null as null | {
      scorePercent: number;
      passed: boolean;
      submittedAt: string;
    },
  };

  if (!params.actor) {
    return {
      tenantId: params.tenantId,
      course: {
        id: course._id.toString(),
        slug: course.slug,
        title: course.title,
      },
      lesson: {
        id: lesson._id.toString(),
        slug: lesson.slug,
        title: lesson.title,
        isPreview: lesson.isPreview,
      },
      quiz: {
        id: quiz._id.toString(),
        slug: quiz.slug,
        title: quiz.title,
        summary: quiz.summary ?? "",
        passingScore: quiz.passingScore,
        timeLimitMinutes: quiz.timeLimitMinutes,
        questionCount: quiz.questionCount,
        questions: sanitizeQuizQuestions(quiz.questions),
      },
      viewer: baseViewer,
    };
  }

  const user = await syncActorToUserDocument(params.actor);
  const enrollment = await getEnrollment(db, params.tenantId, user._id, course._id);

  if (!lesson.isPreview && !enrollment) {
    throw new Error("ENROLLMENT_REQUIRED");
  }

  const [latestAttempt, attemptsCount] = enrollment
    ? await Promise.all([
        getLatestQuizAttemptByUser(db, {
          tenantId: params.tenantId,
          userId: user._id,
          quizId: quiz._id,
        }),
        countQuizAttemptsByUser(db, {
          tenantId: params.tenantId,
          userId: user._id,
          quizId: quiz._id,
        }),
      ])
    : [null, 0];

  return {
    tenantId: params.tenantId,
    course: {
      id: course._id.toString(),
      slug: course.slug,
      title: course.title,
    },
    lesson: {
      id: lesson._id.toString(),
      slug: lesson.slug,
      title: lesson.title,
      isPreview: lesson.isPreview,
    },
    quiz: {
      id: quiz._id.toString(),
      slug: quiz.slug,
      title: quiz.title,
      summary: quiz.summary ?? "",
      passingScore: quiz.passingScore,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questionCount: quiz.questionCount,
      questions: sanitizeQuizQuestions(quiz.questions),
    },
    viewer: {
      isAuthenticated: true,
      isEnrolled: Boolean(enrollment),
      enrollmentStatus: enrollment?.status ?? "not_enrolled",
      attemptsCount,
      latestAttempt: latestAttempt
        ? {
            scorePercent: latestAttempt.scorePercent,
            passed: latestAttempt.passed,
            submittedAt: latestAttempt.submittedAt.toISOString(),
          }
        : null,
    },
  };
}

export async function submitQuizAttempt(params: {
  actor: ActorContext;
  courseIdOrSlug: string;
  quizIdOrSlug: string;
  answers: number[];
  durationSeconds?: number;
  idempotencyKey?: string;
}) {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(params.actor);

  const course = await getCourseByIdOrSlug(
    db,
    params.actor.tenantId,
    params.courseIdOrSlug
  );
  if (!course || course.status !== "published") {
    throw new Error("COURSE_NOT_FOUND");
  }

  const quiz = await getPublishedQuizByIdOrSlugInCourse(db, {
    tenantId: params.actor.tenantId,
    courseId: course._id,
    quizIdOrSlug: params.quizIdOrSlug,
  });

  if (!quiz) {
    throw new Error("QUIZ_NOT_FOUND");
  }

  const lesson = await lessonsCollection(db).findOne({
    tenantId: params.actor.tenantId,
    _id: quiz.lessonId,
    courseId: course._id,
    isPublished: true,
  });

  if (!lesson) {
    throw new Error("LESSON_NOT_FOUND");
  }

  const enrollment = await getEnrollment(
    db,
    params.actor.tenantId,
    user._id,
    course._id
  );
  if (!enrollment) {
    throw new Error("ENROLLMENT_REQUIRED");
  }

  if (!Array.isArray(params.answers)) {
    throw new Error("INVALID_QUIZ_ANSWERS");
  }

  validateAnswers({
    answers: params.answers,
    questionCount: quiz.questions.length,
    questions: quiz.questions,
  });

  let correctCount = 0;
  const review = quiz.questions.map((question, index) => {
    const selectedIndex = params.answers[index];
    const isCorrect = selectedIndex === question.answerIndex;
    if (isCorrect) correctCount += 1;

    return {
      index,
      prompt: question.prompt,
      selectedIndex,
      selectedOption: question.options[selectedIndex] ?? null,
      correctIndex: question.answerIndex,
      correctOption: question.options[question.answerIndex] ?? null,
      isCorrect,
      explanation: question.explanation ?? null,
    };
  });

  const scorePercent = clampPercent((correctCount / quiz.questions.length) * 100);
  const passed = scorePercent >= quiz.passingScore;
  const durationSeconds = Math.max(0, Math.floor(params.durationSeconds ?? 0));

  const idempotencyKey = normalizeIdempotencyKey(params.idempotencyKey);
  const requestHash = idempotencyKey
    ? buildQuizAttemptHash({
        courseId: course._id.toString(),
        quizId: quiz._id.toString(),
        answers: params.answers,
        durationSeconds,
      })
    : undefined;

  const { attempt, replayed } = await createQuizAttempt(db, {
    tenantId: params.actor.tenantId,
    userId: user._id,
    courseId: course._id,
    lessonId: lesson._id,
    quizId: quiz._id,
    enrollmentId: enrollment._id,
    scorePercent,
    passed,
    answers: params.answers,
    durationSeconds,
    idempotencyKey,
    requestHash,
  });

  let progress = null;
  if (!replayed) {
    const progressPercent = passed
      ? 100
      : Math.max(10, Math.min(99, scorePercent));
    progress = await upsertCurrentActorLessonProgress(params.actor, {
      courseId: course._id.toString(),
      lessonId: lesson._id.toString(),
      moduleId: lesson.moduleId.toString(),
      state: passed ? "completed" : "in_progress",
      progressPercent,
      timeSpentSeconds: durationSeconds,
    });
  }

  return {
    attempt: {
      id: attempt._id.toString(),
      quizId: attempt.quizId.toString(),
      lessonId: attempt.lessonId.toString(),
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt.toISOString(),
      answers: attempt.answers,
    },
    evaluation: {
      questionCount: quiz.questions.length,
      correctCount,
      scorePercent,
      passingScore: quiz.passingScore,
      passed,
      review,
    },
    meta: {
      replayed,
      idempotencyKey: idempotencyKey ?? null,
    },
    progress,
  };
}

export function parseOptionalDurationSeconds(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}
