import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient } from "mongodb";

const PORT = 3318;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-community-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-community-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID = "itest-community-user";
const USER_EMAIL = "itest-community-user@example.com";

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
    "x-test-user-id": USER_ID,
    "x-test-user-email": USER_EMAIL,
    "x-test-user-first-name": "Community",
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
  const collections = [
    "discussion_votes",
    "discussion_comments",
    "discussion_threads",
    "discussion_tags",
    "users",
  ];

  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function getThreads(query = "") {
  const response = await fetch(`${BASE_URL}/api/v1/community/threads${query}`, {
    headers: authHeaders(),
  });

  return {
    response,
    payload: await response.json(),
  };
}

async function createThread(body) {
  const response = await fetch(`${BASE_URL}/api/v1/community/threads`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  return {
    response,
    payload: await response.json(),
  };
}

async function getTags() {
  const response = await fetch(`${BASE_URL}/api/v1/community/tags?limit=10`, {
    headers: authHeaders(),
  });

  return {
    response,
    payload: await response.json(),
  };
}

async function getLeaderboard() {
  const response = await fetch(
    `${BASE_URL}/api/v1/community/leaderboard?limit=10`,
    {
      headers: authHeaders(),
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

test("community threads lifecycle data appears in tags and leaderboard", async () => {
  const empty = await getThreads("?limit=10");
  assert.equal(empty.response.status, 200);
  assert.equal(empty.payload.ok, true);
  assert.equal(empty.payload.data.items.length, 0);

  const invalid = await createThread({
    title: "Too short",
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.payload.ok, false);
  assert.equal(invalid.payload.error, "INVALID_COMMUNITY_THREAD");

  const created = await createThread({
    title: "How should we structure state for curriculum and playground modules?",
    body: "I am looking for practical architecture guidance for combining module progress and playground output state in one app.",
    category: "architecture",
    tags: ["state-management", "playground", "curriculum"],
    visibility: "public",
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.payload.ok, true);
  assert.equal(typeof created.payload.data.id, "string");
  assert.equal(created.payload.data.category, "architecture");

  const listed = await getThreads("?limit=10");
  assert.equal(listed.response.status, 200);
  assert.equal(listed.payload.ok, true);
  assert.equal(listed.payload.data.items.length >= 1, true);

  const createdThread = listed.payload.data.items.find(
    (item) => item.id === created.payload.data.id
  );
  assert.ok(createdThread);
  assert.equal(
    createdThread.title,
    "How should we structure state for curriculum and playground modules?"
  );
  assert.deepEqual(createdThread.tags, [
    "state-management",
    "playground",
    "curriculum",
  ]);

  const tags = await getTags();
  assert.equal(tags.response.status, 200);
  assert.equal(tags.payload.ok, true);
  assert.equal(tags.payload.data.items.length >= 3, true);

  const tagSlugs = tags.payload.data.items.map((item) => item.slug);
  assert.equal(tagSlugs.includes("state-management"), true);
  assert.equal(tagSlugs.includes("playground"), true);
  assert.equal(tagSlugs.includes("curriculum"), true);

  const leaderboard = await getLeaderboard();
  assert.equal(leaderboard.response.status, 200);
  assert.equal(leaderboard.payload.ok, true);
  assert.equal(leaderboard.payload.data.items.length >= 1, true);

  const first = leaderboard.payload.data.items[0];
  assert.equal(first.user.fullName, "Community Tester");
  assert.equal(first.stats.threads >= 1, true);
  assert.equal(first.points > 0, true);
});
