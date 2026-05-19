import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3324;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const EMPTY_TENANT_ID = `itest-dashboard-empty-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const SEEDED_TENANT_ID = `itest-dashboard-seeded-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

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
  lessonId: new ObjectId(),
  enrollmentId: new ObjectId(),
};

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
  const tenantFilter = {
    tenantId: { $in: [EMPTY_TENANT_ID, SEEDED_TENANT_ID] },
  };

  await Promise.all([
    db.collection("progress_events").deleteMany(tenantFilter),
    db.collection("enrollments").deleteMany(tenantFilter),
    db.collection("lessons").deleteMany(tenantFilter),
    db.collection("modules").deleteMany(tenantFilter),
    db.collection("courses").deleteMany(tenantFilter),
  ]);
}

async function seedFixture(db) {
  const now = new Date();

  await db.collection("courses").insertOne({
    _id: ids.courseId,
    tenantId: SEEDED_TENANT_ID,
    slug: "fullstack-systems",
    title: "Fullstack Systems",
    summary: "Build and scale production web systems.",
    description: "From architecture to observability.",
    category: "Backend",
    level: "intermediate",
    tags: ["backend", "systems"],
    status: "published",
    visibility: "public",
    modulesCount: 1,
    lessonsCount: 1,
    durationMinutes: 180,
    publishedAt: new Date(now.getTime() - 30_000),
    createdAt: new Date(now.getTime() - 60_000),
    updatedAt: new Date(now.getTime() - 20_000),
  });

  await db.collection("modules").insertOne({
    _id: ids.moduleId,
    tenantId: SEEDED_TENANT_ID,
    courseId: ids.courseId,
    slug: "service-lifecycle",
    title: "Service Lifecycle",
    description: "Model service boundaries and deployments.",
    order: 1,
    durationMinutes: 90,
    lessonsCount: 1,
    isPublished: true,
    createdAt: new Date(now.getTime() - 50_000),
    updatedAt: new Date(now.getTime() - 15_000),
  });

  await db.collection("lessons").insertOne({
    _id: ids.lessonId,
    tenantId: SEEDED_TENANT_ID,
    courseId: ids.courseId,
    moduleId: ids.moduleId,
    slug: "service-boundary-design",
    title: "Service Boundary Design",
    summary: "Choose boundaries by ownership and load.",
    description: "Applied design heuristics.",
    order: 1,
    durationMinutes: 35,
    contentType: "text",
    isPreview: false,
    isPublished: true,
    learningObjectives: [],
    instructions: [],
    bodyMarkdown: "Runtime lesson",
    starterFiles: [],
    expectedOutput: [],
    createdAt: new Date(now.getTime() - 45_000),
    updatedAt: new Date(now.getTime() - 14_000),
  });

  await db.collection("enrollments").insertOne({
    _id: ids.enrollmentId,
    tenantId: SEEDED_TENANT_ID,
    userId: ids.userId,
    courseId: ids.courseId,
    status: "active",
    progressPercent: 30,
    source: "direct",
    enrolledAt: new Date(now.getTime() - 12_000),
    createdAt: new Date(now.getTime() - 12_000),
    updatedAt: new Date(now.getTime() - 11_000),
  });

  await db.collection("progress_events").insertOne({
    _id: new ObjectId(),
    tenantId: SEEDED_TENANT_ID,
    userId: ids.userId,
    courseId: ids.courseId,
    lessonId: ids.lessonId.toString(),
    lessonRefId: ids.lessonId,
    moduleId: ids.moduleId.toString(),
    moduleRefId: ids.moduleId,
    enrollmentId: ids.enrollmentId,
    eventType: "lesson_progressed",
    state: "in_progress",
    progressPercent: 30,
    progressDelta: 30,
    timeSpentSeconds: 900,
    timeSpentDelta: 900,
    occurredAt: new Date(now.getTime() - 2_000),
    metadata: { source: "api_v1_progress" },
    createdAt: new Date(now.getTime() - 2_000),
    updatedAt: new Date(now.getTime() - 2_000),
  });
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
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

test("dashboard home API returns stable empty-state payload", async () => {
  const result = await getJson(
    `/api/v1/dashboard/home?tenantId=${encodeURIComponent(EMPTY_TENANT_ID)}`
  );

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.data.tenantId, EMPTY_TENANT_ID);
  assert.equal(result.payload.data.topCourses.length, 0);
  assert.equal(result.payload.data.moduleRegistry.length, 0);
  assert.equal(result.payload.data.topology.activeNodes, 0);
  assert.equal(result.payload.data.statusStrip.length, 6);
  assert.equal(result.payload.data.statusStrip.every((item) => item.ok === false), true);
});

test("dashboard home API returns seeded aggregates and registry", async () => {
  const result = await getJson(
    `/api/v1/dashboard/home?tenantId=${encodeURIComponent(SEEDED_TENANT_ID)}`
  );

  assert.equal(result.response.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.data.tenantId, SEEDED_TENANT_ID);
  assert.equal(result.payload.data.topCourses.length, 1);
  assert.equal(result.payload.data.topCourses[0].slug, "fullstack-systems");
  assert.equal(result.payload.data.topCourses[0].enrollments, 1);

  assert.equal(result.payload.data.moduleRegistry.length, 1);
  assert.equal(result.payload.data.moduleRegistry[0].slug, "service-lifecycle");
  assert.equal(result.payload.data.moduleRegistry[0].status, "available");
  assert.equal(result.payload.data.moduleRegistry[0].actionLabel, "Explore");

  assert.equal(result.payload.data.topology.activeNodes >= 3, true);

  const statuses = new Map(
    result.payload.data.statusStrip.map((item) => [item.label, item])
  );
  assert.equal(statuses.get("COURSES")?.ok, true);
  assert.equal(statuses.get("MODULES")?.ok, true);
  assert.equal(statuses.get("LESSONS")?.ok, true);
  assert.equal(statuses.get("ENROLLMENTS")?.ok, true);
  assert.equal(statuses.get("7D EVENTS")?.ok, true);
  assert.equal(statuses.get("LEARNERS")?.ok, true);
});
