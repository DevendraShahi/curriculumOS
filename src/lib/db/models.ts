import type { ObjectId } from "mongodb";

export type TenantScoped = {
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRole =
  | "learner"
  | "instructor"
  | "mentor"
  | "tenant_admin"
  | "super_admin";

export type UserDocument = TenantScoped & {
  _id: ObjectId;
  clerkUserId: string;
  email: string;
  emailLower: string;
  username?: string;
  usernameLower?: string;
  fullName: string;
  imageUrl?: string;
  roles: UserRole[];
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
  unsafeMetadata?: Record<string, unknown>;
  lastSignInAt?: Date;
  disabledAt?: Date | null;
};

export type UserPreferenceFlags = {
  developerMode: boolean;
  publicHeatmap: boolean;
  strictTypeChecking: boolean;
};

export type UserPreferenceDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  flags: UserPreferenceFlags;
};

export type CourseStatus = "draft" | "published" | "archived";
export type CourseVisibility = "public" | "private" | "unlisted";

export type CourseDocument = TenantScoped & {
  _id: ObjectId;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  category?: string;
  level?: "beginner" | "intermediate" | "advanced";
  tags?: string[];
  status: CourseStatus;
  visibility: CourseVisibility;
  instructorIds?: ObjectId[];
  modulesCount: number;
  lessonsCount: number;
  durationMinutes: number;
  publishedAt?: Date | null;
};

export type ModuleDocument = TenantScoped & {
  _id: ObjectId;
  courseId: ObjectId;
  slug: string;
  title: string;
  description?: string;
  order: number;
  durationMinutes: number;
  lessonsCount: number;
  isPublished: boolean;
};

export type LessonContentType = "text" | "video" | "project" | "quiz";

export type LessonStarterFile = {
  path: string;
  language: string;
  content: string;
};

export type LessonDocument = TenantScoped & {
  _id: ObjectId;
  courseId: ObjectId;
  moduleId: ObjectId;
  slug: string;
  title: string;
  summary?: string;
  description?: string;
  order: number;
  durationMinutes: number;
  contentType: LessonContentType;
  isPreview: boolean;
  isPublished: boolean;
  learningObjectives?: string[];
  instructions?: string[];
  bodyMarkdown?: string;
  starterFiles?: LessonStarterFile[];
  expectedOutput?: string[];
};

export type ProjectStatus = "published" | "archived";

export type ProjectDocument = TenantScoped & {
  _id: ObjectId;
  courseId: ObjectId;
  moduleId: ObjectId;
  lessonId: ObjectId;
  slug: string;
  title: string;
  summary?: string;
  order: number;
  estimatedMinutes: number;
  isPublished: boolean;
  status: ProjectStatus;
  rubric: string[];
};

export type ProjectSubmissionStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "changes_requested";

export type ProjectSubmissionDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  moduleId: ObjectId;
  lessonId: ObjectId;
  projectId: ObjectId;
  enrollmentId?: ObjectId | null;
  idempotencyKey?: string;
  status: ProjectSubmissionStatus;
  summary?: string;
  repositoryUrl?: string;
  liveUrl?: string;
  notes?: string;
  rubricScores?: Array<{
    criterion: string;
    score: number;
  }>;
  submittedAt: Date;
  reviewedAt?: Date | null;
};

export type QuizStatus = "published" | "archived";

export type QuizQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

export type QuizDocument = TenantScoped & {
  _id: ObjectId;
  courseId: ObjectId;
  moduleId: ObjectId;
  lessonId: ObjectId;
  slug: string;
  title: string;
  summary?: string;
  order: number;
  passingScore: number;
  timeLimitMinutes: number;
  questionCount: number;
  questions: QuizQuestion[];
  isPublished: boolean;
  status: QuizStatus;
};

export type QuizAttemptDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  lessonId: ObjectId;
  quizId: ObjectId;
  enrollmentId?: ObjectId | null;
  scorePercent: number;
  passed: boolean;
  answers: number[];
  durationSeconds: number;
  submittedAt: Date;
  idempotencyKey?: string;
  requestHash?: string;
};

