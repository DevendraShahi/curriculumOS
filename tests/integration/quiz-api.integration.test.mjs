import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3311;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-quiz-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-quiz-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID_ENROLLED = "itest-quiz-user-enrolled";
const USER_EMAIL_ENROLLED = "itest-quiz-enrolled@example.com";
const USER_ID_UNENROLLED = "itest-quiz-user-unenrolled";
const USER_EMAIL_UNENROLLED = "itest-quiz-unenrolled@example.com";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!mongoUri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB_NAME for integration test");
}

const client = new MongoClient(mongoUri);
let appProcess = null;
let fixture = null;

function testHeaders(params) {
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
  const enrolledUserDbId = new ObjectId();
  const unenrolledUserDbId = new ObjectId();
  const courseId = new ObjectId();
  const moduleId = new ObjectId();
  const lessonId = new ObjectId();
  const quizId = new ObjectId();

  await db.collection("users").insertMany([
    {
      _id: enrolledUserDbId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_ENROLLED,
      email: USER_EMAIL_ENROLLED,
      emailLower: USER_EMAIL_ENROLLED.toLowerCase(),
      username: "itest-quiz-enrolled",
      usernameLower: "itest-quiz-enrolled",
      fullName: "Integration Quiz Enrolled",
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
      _id: unenrolledUserDbId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_UNENROLLED,
      email: USER_EMAIL_UNENROLLED,
      emailLower: USER_EMAIL_UNENROLLED.toLowerCase(),
      username: "itest-quiz-unenrolled",
      usernameLower: "itest-quiz-unenrolled",
      fullName: "Integration Quiz Unenrolled",
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

  await db.collection("courses").insertOne({
    _id: courseId,
    tenantId: TENANT_ID,
    slug: "itest-quiz-course",
    title: "Integration Quiz Course",
    summary: "Quiz runtime and attempt integration tests",
    status: "published",
    visibility: "public",
    modulesCount: 1,
    lessonsCount: 1,
    durationMinutes: 45,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("modules").insertOne({
    _id: moduleId,
    tenantId: TENANT_ID,
    courseId,
    slug: "itest-quiz-module",
    title: "Quiz Module",
    order: 1,
    durationMinutes: 45,
    lessonsCount: 1,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("lessons").insertOne({
    _id: lessonId,
    tenantId: TENANT_ID,
    courseId,
    moduleId,
    slug: "itest-quiz-lesson",
    title: "Lesson Quiz",
    summary: "Integration lesson",
    order: 1,
    durationMinutes: 30,
    contentType: "quiz",
    isPreview: false,
    isPublished: true,
    learningObjectives: ["Objective A", "Objective B"],
    instructions: ["Instruction A", "Instruction B"],
    bodyMarkdown: "## Integration lesson body",
    starterFiles: [],
    expectedOutput: ["Submit quiz"],
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("quizzes").insertOne({
    _id: quizId,
    tenantId: TENANT_ID,
    courseId,
    moduleId,
    lessonId,
    slug: "itest-quiz-1",
    title: "Integration Quiz",
    summary: "Runtime payload quiz",
    order: 1,
    passingScore: 70,
    timeLimitMinutes: 20,
    questionCount: 3,
    questions: [
      {
        prompt: "Question 1",
        options: ["A", "B", "C", "D"],
        answerIndex: 1,
        explanation: "Because B is correct",
      },
      {
        prompt: "Question 2",
        options: ["A", "B", "C", "D"],
        answerIndex: 0,
        explanation: "Because A is correct",
      },
      {
        prompt: "Question 3",
        options: ["A", "B", "C", "D"],
        answerIndex: 2,
        explanation: "Because C is correct",
      },
    ],
    isPublished: true,
    status: "published",
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("enrollments").insertOne({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    userId: enrolledUserDbId,
    courseId,
    status: "active",
    enrolledAt: now,
    progressPercent: 0,
    source: "direct",
    createdAt: now,
    updatedAt: now,
  });

  return {
    courseId: courseId.toString(),
    lessonId: lessonId.toString(),
    quizId: quizId.toString(),
  };
}

async function cleanupFixture(db) {
  const collections = [
    "progress_write_rate_limits",
    "progress_write_idempotency",
    "quiz_attempts",
    "progress_events",
    "progress",
    "enrollments",
    "quizzes",
    "lessons",
    "modules",
    "courses",
    "users",
  ];

  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function getQuizRuntime(params) {
  const response = await fetch(
    `${BASE_URL}/api/v1/courses/${fixture.courseId}/quizzes/${fixture.quizId}`,
    {
      headers: testHeaders({
        userId: params.userId,
        userEmail: params.userEmail,
      }),
    }
  );
  return {
    response,
    payload: await response.json(),
  };
}

async function postAttempt(params) {
  const response = await fetch(
    `${BASE_URL}/api/v1/courses/${fixture.courseId}/quizzes/${fixture.quizId}/attempts`,
    {
      method: "POST",
      headers: testHeaders({
        userId: params.userId,
        userEmail: params.userEmail,
        idempotencyKey: params.idempotencyKey,
      }),
      body: JSON.stringify(params.body),
    }
  );

  return {
    response,
    payload: await response.json(),
  };
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
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  appProcess.stdout.on("data", () => {});
  appProcess.stderr.on("data", () => {});

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

test("GET quiz runtime returns public question payload without answer keys", async () => {
  const { response, payload } = await getQuizRuntime({
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.quiz.questionCount, 3);
  assert.equal(payload.data.quiz.questions.length, 3);
  assert.equal("answerIndex" in payload.data.quiz.questions[0], false);
  assert.equal(payload.data.viewer.isAuthenticated, true);
  assert.equal(payload.data.viewer.isEnrolled, true);
});

test("POST attempt supports idempotency replay and writes one attempt", async () => {
  const idempotencyKey = `itest-quiz-idem-${Date.now()}`;

  const first = await postAttempt({
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
    idempotencyKey,
    body: {
      answers: [1, 0, 1],
      durationSeconds: 120,
    },
  });

  assert.equal(first.response.status, 201);
  assert.equal(first.payload.ok, true);
  assert.equal(first.payload.data.meta.replayed, false);
  assert.equal(first.payload.data.evaluation.correctCount, 2);
  assert.equal(first.payload.data.evaluation.scorePercent, 67);
  assert.equal(first.payload.data.evaluation.passed, false);

  const second = await postAttempt({
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
    idempotencyKey,
    body: {
      answers: [1, 0, 1],
      durationSeconds: 120,
    },
  });

  assert.equal(second.response.status, 200);
  assert.equal(second.payload.ok, true);
  assert.equal(second.payload.data.meta.replayed, true);
  assert.equal(
    second.payload.data.attempt.id,
    first.payload.data.attempt.id
  );

  const db = client.db(dbName);
  const attempts = await db.collection("quiz_attempts").countDocuments({
    tenantId: TENANT_ID,
    quizId: new ObjectId(fixture.quizId),
    userId: (await db.collection("users").findOne({
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_ENROLLED,
    }))._id,
  });

  assert.equal(attempts, 1);
});

test("POST attempt rejects invalid answer payload", async () => {
  const { response, payload } = await postAttempt({
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
    body: {
      answers: [1, 0],
    },
  });

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "INVALID_QUIZ_ANSWERS");
});

test("POST attempt requires enrollment", async () => {
  const { response, payload } = await postAttempt({
    userId: USER_ID_UNENROLLED,
    userEmail: USER_EMAIL_UNENROLLED,
    body: {
      answers: [1, 0, 2],
      durationSeconds: 100,
    },
  });

  assert.equal(response.status, 409);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "ENROLLMENT_REQUIRED");
});
