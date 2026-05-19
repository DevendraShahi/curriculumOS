import { ObjectId } from "mongodb";
import { lessonsCollection } from "@/lib/db/collections";
import { countIssuedCertificates } from "@/lib/repositories/certificate-repository";
import {
  countEnrollmentsByStatus,
  listEnrollmentsByUser,
} from "@/lib/repositories/enrollment-repository";
import { listProgressEventsByUser } from "@/lib/repositories/progress-event-repository";
import { countProgressByStateAcrossCourses } from "@/lib/repositories/progress-repository";
import { countProjectSubmissionsByUser } from "@/lib/repositories/project-submission-repository";
import { countQuizAttemptsByUserInTenant } from "@/lib/repositories/quiz-attempt-repository";
import { countPublishedLessonsByCourses } from "@/lib/repositories/syllabus-repository";
import {
  getUserPreferences,
  upsertUserPreferences,
  type UserPreferencesPatch,
} from "@/lib/repositories/user-preferences-repository";
import { getMongoDb } from "@/lib/mongodb";
import {
  buildWeeklyProgressMetrics,
  toLessonLookupKey,
  type RecentProgressOutputItem,
  type WeeklyMetricCell,
} from "@/lib/services/progress-metrics-service";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";
import type {
  ProgressEventDocument,
  UserPreferencesDocument,
} from "@/lib/db/models";

const DAY_MS = 24 * 60 * 60 * 1_000;
const PROFILE_METRIC_WINDOW_DAYS = 91;
const PROFILE_RECENT_OUTPUT_LIMIT = 6;

type ProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  completionPercent: number;
};

export type ProfilePreferencesData = {
  profileVisibility: "public" | "private";
  emailDigestEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  preferredEditorTheme: "system" | "light" | "dark";
  weeklyLearningGoalMinutes: number | null;
};

export type ProfileOverviewData = {
  id: string;
  tenantId: string;
  clerkUserId: string;
  fullName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  preferences: ProfilePreferencesData;
  stats: {
    enrollments: {
      active: number;
      completed: number;
      paused: number;
      dropped: number;
    };
    progress: ProgressSummary;
    certificatesIssued: number;
    quizAttempts: number;
    projectSubmissions: number;
  };
  activity: {
    metricWindowDays: number;
    generatedAt: string;
    cells: WeeklyMetricCell[];
    streakDays: number;
    totalUpdates: number;
    completedEvents: number;
    activeDays: number;
    recentOutput: RecentProgressOutputItem[];
  };
};

function toProfilePreferencesData(
  preferences: UserPreferencesDocument | null
): ProfilePreferencesData {
  if (!preferences) {
    return {
      profileVisibility: "public",
      emailDigestEnabled: true,
      inAppNotificationsEnabled: true,
      preferredEditorTheme: "system",
      weeklyLearningGoalMinutes: null,
    };
  }

  return {
    profileVisibility: preferences.profileVisibility,
    emailDigestEnabled: preferences.emailDigestEnabled,
    inAppNotificationsEnabled: preferences.inAppNotificationsEnabled,
    preferredEditorTheme: preferences.preferredEditorTheme,
    weeklyLearningGoalMinutes: preferences.weeklyLearningGoalMinutes ?? null,
  };
}

export type UpdateProfilePreferencesInput = {
  profileVisibility?: unknown;
  emailDigestEnabled?: unknown;
  inAppNotificationsEnabled?: unknown;
  preferredEditorTheme?: unknown;
  weeklyLearningGoalMinutes?: unknown;
};

function parseProfilePreferencesPatch(input: unknown): UserPreferencesPatch {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_PROFILE_PREFERENCES");
  }

  const payload = input as UpdateProfilePreferencesInput;
  const patch: UserPreferencesPatch = {};

  if (payload.profileVisibility !== undefined) {
    if (
      payload.profileVisibility !== "public" &&
      payload.profileVisibility !== "private"
    ) {
      throw new Error("INVALID_PROFILE_PREFERENCES");
    }
    patch.profileVisibility = payload.profileVisibility;
  }

  if (payload.emailDigestEnabled !== undefined) {
    if (typeof payload.emailDigestEnabled !== "boolean") {
      throw new Error("INVALID_PROFILE_PREFERENCES");
    }
    patch.emailDigestEnabled = payload.emailDigestEnabled;
  }

  if (payload.inAppNotificationsEnabled !== undefined) {
    if (typeof payload.inAppNotificationsEnabled !== "boolean") {
      throw new Error("INVALID_PROFILE_PREFERENCES");
    }
    patch.inAppNotificationsEnabled = payload.inAppNotificationsEnabled;
  }

  if (payload.preferredEditorTheme !== undefined) {
    if (
      payload.preferredEditorTheme !== "system" &&
      payload.preferredEditorTheme !== "light" &&
      payload.preferredEditorTheme !== "dark"
    ) {
      throw new Error("INVALID_PROFILE_PREFERENCES");
    }
    patch.preferredEditorTheme = payload.preferredEditorTheme;
  }

  if (payload.weeklyLearningGoalMinutes !== undefined) {
    if (payload.weeklyLearningGoalMinutes === null) {
      patch.weeklyLearningGoalMinutes = null;
    } else {
      if (
        typeof payload.weeklyLearningGoalMinutes !== "number" ||
        !Number.isInteger(payload.weeklyLearningGoalMinutes) ||
        payload.weeklyLearningGoalMinutes < 0 ||
        payload.weeklyLearningGoalMinutes > 10_080
      ) {
        throw new Error("INVALID_PROFILE_PREFERENCES");
      }
      patch.weeklyLearningGoalMinutes = payload.weeklyLearningGoalMinutes;
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("INVALID_PROFILE_PREFERENCES");
  }

  return patch;
}

