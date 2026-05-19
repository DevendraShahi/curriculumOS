import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3321;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-notifications-leads-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-notifications-leads-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID = "itest-notifications-leads-user";
const USER_EMAIL = "itest-notifications-leads-user@example.com";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!mongoUri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB_NAME for integration test");
}

const client = new MongoClient(mongoUri);
let appProcess = null;
let serverLog = "";
const seedIds = {
  userId: new ObjectId(),
  notifications: [new ObjectId(), new ObjectId(), new ObjectId()],
};

function authHeaders() {
  return {
    "content-type": "application/json",
    "x-test-auth-bypass": BYPASS_SECRET,
    "x-test-tenant-id": TENANT_ID,
    "x-test-user-id": USER_ID,
    "x-test-user-email": USER_EMAIL,
    "x-test-user-first-name": "Notifications",
    "x-test-user-last-name": "LeadTester",
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
  const collections = ["notifications", "lead_captures", "users"];
  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function seedFixture(db) {
  const now = new Date();

  await db.collection("users").insertOne({
    _id: seedIds.userId,
    tenantId: TENANT_ID,
    clerkUserId: USER_ID,
    email: USER_EMAIL,
    emailLower: USER_EMAIL.toLowerCase(),
    username: "itest-notifications-leads-user",
    usernameLower: "itest-notifications-leads-user",
    fullName: "Notifications LeadTester",
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

  await db.collection("notifications").insertMany([
    {
      _id: seedIds.notifications[0],
      tenantId: TENANT_ID,
      userId: seedIds.userId,
      type: "lesson_progress",
      title: "Lesson marked complete",
      body: "You completed Distributed Systems: Replication Patterns.",
      actionUrl: "/curriculum/distributed-systems",
      metadata: { courseId: "distributed-systems" },
      readAt: null,
      createdAt: new Date(now.getTime() - 1_000),
      updatedAt: new Date(now.getTime() - 1_000),
    },
    {
      _id: seedIds.notifications[1],
      tenantId: TENANT_ID,
      userId: seedIds.userId,
      type: "discussion_reply",
      title: "New reply on your thread",
      body: "A new reply was posted on your community discussion.",
      actionUrl: "/community",
      metadata: { threadId: "abc123" },
      readAt: null,
      createdAt: new Date(now.getTime() - 2_000),
      updatedAt: new Date(now.getTime() - 2_000),
    },
    {
      _id: seedIds.notifications[2],
      tenantId: TENANT_ID,
      userId: seedIds.userId,
      type: "platform_update",
      title: "New sandbox runtime",
      body: "The node runtime has been updated for playground sessions.",
      actionUrl: "/playground/sandbox",
      metadata: { runtime: "node" },
      readAt: new Date(now.getTime() - 200),
      createdAt: new Date(now.getTime() - 3_000),
      updatedAt: new Date(now.getTime() - 200),
    },
  ]);
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
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

test("notifications list, filtering, pagination, and mark-as-read flows", async () => {
  const firstPage = await getJson(`${BASE_URL}/api/v1/notifications?limit=2`, {
    headers: authHeaders(),
  });

  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.payload.ok, true);
  assert.equal(firstPage.payload.data.items.length, 2);
  assert.equal(firstPage.payload.data.unreadCount, 2);
  assert.equal(firstPage.payload.data.pageInfo.hasMore, true);
  assert.equal(typeof firstPage.payload.data.pageInfo.nextCursor, "string");
  assert.equal(firstPage.payload.data.items[0].title, "Lesson marked complete");

  const secondPage = await getJson(
    `${BASE_URL}/api/v1/notifications?limit=2&cursor=${encodeURIComponent(firstPage.payload.data.pageInfo.nextCursor)}`,
    {
      headers: authHeaders(),
    }
  );
  assert.equal(secondPage.response.status, 200);
  assert.equal(secondPage.payload.ok, true);
  assert.equal(secondPage.payload.data.items.length, 1);
  assert.equal(secondPage.payload.data.pageInfo.hasMore, false);

  const unreadOnly = await getJson(
    `${BASE_URL}/api/v1/notifications?limit=10&unreadOnly=true`,
    {
      headers: authHeaders(),
    }
  );
  assert.equal(unreadOnly.response.status, 200);
  assert.equal(unreadOnly.payload.ok, true);
  assert.equal(unreadOnly.payload.data.items.length, 2);
  assert.equal(
    unreadOnly.payload.data.items.every((item) => item.readAt === null),
    true
  );

  const invalidFilter = await getJson(
    `${BASE_URL}/api/v1/notifications?unreadOnly=maybe`,
    {
      headers: authHeaders(),
    }
  );
  assert.equal(invalidFilter.response.status, 400);
  assert.equal(invalidFilter.payload.ok, false);
  assert.equal(invalidFilter.payload.error, "INVALID_NOTIFICATION_FILTER");

  const unreadTargetId = firstPage.payload.data.items.find(
    (item) => item.readAt === null
  )?.id;
  assert.ok(unreadTargetId);

  const markedRead = await getJson(
    `${BASE_URL}/api/v1/notifications/${encodeURIComponent(unreadTargetId)}/read`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );
  assert.equal(markedRead.response.status, 200);
  assert.equal(markedRead.payload.ok, true);
  assert.equal(typeof markedRead.payload.data.readAt, "string");

  const refreshed = await getJson(`${BASE_URL}/api/v1/notifications?limit=10`, {
    headers: authHeaders(),
  });
  assert.equal(refreshed.response.status, 200);
  assert.equal(refreshed.payload.ok, true);
  assert.equal(refreshed.payload.data.unreadCount, 1);
});

test("newsletter lead capture validates payload and upserts by email", async () => {
  const endpoint = `${BASE_URL}/api/v1/leads/newsletter?tenantId=${encodeURIComponent(
    TENANT_ID
  )}`;

  const invalid = await getJson(endpoint, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: "not-an-email",
    }),
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.payload.ok, false);
  assert.equal(invalid.payload.error, "INVALID_LEAD_CAPTURE");

  const firstCapture = await getJson(endpoint, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: "future-builder@example.com",
      fullName: "Future Builder",
      source: "homepage_request_access",
      metadata: {
        referrer: "landing",
      },
    }),
  });
  assert.equal(firstCapture.response.status, 201);
  assert.equal(firstCapture.payload.ok, true);
  assert.equal(firstCapture.payload.data.email, "future-builder@example.com");
  assert.equal(firstCapture.payload.data.source, "homepage_request_access");
  assert.equal(firstCapture.payload.data.status, "new");

  const secondCapture = await getJson(endpoint, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: "future-builder@example.com",
      fullName: "Future Builder Updated",
      source: "community_newsletter",
      metadata: {
        referrer: "community",
      },
    }),
  });
  assert.equal(secondCapture.response.status, 201);
  assert.equal(secondCapture.payload.ok, true);
  assert.equal(secondCapture.payload.data.id, firstCapture.payload.data.id);
  assert.equal(secondCapture.payload.data.source, "community_newsletter");
  assert.equal(secondCapture.payload.data.fullName, "Future Builder Updated");

  const db = client.db(dbName);
  const leads = await db
    .collection("lead_captures")
    .find({ tenantId: TENANT_ID, emailLower: "future-builder@example.com" })
    .toArray();

  assert.equal(leads.length, 1);
  assert.equal(leads[0].source, "community_newsletter");
  assert.equal(leads[0].fullName, "Future Builder Updated");
  assert.equal(leads[0].userId === null || leads[0].userId === undefined, true);
});