export type EnrollmentStatus = "active" | "completed" | "paused" | "dropped";

export type EnrollmentDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  status: EnrollmentStatus;
  enrolledAt: Date;
  completedAt?: Date | null;
  progressPercent: number;
  lastLessonId?: string | null;
  lastLessonRefId?: ObjectId | null;
  source?: "direct" | "cohort" | "coupon" | "admin";
};

export type ProgressState = "not_started" | "in_progress" | "completed";

export type ProgressDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  moduleId?: string | null;
  moduleRefId?: ObjectId | null;
  lessonId: string;
  lessonRefId?: ObjectId | null;
  enrollmentId?: ObjectId | null;
  state: ProgressState;
  progressPercent: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  lastActivityAt?: Date | null;
  timeSpentSeconds?: number;
};

export type ProgressEventType =
  | "lesson_started"
  | "lesson_progressed"
  | "lesson_completed"
  | "lesson_reopened";

export type ProgressEventDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  lessonId: string;
  lessonRefId?: ObjectId | null;
  moduleId?: string | null;
  moduleRefId?: ObjectId | null;
  enrollmentId?: ObjectId | null;
  eventType: ProgressEventType;
  state: ProgressState;
  progressPercent: number;
  progressDelta: number;
  timeSpentSeconds?: number;
  timeSpentDelta?: number;
  occurredAt: Date;
  metadata?: {
    source?: "api_v1_progress" | "backfill_progress_snapshot_v1";
  };
};

export type ProgressWriteIdempotencyScope = "api_v1_progress_post";

export type ProgressWriteIdempotencyDocument = TenantScoped & {
  _id: string;
  userId: ObjectId;
  scope: ProgressWriteIdempotencyScope;
  key: string;
  requestHash: string;
  status: "pending" | "completed";
  responseData?: Record<string, unknown>;
  expiresAt: Date;
};

export type ProgressWriteRateLimitDocument = TenantScoped & {
  _id: string;
  userId: ObjectId;
  scope: ProgressWriteIdempotencyScope;
  windowStartMs: number;
  count: number;
  expiresAt: Date;
};

export type CertificateStatus = "issued" | "revoked";

export type CertificateDocument = TenantScoped & {
  _id: ObjectId;
  code: string;
  userId: ObjectId;
  courseId: ObjectId;
  enrollmentId?: ObjectId | null;
  status: CertificateStatus;
  issuedAt: Date;
  revokedAt?: Date | null;
  asset?: {
    provider: "cloudinary";
    publicId: string;
    secureUrl: string;
  };
};

export type UploadContext =
  | "profile"
  | "lesson"
  | "project"
  | "submission"
  | "certificate";

export type UploadStatus = "pending" | "uploaded" | "failed" | "deleted";

export type UploadDocument = TenantScoped & {
  _id: ObjectId;
  userId?: ObjectId | null;
  context: UploadContext;
  publicId: string;
  secureUrl: string;
  resourceType: "image" | "video" | "raw" | "auto";
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  tags?: string[];
  status: UploadStatus;
  courseId?: ObjectId | null;
  lessonId?: string | null;
  projectId?: string | null;
  deletedAt?: Date | null;
};

export type DiscussionThreadVisibility = "public" | "tenant_members";
export type DiscussionThreadStatus = "open" | "locked" | "archived";

export type DiscussionThreadDocument = TenantScoped & {
  _id: ObjectId;
  authorUserId: ObjectId;
  title: string;
  body: string;
  category?: string;
  tags: string[];
  pinned: boolean;
  visibility: DiscussionThreadVisibility;
  status: DiscussionThreadStatus;
  answerCommentId?: ObjectId | null;
  commentsCount: number;
  votesScore: number;
  lastActivityAt: Date;
};