function makeProgressSummary(params: {
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
}): ProgressSummary {
  const totalLessons = Math.max(0, params.totalLessons);
  const completedLessons = Math.max(0, params.completedLessons);
  const inProgressLessons = Math.max(0, params.inProgressLessons);

  return {
    totalLessons,
    completedLessons,
    inProgressLessons,
    completionPercent:
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
  };
}

async function buildLessonTitleLookup(params: {
  db: Awaited<ReturnType<typeof getMongoDb>>;
  tenantId: string;
  events: ProgressEventDocument[];
}): Promise<Map<string, string>> {
  const lessonTitlesById = new Map<string, string>();
  if (params.events.length === 0) return lessonTitlesById;

  const uniqueLessonIds = Array.from(
    new Set(params.events.map((event) => event.lessonId).filter(Boolean))
  );
  const uniqueCourseIds = Array.from(
    new Set(params.events.map((event) => event.courseId.toString()))
  )
    .filter(ObjectId.isValid)
    .map((courseId) => new ObjectId(courseId));
  const lessonObjectIds = uniqueLessonIds
    .filter(ObjectId.isValid)
    .map((lessonId) => new ObjectId(lessonId));

  const lessonRows = await lessonsCollection(params.db)
    .find({
      tenantId: params.tenantId,
      ...(uniqueCourseIds.length > 0 ? { courseId: { $in: uniqueCourseIds } } : {}),
      $or: [
        { slug: { $in: uniqueLessonIds } },
        ...(lessonObjectIds.length > 0 ? [{ _id: { $in: lessonObjectIds } }] : []),
      ],
    })
    .project({ _id: 1, courseId: 1, slug: 1, title: 1 })
    .toArray();

  for (const lesson of lessonRows) {
    lessonTitlesById.set(
      toLessonLookupKey(lesson.courseId.toString(), lesson.slug),
      lesson.title
    );
    lessonTitlesById.set(
      toLessonLookupKey(lesson.courseId.toString(), lesson._id.toString()),
      lesson.title
    );
    lessonTitlesById.set(lesson.slug, lesson.title);
    lessonTitlesById.set(lesson._id.toString(), lesson.title);
  }

  return lessonTitlesById;
}

export async function getProfileOverview(actor: ActorContext): Promise<ProfileOverviewData> {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);

  const [
    enrollmentCounts,
    enrollments,
    certificateCount,
    quizAttempts,
    projectSubmissions,
    preferences,
  ] = await Promise.all([
    countEnrollmentsByStatus(db, actor.tenantId, user._id),
    listEnrollmentsByUser(db, actor.tenantId, user._id),
    countIssuedCertificates(db, actor.tenantId, user._id),
    countQuizAttemptsByUserInTenant(db, {
      tenantId: actor.tenantId,
      userId: user._id,
    }),
    countProjectSubmissionsByUser(db, {
      tenantId: actor.tenantId,
      userId: user._id,
    }),
    getUserPreferences(db, actor.tenantId, user._id),
  ]);

  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const [lessonTotalsByCourse, completedLessons, inProgressLessons] = await Promise.all([
    countPublishedLessonsByCourses(db, actor.tenantId, courseIds),
    countProgressByStateAcrossCourses(
      db,
      actor.tenantId,
      user._id,
      "completed",
      courseIds
    ),
    countProgressByStateAcrossCourses(
      db,
      actor.tenantId,
      user._id,
      "in_progress",
      courseIds
    ),
  ]);

  const totalLessons = Array.from(lessonTotalsByCourse.values()).reduce(
    (total, value) => total + value,
    0
  );
  const progressSummary = makeProgressSummary({
    totalLessons,
    completedLessons,
    inProgressLessons,
  });

  const now = new Date();
  const startAt = new Date(now.getTime() - (PROFILE_METRIC_WINDOW_DAYS - 1) * DAY_MS);
  const events = await listProgressEventsByUser(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    startAt,
    endAt: now,
    limit: 5_000,
  });

  const lessonTitlesById = await buildLessonTitleLookup({
    db,
    tenantId: actor.tenantId,
    events,
  });

  const metrics = buildWeeklyProgressMetrics({
    events,
    lessonTitlesById,
    now,
    metricWindowDays: PROFILE_METRIC_WINDOW_DAYS,
    weekDays: PROFILE_METRIC_WINDOW_DAYS,
    recentOutputLimit: PROFILE_RECENT_OUTPUT_LIMIT,
  });

  return {
    id: user._id.toString(),
    tenantId: user.tenantId,
    clerkUserId: user.clerkUserId,
    fullName: user.fullName,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    preferences: toProfilePreferencesData(preferences),
    stats: {
      enrollments: enrollmentCounts,
      progress: progressSummary,
      certificatesIssued: certificateCount,
      quizAttempts,
      projectSubmissions,
    },
    activity: {
      metricWindowDays: PROFILE_METRIC_WINDOW_DAYS,
      generatedAt: now.toISOString(),
      cells: metrics.cells,
      streakDays: metrics.streakDays,
      totalUpdates: metrics.thisWeekTouches,
      completedEvents: metrics.thisWeekCompleted,
      activeDays: metrics.thisWeekActiveDays,
      recentOutput: metrics.recentOutput,
    },
  };
}

export async function updateProfilePreferences(
  actor: ActorContext,
  input: unknown
): Promise<ProfilePreferencesData> {
  const patch = parseProfilePreferencesPatch(input);
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);

  const updated = await upsertUserPreferences(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    patch,
  });

  return toProfilePreferencesData(updated);
}
