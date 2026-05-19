import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient } from "mongodb";

const PORT = 3317;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-profile-overview-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-profile-overview-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID = "itest-profile-overview-user";
const USER_EMAIL = "itest-profile-overview-user@example.com";

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
    "x-test-user-first-name": "Profile",
    "x-test-user-last-name": "Overview",
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
    "user_preferences",
    "progress_events",
    "progress",
    "project_submissions",
    "quiz_attempts",
    "enrollments",
    "certificates",
    "users",
  ];

  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function getOverview() {
  const response = await fetch(`${BASE_URL}/api/v1/profile/overview`, {
    headers: authHeaders(),
  });

  return {
    response,
    payload: await response.json(),
  };
}

async function patchPreferences(body) {
  const response = await fetch(`${BASE_URL}/api/v1/profile/preferences`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
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

test("GET profile overview returns default empty-state aggregates", async () => {
  const { response, payload } = await getOverview();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, TENANT_ID);
  assert.equal(payload.data.clerkUserId, USER_ID);

  assert.deepEqual(payload.data.preferences, {
    profileVisibility: "public",
    emailDigestEnabled: true,
    inAppNotificationsEnabled: true,
    preferredEditorTheme: "system",
    weeklyLearningGoalMinutes: null,
  });

  assert.deepEqual(payload.data.stats.enrollments, {
    active: 0,
    completed: 0,
    paused: 0,
    dropped: 0,
  });

  assert.deepEqual(payload.data.stats.progress, {
    totalLessons: 0,
    completedLessons: 0,
    inProgressLessons: 0,
    completionPercent: 0,
  });

  assert.equal(payload.data.stats.certificatesIssued, 0);
  assert.equal(payload.data.stats.quizAttempts, 0);
  assert.equal(payload.data.stats.projectSubmissions, 0);

  assert.equal(payload.data.activity.metricWindowDays, 91);
  assert.equal(payload.data.activity.cells.length, 91);
  assert.equal(
    payload.data.activity.cells.every((cell) => cell.count === 0 && cell.intensity === 0),
    true
  );
  assert.equal(payload.data.activity.streakDays, 0);
  assert.equal(payload.data.activity.totalUpdates, 0);
  assert.equal(payload.data.activity.completedEvents, 0);
  assert.equal(payload.data.activity.activeDays, 0);
  assert.equal(payload.data.activity.recentOutput.length >= 1, true);
  assert.equal(payload.data.activity.recentOutput[0].message, "No progress events recorded yet.");
});

test("PATCH profile preferences validates payload and persists updates", async () => {
  const invalid = await patchPreferences({
    profileVisibility: "team",
  });

  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.payload.ok, false);
  assert.equal(invalid.payload.error, "INVALID_PROFILE_PREFERENCES");

  const updated = await patchPreferences({
    profileVisibility: "private",
    emailDigestEnabled: false,
    inAppNotificationsEnabled: false,
    preferredEditorTheme: "dark",
    weeklyLearningGoalMinutes: 240,
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.ok, true);
  assert.deepEqual(updated.payload.data, {
    profileVisibility: "private",
    emailDigestEnabled: false,
    inAppNotificationsEnabled: false,
    preferredEditorTheme: "dark",
    weeklyLearningGoalMinutes: 240,
  });

  const { response, payload } = await getOverview();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.preferences, {
    profileVisibility: "private",
    emailDigestEnabled: false,
    inAppNotificationsEnabled: false,
    preferredEditorTheme: "dark",
    weeklyLearningGoalMinutes: 240,
  });

  const cleared = await patchPreferences({
    weeklyLearningGoalMinutes: null,
  });

  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.payload.ok, true);
  assert.equal(cleared.payload.data.weeklyLearningGoalMinutes, null);
});
