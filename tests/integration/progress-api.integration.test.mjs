import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3307;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-progress-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;
const RATE_LIMIT_PER_MINUTE = 2;

const TENANT_ID = `itest-progress-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID_IDEMPOTENCY = "itest-progress-user-idempotency";
const USER_EMAIL_IDEMPOTENCY = "itest-progress-idempotency@example.com";
const USER_ID_RATE_LIMIT = "itest-progress-user-rate-limit";
const USER_EMAIL_RATE_LIMIT = "itest-progress-rate-limit@example.com";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!mongoUri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB_NAME for integration test");
}

const client = new MongoClient(mongoUri);
let appProcess = null;
let serverLog = "";

let fixture = null;

function progressHeaders(params) {
  return {
    "content-type": "application/json",
    "x-test-auth-bypass": BYPASS_SECRET,
    "x-test-tenant-id": TENANT_ID,
    "x-test-user-id": params.userId,
    "x-test-user-email": params.userEmail,
    ...(params.idempotencyKey ? { "idempotency-key": params.idempotencyKey } : {}),
  };
}

async function waitForServerReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.status > 0) return;
    } catch {}
    await sleep(800);
  }

  throw new Error("Timed out waiting for Next.js dev server");
}

async function seedFixture(db) {
  const now = new Date();
  const userAId = new ObjectId();
  const userBId = new ObjectId();
  const courseAId = new ObjectId();
  const courseBId = new ObjectId();
  const moduleAId = new ObjectId();
  const moduleBId = new ObjectId();
  const lessonA1Id = new ObjectId();
  const lessonA2Id = new ObjectId();
  const lessonA3Id = new ObjectId();
  const lessonB1Id = new ObjectId();

  await db.collection("users").insertMany([
    {
      _id: userAId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_IDEMPOTENCY,
      email: USER_EMAIL_IDEMPOTENCY,
      emailLower: USER_EMAIL_IDEMPOTENCY.toLowerCase(),
      username: "itest-idempotency",
      usernameLower: "itest-idempotency",
      fullName: "Integration Idempotency",
      imageUrl: null,
      roles: ["learner"],
      isEmailVerified: true,
      twoFactorEnabled: false,
      publicMetadata: {},
      privateMetadata: {},
      unsafeMetadata: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: userBId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_RATE_LIMIT,
      email: USER_EMAIL_RATE_LIMIT,
      emailLower: USER_EMAIL_RATE_LIMIT.toLowerCase(),
      username: "itest-rate-limit",
      usernameLower: "itest-rate-limit",
      fullName: "Integration Rate Limit",
      imageUrl: null,
      roles: ["learner"],
      isEmailVerified: true,
      twoFactorEnabled: false,
      publicMetadata: {},
      privateMetadata: {},
      unsafeMetadata: {},
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("courses").insertMany([
    {
      _id: courseAId,
      tenantId: TENANT_ID,
      slug: "itest-course-a",
      title: "Integration Course A",
      summary: "Course A for progress API integration tests",
      status: "published",
      visibility: "public",
      modulesCount: 1,
      lessonsCount: 3,
      durationMinutes: 120,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: courseBId,
      tenantId: TENANT_ID,
      slug: "itest-course-b",
      title: "Integration Course B",
      summary: "Course B for mismatch validation",
      status: "published",
      visibility: "public",
      modulesCount: 1,
      lessonsCount: 1,
      durationMinutes: 40,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("modules").insertMany([
    {
      _id: moduleAId,
      tenantId: TENANT_ID,
      courseId: courseAId,
      slug: "itest-module-a",
      title: "Module A",
      order: 1,
      durationMinutes: 120,
      lessonsCount: 3,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: moduleBId,
      tenantId: TENANT_ID,
      courseId: courseBId,
      slug: "itest-module-b",
      title: "Module B",
      order: 1,
      durationMinutes: 40,
      lessonsCount: 1,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("lessons").insertMany([
    {
      _id: lessonA1Id,
      tenantId: TENANT_ID,
      courseId: courseAId,
      moduleId: moduleAId,
      slug: "itest-lesson-a1",
      title: "Lesson A1",
      order: 1,
      durationMinutes: 20,
      contentType: "text",
      isPreview: false,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: lessonA2Id,
      tenantId: TENANT_ID,
      courseId: courseAId,
      moduleId: moduleAId,
      slug: "itest-lesson-a2",
      title: "Lesson A2",
      order: 2,
      durationMinutes: 25,
      contentType: "text",
      isPreview: false,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: lessonA3Id,
      tenantId: TENANT_ID,
      courseId: courseAId,
      moduleId: moduleAId,
      slug: "itest-lesson-a3",
      title: "Lesson A3",
      order: 3,
      durationMinutes: 30,
      contentType: "text",
      isPreview: false,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: lessonB1Id,
      tenantId: TENANT_ID,
      courseId: courseBId,
      moduleId: moduleBId,
      slug: "itest-lesson-b1",
      title: "Lesson B1",
      order: 1,
      durationMinutes: 20,
      contentType: "text",
      isPreview: false,
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("enrollments").insertMany([
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      userId: userAId,
      courseId: courseAId,
      status: "active",
      enrolledAt: now,
      progressPercent: 0,
      source: "direct",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      userId: userBId,
      courseId: courseAId,
      status: "active",
      enrolledAt: now,
      progressPercent: 0,
      source: "direct",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return {
    courseAId: courseAId.toString(),
    courseBId: courseBId.toString(),
    lessonA1Id: lessonA1Id.toString(),
    lessonA2Id: lessonA2Id.toString(),
    lessonA3Id: lessonA3Id.toString(),
    lessonB1Id: lessonB1Id.toString(),
  };
}

async function cleanupFixture(db) {
  const collections = [
    "progress_write_rate_limits",
    "progress_write_idempotency",
    "progress_events",
    "progress",
    "enrollments",
    "lessons",
    "modules",
    "courses",
    "users",
  ];

  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function postProgress(params) {
  const response = await fetch(`${BASE_URL}/api/v1/progress`, {
    method: "POST",
    headers: progressHeaders({
      userId: params.userId,
      userEmail: params.userEmail,
      idempotencyKey: params.idempotencyKey,
    }),
    body: JSON.stringify(params.body),
  });

  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  await client.connect();
  const db = client.db(dbName);
  await cleanupFixture(db);
  fixture = await seedFixture(db);

  appProcess = spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      NEXT_TEST_MODE: "1",
      TEST_AUTH_BYPASS_SECRET: BYPASS_SECRET,
      PROGRESS_WRITE_RATE_LIMIT_PER_MINUTE: String(RATE_LIMIT_PER_MINUTE),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  appProcess.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    serverLog += text;
  });
  appProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;
    serverLog += text;
  });
  appProcess.on("exit", (code) => {
    if (code !== 0) {
      process.stderr.write(stderr);
    }
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

test("POST /api/v1/progress replays by idempotency key without duplicate events", async () => {
  assert.ok(fixture, "missing fixture");
  const db = client.db(dbName);

  const requestBody = {
    courseId: fixture.courseAId,
    lessonId: fixture.lessonA1Id,
    progressPercent: 18,
    state: "in_progress",
    timeSpentSeconds: 120,
  };
  const idempotencyKey = `itest-idem-${Date.now()}`;

  const first = await postProgress({
    userId: USER_ID_IDEMPOTENCY,
    userEmail: USER_EMAIL_IDEMPOTENCY,
    idempotencyKey,
    body: requestBody,
  });
  assert.equal(
    first.response.status,
    201,
    `first call failed payload=${JSON.stringify(first.payload)} logs=${serverLog.slice(-2000)}`
  );
  assert.equal(first.payload.ok, true);
  assert.equal(first.payload.data.meta.idempotency.replayed, false);

  const second = await postProgress({
    userId: USER_ID_IDEMPOTENCY,
    userEmail: USER_EMAIL_IDEMPOTENCY,
    idempotencyKey,
    body: requestBody,
  });
  assert.equal(
    second.response.status,
    200,
    `second call failed payload=${JSON.stringify(second.payload)} logs=${serverLog.slice(-2000)}`
  );
  assert.equal(second.payload.ok, true);
  assert.equal(second.payload.data.meta.idempotency.replayed, true);

  const eventCount = await db.collection("progress_events").countDocuments({
    tenantId: TENANT_ID,
    courseId: new ObjectId(fixture.courseAId),
    lessonId: fixture.lessonA1Id,
  });
  assert.equal(eventCount, 1);
});

test("POST /api/v1/progress rejects lesson/course mismatch", async () => {
  assert.ok(fixture, "missing fixture");

  const result = await postProgress({
    userId: USER_ID_IDEMPOTENCY,
    userEmail: USER_EMAIL_IDEMPOTENCY,
    idempotencyKey: `itest-mismatch-${Date.now()}`,
    body: {
      courseId: fixture.courseAId,
      lessonId: fixture.lessonB1Id,
      progressPercent: 25,
      state: "in_progress",
      timeSpentSeconds: 90,
    },
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.payload.ok, false);
  assert.equal(result.payload.error, "LESSON_NOT_IN_COURSE");
});

test("POST /api/v1/progress returns 429 when write limit is exceeded", async () => {
  assert.ok(fixture, "missing fixture");

  const first = await postProgress({
    userId: USER_ID_RATE_LIMIT,
    userEmail: USER_EMAIL_RATE_LIMIT,
    idempotencyKey: `itest-rate-1-${Date.now()}`,
    body: {
      courseId: fixture.courseAId,
      lessonId: fixture.lessonA1Id,
      progressPercent: 11,
      state: "in_progress",
      timeSpentSeconds: 60,
    },
  });
  assert.equal(
    first.response.status,
    201,
    `rate test first call payload=${JSON.stringify(first.payload)} logs=${serverLog.slice(-2000)}`
  );
  assert.equal(first.payload.ok, true);
  assert.equal(
    Number(first.response.headers.get("x-ratelimit-limit")),
    RATE_LIMIT_PER_MINUTE
  );

  const second = await postProgress({
    userId: USER_ID_RATE_LIMIT,
    userEmail: USER_EMAIL_RATE_LIMIT,
    idempotencyKey: `itest-rate-2-${Date.now()}`,
    body: {
      courseId: fixture.courseAId,
      lessonId: fixture.lessonA2Id,
      progressPercent: 29,
      state: "in_progress",
      timeSpentSeconds: 90,
    },
  });
  assert.equal(
    second.response.status,
    201,
    `rate test second call payload=${JSON.stringify(second.payload)} logs=${serverLog.slice(-2000)}`
  );
  assert.equal(second.payload.ok, true);

  const third = await postProgress({
    userId: USER_ID_RATE_LIMIT,
    userEmail: USER_EMAIL_RATE_LIMIT,
    idempotencyKey: `itest-rate-3-${Date.now()}`,
    body: {
      courseId: fixture.courseAId,
      lessonId: fixture.lessonA3Id,
      progressPercent: 45,
      state: "in_progress",
      timeSpentSeconds: 120,
    },
  });
  assert.equal(third.response.status, 429);
  assert.equal(third.payload.ok, false);
  assert.equal(third.payload.error, "RATE_LIMITED_PROGRESS_WRITE");
});
