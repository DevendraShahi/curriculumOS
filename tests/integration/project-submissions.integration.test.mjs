import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3315;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-project-submissions-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-project-submissions-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID_ENROLLED = "itest-project-submissions-enrolled";
const USER_EMAIL_ENROLLED = "itest-project-submissions-enrolled@example.com";
const USER_ID_UNENROLLED = "itest-project-submissions-unenrolled";
const USER_EMAIL_UNENROLLED = "itest-project-submissions-unenrolled@example.com";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!mongoUri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB_NAME for integration test");
}

const client = new MongoClient(mongoUri);
let appProcess = null;
let serverLog = "";
let fixture = null;

function authHeaders(params) {
  return {
    "content-type": "application/json",
    "x-test-auth-bypass": BYPASS_SECRET,
    "x-test-tenant-id": TENANT_ID,
    "x-test-user-id": params.userId,
    "x-test-user-email": params.userEmail,
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

async function seedFixture(db) {
  const now = new Date();
  const enrolledUserDbId = new ObjectId();
  const unenrolledUserDbId = new ObjectId();
  const courseId = new ObjectId();
  const moduleId = new ObjectId();
  const lessonId = new ObjectId();
  const projectId = new ObjectId();

  await db.collection("users").insertMany([
    {
      _id: enrolledUserDbId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_ENROLLED,
      email: USER_EMAIL_ENROLLED,
      emailLower: USER_EMAIL_ENROLLED.toLowerCase(),
      username: "itest-project-submissions-enrolled",
      usernameLower: "itest-project-submissions-enrolled",
      fullName: "Integration Project Submissions Enrolled",
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
      username: "itest-project-submissions-unenrolled",
      usernameLower: "itest-project-submissions-unenrolled",
      fullName: "Integration Project Submissions Unenrolled",
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
    slug: "itest-project-submissions-course",
    title: "Integration Project Submissions Course",
    summary: "Course for project submissions integration tests",
    status: "published",
    visibility: "public",
    modulesCount: 1,
    lessonsCount: 1,
    durationMinutes: 60,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("modules").insertOne({
    _id: moduleId,
    tenantId: TENANT_ID,
    courseId,
    slug: "itest-project-submissions-module",
    title: "Project Module",
    order: 1,
    durationMinutes: 60,
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
    slug: "itest-project-submissions-lesson",
    title: "Project Lesson",
    summary: "Lesson for project submissions",
    order: 1,
    durationMinutes: 50,
    contentType: "project",
    isPreview: false,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("projects").insertOne({
    _id: projectId,
    tenantId: TENANT_ID,
    courseId,
    moduleId,
    lessonId,
    slug: "itest-project-submissions-project",
    title: "Integration Project",
    summary: "Submission pipeline integration coverage",
    order: 1,
    estimatedMinutes: 90,
    isPublished: true,
    status: "published",
    rubric: ["Correctness", "Architecture", "Quality"],
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
    projectId: projectId.toString(),
  };
}

async function cleanupFixture(db) {
  const collections = [
    "project_submissions",
    "submission_events",
    "enrollments",
    "projects",
    "lessons",
    "modules",
    "courses",
    "users",
  ];

  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function requestSubmissions(params) {
  const response = await fetch(
    `${BASE_URL}/api/v1/projects/${encodeURIComponent(fixture.projectId)}/submissions/me${
      params.query ? `?${params.query}` : ""
    }`,
    {
      method: params.method,
      headers: authHeaders({
        userId: params.userId,
        userEmail: params.userEmail,
      }),
      ...(params.body ? { body: JSON.stringify(params.body) } : {}),
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

  appProcess = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TEST_MODE: "1",
      TEST_AUTH_BYPASS_SECRET: BYPASS_SECRET,
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

test("POST submission requires active enrollment", async () => {
  const { response, payload } = await requestSubmissions({
    method: "POST",
    userId: USER_ID_UNENROLLED,
    userEmail: USER_EMAIL_UNENROLLED,
    body: {
      summary: "Attempt without enrollment",
      repositoryUrl: "https://example.com/repo",
    },
  });

  assert.equal(response.status, 409);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "ENROLLMENT_REQUIRED");
});

test("POST + GET submissions are scoped to actor", async () => {
  const created = await requestSubmissions({
    method: "POST",
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
    body: {
      summary: "First submission",
      repositoryUrl: "https://example.com/repo-1",
      liveUrl: "https://example.com/live-1",
      notes: "Initial pass",
    },
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.payload.ok, true);
  assert.equal(created.payload.data.status, "submitted");
  assert.equal(created.payload.data.summary, "First submission");

  const ownerList = await requestSubmissions({
    method: "GET",
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
  });

  assert.equal(ownerList.response.status, 200);
  assert.equal(ownerList.payload.ok, true);
  assert.equal(ownerList.payload.data.items.length, 1);
  assert.equal(ownerList.payload.data.items[0].summary, "First submission");

  const otherList = await requestSubmissions({
    method: "GET",
    userId: USER_ID_UNENROLLED,
    userEmail: USER_EMAIL_UNENROLLED,
  });

  assert.equal(otherList.response.status, 200);
  assert.equal(otherList.payload.ok, true);
  assert.equal(otherList.payload.data.items.length, 0);
});

test("resubmission flow appends newest-first history and validates URLs", async () => {
  const invalidUrl = await requestSubmissions({
    method: "POST",
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
    body: {
      summary: "Bad URL",
      repositoryUrl: "ftp://invalid.example.com/repo",
    },
  });

  assert.equal(invalidUrl.response.status, 400);
  assert.equal(invalidUrl.payload.ok, false);
  assert.equal(invalidUrl.payload.error, "INVALID_URL");

  const second = await requestSubmissions({
    method: "POST",
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
    body: {
      summary: "Second submission",
      repositoryUrl: "https://example.com/repo-2",
      liveUrl: "https://example.com/live-2",
      notes: "Improved architecture",
    },
  });

  assert.equal(second.response.status, 201);
  assert.equal(second.payload.ok, true);
  assert.equal(second.payload.data.summary, "Second submission");

  const history = await requestSubmissions({
    method: "GET",
    userId: USER_ID_ENROLLED,
    userEmail: USER_EMAIL_ENROLLED,
  });

  assert.equal(history.response.status, 200);
  assert.equal(history.payload.ok, true);
  assert.equal(history.payload.data.items.length, 2);
  assert.equal(history.payload.data.items[0].summary, "Second submission");
  assert.equal(history.payload.data.items[1].summary, "First submission");

  const db = client.db(dbName);
  const count = await db.collection("project_submissions").countDocuments({
    tenantId: TENANT_ID,
  });
  assert.equal(count, 2);
});
