import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3323;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-course-detail-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-course-detail-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const USER_ID = "itest-course-detail-user";
const USER_EMAIL = "itest-course-detail-user@example.com";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!mongoUri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB_NAME for integration test");
}

const client = new MongoClient(mongoUri);
let appProcess = null;
let serverLog = "";

const ids = {
  userId: new ObjectId(),
  courseId: new ObjectId(),
  moduleId: new ObjectId(),
  hiddenModuleId: new ObjectId(),
  lessonAId: new ObjectId(),
  lessonBId: new ObjectId(),
  hiddenLessonId: new ObjectId(),
  enrollmentId: new ObjectId(),
};

function authHeaders() {
  return {
    "content-type": "application/json",
    "x-test-auth-bypass": BYPASS_SECRET,
    "x-test-tenant-id": TENANT_ID,
    "x-test-user-id": USER_ID,
    "x-test-user-email": USER_EMAIL,
    "x-test-user-first-name": "Course",
    "x-test-user-last-name": "Viewer",
  };
}

async function waitForServerReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (appProcess && appProcess.exitCode !== null) {
      throw new Error(
        `Next.js server exited before ready (code ${appProcess.exitCode}). Logs:\n${serverLog}`
      );
    }
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.status > 0) return;
    } catch {}
    await sleep(800);
  }

  throw new Error(`Timed out waiting for Next.js server. Logs:\n${serverLog}`);
}

