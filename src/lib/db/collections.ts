import type { Collection, Db, Document } from "mongodb";
import type {
  CertificateDocument,
  CourseDocument,
  DiscussionCommentDocument,
  DiscussionTagDocument,
  DiscussionThreadDocument,
  DiscussionVoteDocument,
  EnrollmentDocument,
  LeadCaptureDocument,
  LessonDocument,
  ModuleDocument,
  NotificationDocument,
  PlaygroundRunDocument,
  PlaygroundSessionDocument,
  PlaygroundTemplateDocument,
  ProjectDocument,
  ProjectSubmissionDocument,
  SubmissionEventDocument,
  QuizAttemptDocument,
  ProgressEventDocument,
  ProgressDocument,
  ProgressWriteIdempotencyDocument,
  ProgressWriteRateLimitDocument,
  QuizDocument,
  UploadDocument,
  UserPreferencesDocument,
  UserDocument,
  RubricDocument,
  CapstoneDocument,
  SandboxSessionDocument,
} from "@/lib/db/models";

export const COLLECTIONS = {
  users: "users",
  courses: "courses",
  modules: "modules",
  lessons: "lessons",
  projects: "projects",
  projectSubmissions: "project_submissions",
  submissionEvents: "submission_events",
  quizzes: "quizzes",
  quizAttempts: "quiz_attempts",
  enrollments: "enrollments",
  progress: "progress",
  progressEvents: "progress_events",
  progressWriteIdempotency: "progress_write_idempotency",
  progressWriteRateLimits: "progress_write_rate_limits",
  certificates: "certificates",
  uploads: "uploads",
  discussionThreads: "discussion_threads",
  discussionComments: "discussion_comments",
  discussionVotes: "discussion_votes",
  discussionTags: "discussion_tags",
  playgroundTemplates: "playground_templates",
  playgroundSessions: "playground_sessions",
  playgroundRuns: "playground_runs",
  userPreferences: "user_preferences",
  notifications: "notifications",
  leadCaptures: "lead_captures",
  rubrics: "rubrics",
  capstones: "capstones",
  sandboxSessions: "sandbox_sessions",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

function getCollection<T extends Document>(
  db: Db,
  name: CollectionName
): Collection<T> {
  return db.collection<T>(name);
}

export function usersCollection(db: Db): Collection<UserDocument> {
  return getCollection<UserDocument>(db, COLLECTIONS.users);
}

export function coursesCollection(db: Db): Collection<CourseDocument> {
  return getCollection<CourseDocument>(db, COLLECTIONS.courses);
}

export function modulesCollection(db: Db): Collection<ModuleDocument> {
  return getCollection<ModuleDocument>(db, COLLECTIONS.modules);
}

export function lessonsCollection(db: Db): Collection<LessonDocument> {
  return getCollection<LessonDocument>(db, COLLECTIONS.lessons);
}

export function projectsCollection(db: Db): Collection<ProjectDocument> {
  return getCollection<ProjectDocument>(db, COLLECTIONS.projects);
}

export function projectSubmissionsCollection(
  db: Db
): Collection<ProjectSubmissionDocument> {
  return getCollection<ProjectSubmissionDocument>(
    db,
    COLLECTIONS.projectSubmissions
  );
}

export function submissionEventsCollection(
  db: Db
): Collection<SubmissionEventDocument> {
  return getCollection<SubmissionEventDocument>(db, COLLECTIONS.submissionEvents);
}

export function quizzesCollection(db: Db): Collection<QuizDocument> {
  return getCollection<QuizDocument>(db, COLLECTIONS.quizzes);
}

export function quizAttemptsCollection(db: Db): Collection<QuizAttemptDocument> {
  return getCollection<QuizAttemptDocument>(db, COLLECTIONS.quizAttempts);
}

export function enrollmentsCollection(db: Db): Collection<EnrollmentDocument> {
  return getCollection<EnrollmentDocument>(db, COLLECTIONS.enrollments);
}

export function progressCollection(db: Db): Collection<ProgressDocument> {
  return getCollection<ProgressDocument>(db, COLLECTIONS.progress);
}

export function progressEventsCollection(
  db: Db
): Collection<ProgressEventDocument> {
  return getCollection<ProgressEventDocument>(db, COLLECTIONS.progressEvents);
}

export function progressWriteIdempotencyCollection(
  db: Db
): Collection<ProgressWriteIdempotencyDocument> {
  return getCollection<ProgressWriteIdempotencyDocument>(
    db,
    COLLECTIONS.progressWriteIdempotency
  );
}

export function progressWriteRateLimitsCollection(
  db: Db
): Collection<ProgressWriteRateLimitDocument> {
  return getCollection<ProgressWriteRateLimitDocument>(
    db,
    COLLECTIONS.progressWriteRateLimits
  );
}

export function certificatesCollection(db: Db): Collection<CertificateDocument> {
  return getCollection<CertificateDocument>(db, COLLECTIONS.certificates);
}

export function uploadsCollection(db: Db): Collection<UploadDocument> {
  return getCollection<UploadDocument>(db, COLLECTIONS.uploads);
}

export function discussionThreadsCollection(
  db: Db
): Collection<DiscussionThreadDocument> {
  return getCollection<DiscussionThreadDocument>(db, COLLECTIONS.discussionThreads);
}

export function discussionCommentsCollection(
  db: Db
): Collection<DiscussionCommentDocument> {
  return getCollection<DiscussionCommentDocument>(db, COLLECTIONS.discussionComments);
}

export function discussionVotesCollection(
  db: Db
): Collection<DiscussionVoteDocument> {
  return getCollection<DiscussionVoteDocument>(db, COLLECTIONS.discussionVotes);
}

export function discussionTagsCollection(db: Db): Collection<DiscussionTagDocument> {
  return getCollection<DiscussionTagDocument>(db, COLLECTIONS.discussionTags);
}

export function playgroundTemplatesCollection(
  db: Db
): Collection<PlaygroundTemplateDocument> {
  return getCollection<PlaygroundTemplateDocument>(
    db,
    COLLECTIONS.playgroundTemplates
  );
}

export function playgroundSessionsCollection(
  db: Db
): Collection<PlaygroundSessionDocument> {
  return getCollection<PlaygroundSessionDocument>(
    db,
    COLLECTIONS.playgroundSessions
  );
}

export function playgroundRunsCollection(db: Db): Collection<PlaygroundRunDocument> {
  return getCollection<PlaygroundRunDocument>(db, COLLECTIONS.playgroundRuns);
}

export function userPreferencesCollection(
  db: Db
): Collection<UserPreferencesDocument> {
  return getCollection<UserPreferencesDocument>(db, COLLECTIONS.userPreferences);
}

export function notificationsCollection(db: Db): Collection<NotificationDocument> {
  return getCollection<NotificationDocument>(db, COLLECTIONS.notifications);
}

export function leadCapturesCollection(db: Db): Collection<LeadCaptureDocument> {
  return getCollection<LeadCaptureDocument>(db, COLLECTIONS.leadCaptures);
}

export function rubricsCollection(db: Db): Collection<RubricDocument> {
  return getCollection<RubricDocument>(db, COLLECTIONS.rubrics);
}

export function capstonesCollection(db: Db): Collection<CapstoneDocument> {
  return getCollection<CapstoneDocument>(db, COLLECTIONS.capstones);
}

export function sandboxSessionsCollection(db: Db): Collection<SandboxSessionDocument> {
  return getCollection<SandboxSessionDocument>(db, COLLECTIONS.sandboxSessions);
}
