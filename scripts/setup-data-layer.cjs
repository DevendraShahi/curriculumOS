const { MongoClient } = require("mongodb");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = requireEnv("MONGODB_DB_NAME");

const plans = [
  {
    collection: "users",
    indexes: [
      {
        key: { tenantId: 1, clerkUserId: 1 },
        options: { name: "uq_users_tenant_clerk", unique: true },
      },
      {
        key: { tenantId: 1, emailLower: 1 },
        options: {
          name: "uq_users_tenant_email",
          unique: true,
          partialFilterExpression: { emailLower: { $type: "string" } },
        },
      },
      {
        key: { tenantId: 1, usernameLower: 1 },
        options: {
          name: "uq_users_tenant_username",
          unique: true,
          partialFilterExpression: { usernameLower: { $type: "string" } },
        },
      },
      {
        key: { tenantId: 1, updatedAt: -1 },
        options: { name: "ix_users_tenant_updatedAt" },
      },
    ],
  },
  {
    collection: "courses",
    indexes: [
      {
        key: { tenantId: 1, slug: 1 },
        options: { name: "uq_courses_tenant_slug", unique: true },
      },
      {
        key: { tenantId: 1, status: 1, updatedAt: -1 },
        options: { name: "ix_courses_tenant_status_updatedAt" },
      },
      {
        key: { tenantId: 1, category: 1, status: 1, updatedAt: -1 },
        options: {
          name: "ix_courses_tenant_category_status_updatedAt",
          partialFilterExpression: { category: { $type: "string" } },
        },
      },
      {
        key: { tenantId: 1, publishedAt: -1 },
        options: {
          name: "ix_courses_tenant_publishedAt",
          partialFilterExpression: { publishedAt: { $type: "date" } },
        },
      },
      {
        key: { tenantId: 1, level: 1, status: 1, updatedAt: -1 },
        options: {
          name: "ix_courses_tenant_level_status_updatedAt",
          partialFilterExpression: { level: { $type: "string" } },
        },
      },
      {
        key: { tenantId: 1, tags: 1, status: 1, updatedAt: -1 },
        options: {
          name: "ix_courses_tenant_tags_status_updatedAt",
          partialFilterExpression: { tags: { $type: "array" } },
        },
      },
    ],
  },
  {
    collection: "modules",
    indexes: [
      {
        key: { tenantId: 1, courseId: 1, slug: 1 },
        options: { name: "uq_modules_tenant_course_slug", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, order: 1 },
        options: { name: "uq_modules_tenant_course_order", unique: true },
      },
      {
        key: { tenantId: 1, isPublished: 1, updatedAt: -1 },
        options: { name: "ix_modules_tenant_published_updatedAt" },
      },
    ],
  },
  {
    collection: "lessons",
    indexes: [
      {
        key: { tenantId: 1, moduleId: 1, slug: 1 },
        options: { name: "uq_lessons_tenant_module_slug", unique: true },
      },
      {
        key: { tenantId: 1, moduleId: 1, order: 1 },
        options: { name: "uq_lessons_tenant_module_order", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, moduleId: 1, order: 1 },
        options: { name: "ix_lessons_tenant_course_module_order" },
      },
      {
        key: { tenantId: 1, isPublished: 1, contentType: 1 },
        options: { name: "ix_lessons_tenant_published_contentType" },
      },
    ],
  },
  {
    collection: "projects",
    indexes: [
      {
        key: { tenantId: 1, lessonId: 1 },
        options: { name: "uq_projects_tenant_lesson", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, slug: 1 },
        options: { name: "uq_projects_tenant_course_slug", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, isPublished: 1, order: 1 },
        options: { name: "ix_projects_tenant_course_published_order" },
      },
    ],
  },
  {
    collection: "project_submissions",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, projectId: 1, submittedAt: -1 },
        options: {
          name: "ix_project_submissions_tenant_user_project_submittedAt",
        },
      },
      {
        key: { tenantId: 1, projectId: 1, status: 1, updatedAt: -1 },
        options: {
          name: "ix_project_submissions_tenant_project_status_updatedAt",
        },
      },
      {
        key: { tenantId: 1, courseId: 1, userId: 1, updatedAt: -1 },
        options: {
          name: "ix_project_submissions_tenant_course_user_updatedAt",
        },
      },
      {
        key: { tenantId: 1, userId: 1, projectId: 1, idempotencyKey: 1 },
        options: {
          name: "uq_project_submissions_tenant_user_project_idempotency",
          unique: true,
          partialFilterExpression: { idempotencyKey: { $type: "string" } },
        },
      },
    ],
  },
  {
    collection: "submission_events",
    indexes: [
      {
        key: { tenantId: 1, submissionId: 1, occurredAt: -1 },
        options: { name: "ix_submission_events_tenant_submission_occurredAt" },
      },
      {
        key: { tenantId: 1, actorUserId: 1, occurredAt: -1 },
        options: {
          name: "ix_submission_events_tenant_actor_occurredAt",
          partialFilterExpression: { actorUserId: { $exists: true } },
        },
      },
    ],
  },
  {
    collection: "quizzes",
    indexes: [
      {
        key: { tenantId: 1, lessonId: 1 },
        options: { name: "uq_quizzes_tenant_lesson", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, slug: 1 },
        options: { name: "uq_quizzes_tenant_course_slug", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, isPublished: 1, order: 1 },
        options: { name: "ix_quizzes_tenant_course_published_order" },
      },
    ],
  },
  {
    collection: "quiz_attempts",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, quizId: 1, submittedAt: -1 },
        options: {
          name: "ix_quiz_attempts_tenant_user_quiz_submittedAt",
        },
      },
      {
        key: { tenantId: 1, courseId: 1, quizId: 1, submittedAt: -1 },
        options: {
          name: "ix_quiz_attempts_tenant_course_quiz_submittedAt",
        },
      },
      {
        key: { tenantId: 1, userId: 1, quizId: 1, idempotencyKey: 1 },
        options: {
          name: "uq_quiz_attempts_tenant_user_quiz_idempotency",
          unique: true,
          partialFilterExpression: { idempotencyKey: { $type: "string" } },
        },
      },
    ],
  },
  {
    collection: "enrollments",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, courseId: 1 },
        options: { name: "uq_enrollments_tenant_user_course", unique: true },
      },
      {
        key: { tenantId: 1, courseId: 1, status: 1 },
        options: { name: "ix_enrollments_tenant_course_status" },
      },
      {
        key: { tenantId: 1, userId: 1, status: 1 },
        options: { name: "ix_enrollments_tenant_user_status" },
      },
      {
        key: { tenantId: 1, updatedAt: -1 },
        options: { name: "ix_enrollments_tenant_updatedAt" },
      },
      {
        key: { tenantId: 1, userId: 1, lastLessonRefId: 1 },
        options: {
          name: "ix_enrollments_tenant_user_lastLessonRefId",
          partialFilterExpression: { lastLessonRefId: { $type: "objectId" } },
        },
      },
    ],
  },
  {
    collection: "progress",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, lessonId: 1 },
        options: { name: "uq_progress_tenant_user_lesson", unique: true },
      },
      {
        key: { tenantId: 1, userId: 1, courseId: 1 },
        options: { name: "ix_progress_tenant_user_course" },
      },
      {
        key: { tenantId: 1, courseId: 1, state: 1 },
        options: { name: "ix_progress_tenant_course_state" },
      },
      {
        key: { tenantId: 1, updatedAt: -1 },
        options: { name: "ix_progress_tenant_updatedAt" },
      },
      {
        key: { tenantId: 1, userId: 1, lessonRefId: 1 },
        options: {
          name: "uq_progress_tenant_user_lessonRef",
          unique: true,
          partialFilterExpression: { lessonRefId: { $type: "objectId" } },
        },
      },
      {
        key: { tenantId: 1, courseId: 1, moduleRefId: 1, state: 1 },
        options: {
          name: "ix_progress_tenant_course_moduleRef_state",
          partialFilterExpression: { moduleRefId: { $type: "objectId" } },
        },
      },
    ],
  },
  {
    collection: "progress_events",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, occurredAt: -1 },
        options: { name: "ix_progress_events_tenant_user_occurredAt" },
      },
      {
        key: { tenantId: 1, userId: 1, courseId: 1, occurredAt: -1 },
        options: {
          name: "ix_progress_events_tenant_user_course_occurredAt",
        },
      },
      {
        key: { tenantId: 1, courseId: 1, eventType: 1, occurredAt: -1 },
        options: { name: "ix_progress_events_tenant_course_event_occurredAt" },
      },
      {
        key: { tenantId: 1, lessonId: 1, occurredAt: -1 },
        options: { name: "ix_progress_events_tenant_lesson_occurredAt" },
      },
      {
        key: { tenantId: 1, lessonRefId: 1, occurredAt: -1 },
        options: {
          name: "ix_progress_events_tenant_lessonRef_occurredAt",
          partialFilterExpression: { lessonRefId: { $type: "objectId" } },
        },
      },
      {
        key: { tenantId: 1, moduleRefId: 1, occurredAt: -1 },
        options: {
          name: "ix_progress_events_tenant_moduleRef_occurredAt",
          partialFilterExpression: { moduleRefId: { $type: "objectId" } },
        },
      },
    ],
  },
  {
    collection: "progress_write_idempotency",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, scope: 1, key: 1 },
        options: {
          name: "uq_progress_write_idempotency_tenant_user_scope_key",
          unique: true,
        },
      },
      {
        key: { expiresAt: 1 },
        options: {
          name: "ttl_progress_write_idempotency_expiresAt",
          expireAfterSeconds: 0,
        },
      },
      {
        key: { tenantId: 1, userId: 1, createdAt: -1 },
        options: { name: "ix_progress_write_idempotency_tenant_user_createdAt" },
      },
    ],
  },
  {
    collection: "progress_write_rate_limits",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, scope: 1, windowStartMs: 1 },
        options: {
          name: "uq_progress_write_rate_limits_tenant_user_scope_window",
          unique: true,
        },
      },
      {
        key: { expiresAt: 1 },
        options: {
          name: "ttl_progress_write_rate_limits_expiresAt",
          expireAfterSeconds: 0,
        },
      },
      {
        key: { tenantId: 1, userId: 1, updatedAt: -1 },
        options: { name: "ix_progress_write_rate_limits_tenant_user_updatedAt" },
      },
    ],
  },
  {
    collection: "certificates",
    indexes: [
      {
        key: { tenantId: 1, code: 1 },
        options: { name: "uq_certificates_tenant_code", unique: true },
      },
      {
        key: { tenantId: 1, userId: 1, courseId: 1 },
        options: { name: "uq_certificates_tenant_user_course", unique: true },
      },
      {
        key: { tenantId: 1, issuedAt: -1 },
        options: { name: "ix_certificates_tenant_issuedAt" },
      },
    ],
  },
  {
    collection: "uploads",
    indexes: [
      {
        key: { tenantId: 1, publicId: 1 },
        options: { name: "uq_uploads_tenant_publicId", unique: true },
      },
      {
        key: { tenantId: 1, userId: 1, createdAt: -1 },
        options: {
          name: "ix_uploads_tenant_user_createdAt",
          partialFilterExpression: { userId: { $exists: true } },
        },
      },
      {
        key: { tenantId: 1, context: 1, createdAt: -1 },
        options: { name: "ix_uploads_tenant_context_createdAt" },
      },
      {
        key: { tenantId: 1, status: 1, createdAt: -1 },
        options: { name: "ix_uploads_tenant_status_createdAt" },
      },
    ],
  },
  {
    collection: "discussion_threads",
    indexes: [
      {
        key: { tenantId: 1, visibility: 1, lastActivityAt: -1 },
        options: { name: "ix_discussion_threads_tenant_visibility_lastActivityAt" },
      },
      {
        key: { tenantId: 1, category: 1, lastActivityAt: -1 },
        options: {
          name: "ix_discussion_threads_tenant_category_lastActivityAt",
          partialFilterExpression: { category: { $type: "string" } },
        },
      },
      {
        key: { tenantId: 1, tags: 1, lastActivityAt: -1 },
        options: {
          name: "ix_discussion_threads_tenant_tags_lastActivityAt",
          partialFilterExpression: { tags: { $type: "array" } },
        },
      },
      {
        key: { tenantId: 1, pinned: 1, lastActivityAt: -1 },
        options: { name: "ix_discussion_threads_tenant_pinned_lastActivityAt" },
      },
      {
        key: { tenantId: 1, status: 1, lastActivityAt: -1 },
        options: { name: "ix_discussion_threads_tenant_status_lastActivityAt" },
      },
      {
        key: { tenantId: 1, title: "text", body: "text" },
        options: { name: "tx_discussion_threads_tenant_title_body" },
      },
    ],
  },
  {
    collection: "discussion_comments",
    indexes: [
      {
        key: { tenantId: 1, threadId: 1, createdAt: 1 },
        options: { name: "ix_discussion_comments_tenant_thread_createdAt" },
      },
      {
        key: { tenantId: 1, parentCommentId: 1, createdAt: 1 },
        options: {
          name: "ix_discussion_comments_tenant_parent_createdAt",
          partialFilterExpression: { parentCommentId: { $type: "objectId" } },
        },
      },
      {
        key: { tenantId: 1, authorUserId: 1, createdAt: -1 },
        options: { name: "ix_discussion_comments_tenant_author_createdAt" },
      },
    ],
  },
  {
    collection: "discussion_votes",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, targetType: 1, targetId: 1 },
        options: {
          name: "uq_discussion_votes_tenant_user_target",
          unique: true,
        },
      },
      {
        key: { tenantId: 1, targetType: 1, targetId: 1 },
        options: { name: "ix_discussion_votes_tenant_target" },
      },
    ],
  },
  {
    collection: "discussion_tags",
    indexes: [
      {
        key: { tenantId: 1, slug: 1 },
        options: { name: "uq_discussion_tags_tenant_slug", unique: true },
      },
      {
        key: { tenantId: 1, usageCount: -1, updatedAt: -1 },
        options: { name: "ix_discussion_tags_tenant_usage_updatedAt" },
      },
    ],
  },
  {
    collection: "playground_templates",
    indexes: [
      {
        key: { tenantId: 1, slug: 1 },
        options: { name: "uq_playground_templates_tenant_slug", unique: true },
      },
      {
        key: { tenantId: 1, visibility: 1, isPublished: 1, updatedAt: -1 },
        options: {
          name: "ix_playground_templates_tenant_visibility_published_updatedAt",
        },
      },
      {
        key: { tenantId: 1, tags: 1, updatedAt: -1 },
        options: {
          name: "ix_playground_templates_tenant_tags_updatedAt",
          partialFilterExpression: { tags: { $type: "array" } },
        },
      },
    ],
  },
  {
    collection: "playground_sessions",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, updatedAt: -1 },
        options: { name: "ix_playground_sessions_tenant_user_updatedAt" },
      },
      {
        key: { tenantId: 1, visibility: 1, updatedAt: -1 },
        options: { name: "ix_playground_sessions_tenant_visibility_updatedAt" },
      },
      {
        key: { tenantId: 1, templateId: 1, updatedAt: -1 },
        options: {
          name: "ix_playground_sessions_tenant_template_updatedAt",
          partialFilterExpression: { templateId: { $type: "objectId" } },
        },
      },
    ],
  },
  {
    collection: "playground_runs",
    indexes: [
      {
        key: { tenantId: 1, sessionId: 1, createdAt: -1 },
        options: { name: "ix_playground_runs_tenant_session_createdAt" },
      },
      {
        key: { tenantId: 1, userId: 1, createdAt: -1 },
        options: { name: "ix_playground_runs_tenant_user_createdAt" },
      },
      {
        key: { finishedAt: 1 },
        options: {
          name: "ttl_playground_runs_finishedAt",
          expireAfterSeconds: 60 * 60 * 24 * 90,
          partialFilterExpression: { finishedAt: { $type: "date" } },
        },
      },
    ],
  },
  {
    collection: "user_preferences",
    indexes: [
      {
        key: { tenantId: 1, userId: 1 },
        options: { name: "uq_user_preferences_tenant_user", unique: true },
      },
      {
        key: { tenantId: 1, updatedAt: -1 },
        options: { name: "ix_user_preferences_tenant_updatedAt" },
      },
    ],
  },
  {
    collection: "notifications",
    indexes: [
      {
        key: { tenantId: 1, userId: 1, readAt: 1, createdAt: -1 },
        options: { name: "ix_notifications_tenant_user_read_createdAt" },
      },
      {
        key: { tenantId: 1, userId: 1, createdAt: -1 },
        options: { name: "ix_notifications_tenant_user_createdAt" },
      },
    ],
  },
  {
    collection: "lead_captures",
    indexes: [
      {
        key: { tenantId: 1, emailLower: 1 },
        options: { name: "uq_lead_captures_tenant_emailLower", unique: true },
      },
      {
        key: { tenantId: 1, status: 1, capturedAt: -1 },
        options: { name: "ix_lead_captures_tenant_status_capturedAt" },
      },
      {
        key: { tenantId: 1, source: 1, capturedAt: -1 },
        options: { name: "ix_lead_captures_tenant_source_capturedAt" },
      },
    ],
  },
];

async function ensureCollections(db) {
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existing.map((collection) => collection.name));
  const created = [];

  for (const plan of plans) {
    if (!existingNames.has(plan.collection)) {
      await db.createCollection(plan.collection);
      created.push(plan.collection);
    }
  }

  return created;
}

async function ensureIndexes(db) {
  const output = [];

  for (const plan of plans) {
    const collection = db.collection(plan.collection);
    const indexNames = await collection.createIndexes(
      plan.indexes.map((index) => ({ key: index.key, ...index.options }))
    );
    output.push({ collection: plan.collection, indexNames });
  }

  return output;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const createdCollections = await ensureCollections(db);
    const indexSummary = await ensureIndexes(db);

    console.log("Data layer setup: OK");
    console.log("Database:", dbName);
    console.log("Created collections:", createdCollections.length ? createdCollections.join(", ") : "(none)");
    console.log("Indexes:");
    for (const entry of indexSummary) {
      console.log(`- ${entry.collection}: ${entry.indexNames.join(", ")}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Data layer setup: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