export type DiscussionCommentStatus = "visible" | "deleted" | "moderated";

export type DiscussionCommentDocument = TenantScoped & {
  _id: ObjectId;
  threadId: ObjectId;
  authorUserId: ObjectId;
  body: string;
  parentCommentId?: ObjectId | null;
  depth: number;
  isAnswer: boolean;
  status: DiscussionCommentStatus;
  votesScore: number;
};

export type DiscussionVoteTargetType = "thread" | "comment";

export type DiscussionVoteDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  targetType: DiscussionVoteTargetType;
  targetId: ObjectId;
  value: 1 | -1;
};

export type DiscussionTagDocument = TenantScoped & {
  _id: ObjectId;
  slug: string;
  label: string;
  usageCount: number;
  lastUsedAt?: Date | null;
};

export type PlaygroundTemplateVisibility = "public" | "tenant_members";

export type PlaygroundTemplateFile = {
  path: string;
  language: string;
  content: string;
};

export type PlaygroundTemplateValidationRuleType =
  | "file_exists"
  | "file_includes"
  | "file_regex";

export type PlaygroundTemplateValidationRule = {
  id: string;
  label: string;
  type: PlaygroundTemplateValidationRuleType;
  filePath: string;
  value?: string;
  flags?: string;
  caseSensitive?: boolean;
  required?: boolean;
};

export type PlaygroundTemplateDocument = TenantScoped & {
  _id: ObjectId;
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  runtime: string;
  visibility: PlaygroundTemplateVisibility;
  isPublished: boolean;
  starterFiles: PlaygroundTemplateFile[];
  validationRules?: PlaygroundTemplateValidationRule[];
};

export type PlaygroundSessionVisibility = "private" | "unlisted" | "public";
export type PlaygroundSessionStatus = "active" | "archived";

export type PlaygroundSessionFile = {
  path: string;
  language: string;
  content: string;
};

export type PlaygroundSessionDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  templateId?: ObjectId | null;
  forkedFromSessionId?: ObjectId | null;
  title: string;
  visibility: PlaygroundSessionVisibility;
  status: PlaygroundSessionStatus;
  files: PlaygroundSessionFile[];
  latestRunId?: ObjectId | null;
  lastRunAt?: Date | null;
};

export type PlaygroundRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out";

export type PlaygroundRunMode = "run" | "test" | "check";

export type PlaygroundRunDocument = TenantScoped & {
  _id: ObjectId;
  sessionId: ObjectId;
  userId: ObjectId;
  mode: PlaygroundRunMode;
  status: PlaygroundRunStatus;
  runtime: string;
  exitCode?: number | null;
  summary?: string;
  rawLog?: string;
  checks?: Array<{
    id: string;
    label: string;
    passed: boolean;
    message?: string;
  }>;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
};

export type UserPreferencesDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  profileVisibility: "public" | "private";
  emailDigestEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  preferredEditorTheme: "system" | "light" | "dark";
  weeklyLearningGoalMinutes?: number;
};

export type NotificationDocument = TenantScoped & {
  _id: ObjectId;
  userId: ObjectId;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  readAt?: Date | null;
};

export type LeadCaptureStatus = "new" | "contacted" | "unsubscribed";

export type LeadCaptureDocument = TenantScoped & {
  _id: ObjectId;
  userId?: ObjectId | null;
  email: string;
  emailLower: string;
  fullName?: string;
  source: string;
  status: LeadCaptureStatus;
  capturedAt: Date;
  metadata?: Record<string, unknown>;
};

export type SubmissionEventType =
  | "created"
  | "status_changed"
  | "feedback_added";

export type SubmissionEventDocument = TenantScoped & {
  _id: ObjectId;
  submissionId: ObjectId;
  actorUserId?: ObjectId | null;
  eventType: SubmissionEventType;
  fromStatus?: ProjectSubmissionStatus | null;
  toStatus?: ProjectSubmissionStatus | null;
  note?: string;
  occurredAt: Date;
};