async function cleanupFixture(db) {
  const collections = ["progress", "enrollments", "lessons", "modules", "courses", "users"];
  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function seedFixture(db) {
  const now = new Date();

  await db.collection("users").insertOne({
    _id: ids.userId,
    tenantId: TENANT_ID,
    clerkUserId: USER_ID,
    email: USER_EMAIL,
    emailLower: USER_EMAIL.toLowerCase(),
    username: "itest-course-detail-user",
    usernameLower: "itest-course-detail-user",
    fullName: "Course Viewer",
    imageUrl: null,
    roles: ["learner"],
    isEmailVerified: true,
    twoFactorEnabled: false,
    publicMetadata: {},
    privateMetadata: {},
    unsafeMetadata: {},
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("courses").insertOne({
    _id: ids.courseId,
    tenantId: TENANT_ID,
    slug: "systems-design-practical",
    title: "Systems Design Practical",
    summary: "Design and scale backend systems.",
    description: "Applied architecture for real services.",
    category: "Backend",
    level: "intermediate",
    tags: ["systems", "architecture", "backend"],
    status: "published",
    visibility: "public",
    modulesCount: 2,
    lessonsCount: 3,
    durationMinutes: 180,
    publishedAt: new Date(now.getTime() - 10_000),
    createdAt: new Date(now.getTime() - 40_000),
    updatedAt: new Date(now.getTime() - 5_000),
  });

  await db.collection("modules").insertMany([
    {
      _id: ids.moduleId,
      tenantId: TENANT_ID,
      courseId: ids.courseId,
      slug: "service-boundaries",
      title: "Service Boundaries",
      description: "Split services around ownership and latency constraints.",
      order: 1,
      durationMinutes: 90,
      lessonsCount: 2,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: ids.hiddenModuleId,
      tenantId: TENANT_ID,
      courseId: ids.courseId,
      slug: "draft-module",
      title: "Draft Module",
      description: "Should not appear in public APIs.",
      order: 2,
      durationMinutes: 45,
      lessonsCount: 1,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("lessons").insertMany([
    {
      _id: ids.lessonAId,
      tenantId: TENANT_ID,
      courseId: ids.courseId,
      moduleId: ids.moduleId,
      slug: "ownership-models",
      title: "Ownership Models",
      summary: "Define clear service ownership boundaries.",
      description: "Pragmatic service ownership.",
      order: 1,
      durationMinutes: 35,
      contentType: "text",
      isPreview: false,
      isPublished: true,
      learningObjectives: [],
      instructions: [],
      bodyMarkdown: "Lesson A",
      starterFiles: [],
      expectedOutput: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: ids.lessonBId,
      tenantId: TENANT_ID,
      courseId: ids.courseId,
      moduleId: ids.moduleId,
      slug: "event-contracts",
      title: "Event Contracts",
      summary: "Version event payloads without breaking consumers.",
      description: "Reliable contract strategy.",
      order: 2,
      durationMinutes: 40,
      contentType: "video",
      isPreview: false,
      isPublished: true,
      learningObjectives: [],
      instructions: [],
      bodyMarkdown: "Lesson B",
      starterFiles: [],
      expectedOutput: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: ids.hiddenLessonId,
      tenantId: TENANT_ID,
      courseId: ids.courseId,
      moduleId: ids.hiddenModuleId,
      slug: "draft-lesson",
      title: "Draft Lesson",
      summary: "Should not appear in public APIs.",
      description: "hidden",
      order: 1,
      durationMinutes: 20,
      contentType: "text",
      isPreview: false,
      isPublished: false,
      learningObjectives: [],
      instructions: [],
      bodyMarkdown: "hidden",
      starterFiles: [],
      expectedOutput: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("enrollments").insertOne({
    _id: ids.enrollmentId,
    tenantId: TENANT_ID,
    userId: ids.userId,
    courseId: ids.courseId,
    status: "active",
    progressPercent: 50,
    source: "direct",
    enrolledAt: new Date(now.getTime() - 3_000),
    createdAt: new Date(now.getTime() - 3_000),
    updatedAt: new Date(now.getTime() - 2_000),
  });

  await db.collection("progress").insertMany([
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      userId: ids.userId,
      courseId: ids.courseId,
      lessonId: ids.lessonAId.toString(),
      lessonRefId: ids.lessonAId,
      moduleId: ids.moduleId.toString(),
      moduleRefId: ids.moduleId,
      enrollmentId: ids.enrollmentId,
      state: "completed",
      progressPercent: 100,
      timeSpentSeconds: 2100,
      startedAt: new Date(now.getTime() - 8_000),
      completedAt: new Date(now.getTime() - 6_000),
      lastActivityAt: new Date(now.getTime() - 6_000),
      createdAt: new Date(now.getTime() - 8_000),
      updatedAt: new Date(now.getTime() - 6_000),
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      userId: ids.userId,
      courseId: ids.courseId,
      lessonId: ids.lessonBId.toString(),
      lessonRefId: ids.lessonBId,
      moduleId: ids.moduleId.toString(),
      moduleRefId: ids.moduleId,
      enrollmentId: ids.enrollmentId,
      state: "in_progress",
      progressPercent: 40,
      timeSpentSeconds: 1000,
      startedAt: new Date(now.getTime() - 5_000),
      completedAt: null,
      lastActivityAt: new Date(now.getTime() - 1_000),
      createdAt: new Date(now.getTime() - 5_000),
      updatedAt: new Date(now.getTime() - 1_000),
    },
  ]);
}

async function getJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  return {
    response,
    payload: await response.json(),
  };
}

before(async () => {
  await client.connect();
  const db = client.db(dbName);
  await cleanupFixture(db);
  await seedFixture(db);

  appProcess = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TEST_MODE: "1",
      TEST_AUTH_BYPASS_SECRET: BYPASS_SECRET,
      PATH: `/opt/homebrew/bin:${process.env.PATH ?? ""}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  appProcess.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  appProcess.stderr.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  await waitForServerReady();
});

after(async () => {
  if (appProcess && !appProcess.killed) {
    appProcess.kill("SIGTERM");
    await sleep(1_500);
    if (!appProcess.killed) {
      appProcess.kill("SIGKILL");
    }
  }

  const db = client.db(dbName);
  await cleanupFixture(db);
  await client.close();
});

test("course detail and syllabus endpoints return published content and viewer progress context", async () => {
  const detail = await getJson(
    `/api/v1/courses/systems-design-practical?tenantId=${encodeURIComponent(TENANT_ID)}`
  );
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.ok, true);
  assert.equal(detail.payload.data.slug, "systems-design-practical");
  assert.equal(detail.payload.data.modules.length, 1);
  assert.equal(detail.payload.data.modules[0].slug, "service-boundaries");
  assert.equal(detail.payload.data.modules[0].lessons.length, 2);
  assert.equal(detail.payload.data.modules[0].lessons[0].slug, "ownership-models");
  assert.equal(detail.payload.data.modules[0].lessons[1].slug, "event-contracts");

  const missing = await getJson(
    `/api/v1/courses/unknown-course?tenantId=${encodeURIComponent(TENANT_ID)}`
  );
  assert.equal(missing.response.status, 404);
  assert.equal(missing.payload.ok, false);
  assert.equal(missing.payload.error, "COURSE_NOT_FOUND");

  const syllabusAnon = await getJson(
    `/api/v1/courses/systems-design-practical/syllabus?tenantId=${encodeURIComponent(
      TENANT_ID
    )}`
  );
  assert.equal(syllabusAnon.response.status, 200);
  assert.equal(syllabusAnon.payload.ok, true);
  assert.equal(syllabusAnon.payload.data.viewer, null);
  assert.equal(
    syllabusAnon.payload.data.course.modules[0].lessons.every(
      (lesson) => lesson.progress === null
    ),
    true
  );

  const syllabusViewer = await getJson(
    `/api/v1/courses/systems-design-practical/syllabus?tenantId=${encodeURIComponent(
      TENANT_ID
    )}`,
    {
      headers: authHeaders(),
    }
  );
  assert.equal(syllabusViewer.response.status, 200);
  assert.equal(syllabusViewer.payload.ok, true);
  assert.equal(syllabusViewer.payload.data.viewer.isAuthenticated, true);
  assert.equal(syllabusViewer.payload.data.viewer.enrollmentStatus, "active");
  assert.deepEqual(syllabusViewer.payload.data.viewer.progressSummary, {
    totalLessons: 2,
    completedLessons: 1,
    inProgressLessons: 1,
    completionPercent: 50,
  });

  const lessonProgress = syllabusViewer.payload.data.course.modules[0].lessons;
  assert.equal(lessonProgress.length, 2);

  const firstLesson = lessonProgress[0];
  assert.equal(firstLesson.slug, "ownership-models");
  assert.notEqual(firstLesson.progress, null);
  assert.equal(firstLesson.progress.state, "completed");
  assert.equal(firstLesson.progress.progressPercent, 100);
  assert.equal(typeof firstLesson.progress.lastActivityAt, "string");
  assert.equal(
    Number.isNaN(Date.parse(firstLesson.progress.lastActivityAt)),
    false
  );

  const secondLesson = lessonProgress[1];
  assert.equal(secondLesson.slug, "event-contracts");
  assert.notEqual(secondLesson.progress, null);
  assert.equal(secondLesson.progress.state, "in_progress");
  assert.equal(secondLesson.progress.progressPercent, 40);
  assert.equal(typeof secondLesson.progress.lastActivityAt, "string");
  assert.equal(
    Number.isNaN(Date.parse(secondLesson.progress.lastActivityAt)),
    false
  );
});
