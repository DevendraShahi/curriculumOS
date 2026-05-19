import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3322;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-courses-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-courses-${Date.now()}-${Math.random()
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

function authHeaders() {
  return {
    "content-type": "application/json",
    "x-test-auth-bypass": BYPASS_SECRET,
    "x-test-tenant-id": TENANT_ID,
    "x-test-user-id": "itest-courses-user",
    "x-test-user-email": "itest-courses-user@example.com",
    "x-test-user-first-name": "Courses",
    "x-test-user-last-name": "Tester",
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
  await db.collection("courses").deleteMany({ tenantId: TENANT_ID });
}

async function seedFixture(db) {
  const now = new Date();
  await db.collection("courses").insertMany([
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      slug: "frontend-foundation",
      title: "Frontend Foundation",
      summary: "Core frontend path",
      description: "HTML CSS JavaScript fundamentals.",
      category: "Frontend",
      level: "beginner",
      tags: ["react", "typescript"],
      status: "published",
      visibility: "public",
      modulesCount: 6,
      lessonsCount: 28,
      durationMinutes: 900,
      publishedAt: new Date(now.getTime() - 1_000),
      createdAt: new Date(now.getTime() - 10_000),
      updatedAt: new Date(now.getTime() - 1_000),
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      slug: "api-systems",
      title: "API Systems",
      summary: "Build robust APIs",
      description: "Node services, contracts, and architecture.",
      category: "Backend",
      level: "intermediate",
      tags: ["node", "api"],
      status: "published",
      visibility: "public",
      modulesCount: 5,
      lessonsCount: 24,
      durationMinutes: 760,
      publishedAt: new Date(now.getTime() - 2_000),
      createdAt: new Date(now.getTime() - 20_000),
      updatedAt: new Date(now.getTime() - 100),
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      slug: "react-performance",
      title: "React Performance",
      summary: "Frontend performance optimization",
      description: "React rendering, caching, and bundle strategy.",
      category: "Frontend",
      level: "advanced",
      tags: ["react", "performance"],
      status: "published",
      visibility: "public",
      modulesCount: 4,
      lessonsCount: 18,
      durationMinutes: 620,
      publishedAt: new Date(now.getTime() - 3_000),
      createdAt: new Date(now.getTime() - 30_000),
      updatedAt: new Date(now.getTime() - 3_000),
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      slug: "draft-frontend-lab",
      title: "Draft Frontend Lab",
      summary: "Should not be listed",
      description: "Draft course",
      category: "Frontend",
      level: "beginner",
      tags: ["react"],
      status: "draft",
      visibility: "private",
      modulesCount: 1,
      lessonsCount: 1,
      durationMinutes: 40,
      publishedAt: null,
      createdAt: new Date(now.getTime() - 40_000),
      updatedAt: new Date(now.getTime() - 40_000),
    },
  ]);
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
  });
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

test("courses API supports category/level/tag/q/sort/cursor filters and validates query contract", async () => {
  const firstPage = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(
      TENANT_ID
    )}&limit=2&sort=published_desc`
  );

  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.payload.ok, true);
  assert.equal(firstPage.payload.data.items.length, 2);
  assert.equal(firstPage.payload.data.pageInfo.hasMore, true);
  assert.equal(typeof firstPage.payload.data.pageInfo.nextCursor, "string");

  const firstSlugs = firstPage.payload.data.items.map((item) => item.slug);
  assert.deepEqual(firstSlugs, ["frontend-foundation", "api-systems"]);

  const secondPage = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(
      TENANT_ID
    )}&limit=2&sort=published_desc&cursor=${encodeURIComponent(
      firstPage.payload.data.pageInfo.nextCursor
    )}`
  );
  assert.equal(secondPage.response.status, 200);
  assert.equal(secondPage.payload.ok, true);
  assert.equal(secondPage.payload.data.items.length, 1);
  assert.equal(secondPage.payload.data.items[0].slug, "react-performance");
  assert.equal(secondPage.payload.data.pageInfo.hasMore, false);

  const byCategory = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&category=Frontend`
  );
  assert.equal(byCategory.response.status, 200);
  assert.equal(byCategory.payload.ok, true);
  assert.equal(byCategory.payload.data.items.length, 2);
  assert.equal(
    byCategory.payload.data.items.every((item) => item.category === "Frontend"),
    true
  );

  const byTag = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&tag=react`
  );
  assert.equal(byTag.response.status, 200);
  assert.equal(byTag.payload.ok, true);
  assert.equal(byTag.payload.data.items.length, 2);
  assert.equal(
    byTag.payload.data.items.every((item) => item.tags.includes("react")),
    true
  );

  const byLevel = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&level=advanced`
  );
  assert.equal(byLevel.response.status, 200);
  assert.equal(byLevel.payload.ok, true);
  assert.equal(byLevel.payload.data.items.length, 1);
  assert.equal(byLevel.payload.data.items[0].slug, "react-performance");

  const byQuery = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&q=node`
  );
  assert.equal(byQuery.response.status, 200);
  assert.equal(byQuery.payload.ok, true);
  assert.equal(byQuery.payload.data.items.length, 1);
  assert.equal(byQuery.payload.data.items[0].slug, "api-systems");

  const byUpdated = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&sort=updated_desc`
  );
  assert.equal(byUpdated.response.status, 200);
  assert.equal(byUpdated.payload.ok, true);
  assert.equal(byUpdated.payload.data.items[0].slug, "api-systems");

  const invalidSort = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&sort=wrong`
  );
  assert.equal(invalidSort.response.status, 400);
  assert.equal(invalidSort.payload.ok, false);
  assert.equal(invalidSort.payload.error, "INVALID_COURSE_FILTER");

  const invalidLevel = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&level=expert`
  );
  assert.equal(invalidLevel.response.status, 400);
  assert.equal(invalidLevel.payload.ok, false);
  assert.equal(invalidLevel.payload.error, "INVALID_COURSE_FILTER");

  const invalidCursor = await getJson(
    `/api/v1/courses?tenantId=${encodeURIComponent(TENANT_ID)}&cursor=not-a-cursor`
  );
  assert.equal(invalidCursor.response.status, 400);
  assert.equal(invalidCursor.payload.ok, false);
  assert.equal(invalidCursor.payload.error, "INVALID_COURSE_CURSOR");
});
