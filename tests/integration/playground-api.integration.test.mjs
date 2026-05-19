import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test, { after, before } from "node:test";
import { MongoClient, ObjectId } from "mongodb";

const PORT = 3313;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BYPASS_SECRET = `itest-playground-bypass-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

const TENANT_ID = `itest-playground-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const USER_ID_OWNER = "itest-playground-owner";
const USER_EMAIL_OWNER = "itest-playground-owner@example.com";
const USER_ID_OTHER = "itest-playground-other";
const USER_EMAIL_OTHER = "itest-playground-other@example.com";

const TEMPLATE_PUBLIC_SLUG = "itest-ts-public-starter";
const TEMPLATE_TENANT_SLUG = "itest-node-tenant-lab";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
if (!mongoUri || !dbName) {
  throw new Error("Missing MONGODB_URI or MONGODB_DB_NAME for integration test");
}

const client = new MongoClient(mongoUri);
let appProcess = null;
let serverLog = "";

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
        `Next.js server exited before ready (code ${appProcess.exitCode}). Logs:\\n${serverLog}`
      );
    }

    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.status > 0) return;
    } catch {}
    await sleep(800);
  }

  throw new Error(`Timed out waiting for Next.js server. Logs:\\n${serverLog}`);
}

async function seedFixture(db) {
  const now = new Date();
  const ownerUserDbId = new ObjectId();
  const otherUserDbId = new ObjectId();

  const publicTemplateId = new ObjectId();
  const tenantTemplateId = new ObjectId();
  const draftTemplateId = new ObjectId();

  await db.collection("users").insertMany([
    {
      _id: ownerUserDbId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_OWNER,
      email: USER_EMAIL_OWNER,
      emailLower: USER_EMAIL_OWNER.toLowerCase(),
      username: "itest-playground-owner",
      usernameLower: "itest-playground-owner",
      fullName: "Integration Playground Owner",
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
      _id: otherUserDbId,
      tenantId: TENANT_ID,
      clerkUserId: USER_ID_OTHER,
      email: USER_EMAIL_OTHER,
      emailLower: USER_EMAIL_OTHER.toLowerCase(),
      username: "itest-playground-other",
      usernameLower: "itest-playground-other",
      fullName: "Integration Playground Other",
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

  await db.collection("playground_templates").insertMany([
    {
      _id: publicTemplateId,
      tenantId: TENANT_ID,
      slug: TEMPLATE_PUBLIC_SLUG,
      title: "Integration Public TypeScript Starter",
      description: "Public template for playground integration tests",
      tags: ["frontend", "typescript"],
      runtime: "node",
      visibility: "public",
      isPublished: true,
      starterFiles: [
        {
          path: "main.ts",
          language: "typescript",
          content: 'console.log("public template")',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: tenantTemplateId,
      tenantId: TENANT_ID,
      slug: TEMPLATE_TENANT_SLUG,
      title: "Integration Tenant Node Lab",
      description: "Tenant members template for backend track",
      tags: ["backend", "node"],
      runtime: "node",
      visibility: "tenant_members",
      isPublished: true,
      starterFiles: [
        {
          path: "server.js",
          language: "javascript",
          content: 'console.log("tenant template")',
        },
      ],
      validationRules: [
        {
          id: "server-log-marker",
          label: "Server file includes integration marker",
          type: "file_includes",
          filePath: "server.js",
          value: "integration",
          required: true,
        },
      ],
      createdAt: now,
      updatedAt: new Date(now.getTime() + 1_000),
    },
    {
      _id: draftTemplateId,
      tenantId: TENANT_ID,
      slug: "itest-hidden-draft",
      title: "Integration Hidden Draft",
      description: "Draft template should not be listed",
      tags: ["draft"],
      runtime: "node",
      visibility: "public",
      isPublished: false,
      starterFiles: [
        {
          path: "draft.js",
          language: "javascript",
          content: "// hidden draft",
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return {
    ownerUserDbId,
    otherUserDbId,
    publicTemplateId,
    tenantTemplateId,
  };
}

async function cleanupFixture(db) {
  const collections = [
    "playground_runs",
    "playground_sessions",
    "playground_templates",
    "users",
  ];

  for (const name of collections) {
    await db.collection(name).deleteMany({ tenantId: TENANT_ID });
  }
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  return { response, payload };
}

let privateSessionId = null;
let unlistedSessionId = null;
let firstRunId = null;

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

test("GET templates unauthenticated lists only public published templates", async () => {
  const { response, payload } = await getJson(
    `${BASE_URL}/api/v1/playground/templates?tenantId=${encodeURIComponent(TENANT_ID)}&limit=20`
  );

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0].slug, TEMPLATE_PUBLIC_SLUG);
  assert.equal(payload.data.items[0].visibility, "public");
});

test("GET templates authenticated includes tenant templates and supports tag/q filters", async () => {
  const baseHeaders = authHeaders({
    userId: USER_ID_OWNER,
    userEmail: USER_EMAIL_OWNER,
  });

  const all = await getJson(
    `${BASE_URL}/api/v1/playground/templates?limit=20`,
    { headers: baseHeaders }
  );

  assert.equal(all.response.status, 200);
  assert.equal(all.payload.ok, true);
  assert.equal(all.payload.data.items.length, 2);
  assert.equal(
    new Set(all.payload.data.items.map((item) => item.slug)).has(TEMPLATE_TENANT_SLUG),
    true
  );

  const byTag = await getJson(
    `${BASE_URL}/api/v1/playground/templates?tag=backend&limit=20`,
    { headers: baseHeaders }
  );

  assert.equal(byTag.response.status, 200);
  assert.equal(byTag.payload.ok, true);
  assert.equal(byTag.payload.data.items.length, 1);
  assert.equal(byTag.payload.data.items[0].slug, TEMPLATE_TENANT_SLUG);

  const byQuery = await getJson(
    `${BASE_URL}/api/v1/playground/templates?q=Public%20TypeScript&limit=20`,
    { headers: baseHeaders }
  );

  assert.equal(byQuery.response.status, 200);
  assert.equal(byQuery.payload.ok, true);
  assert.equal(byQuery.payload.data.items.length, 1);
  assert.equal(byQuery.payload.data.items[0].slug, TEMPLATE_PUBLIC_SLUG);
});

test("session create/list and status filter behavior", async () => {
  const ownerHeaders = authHeaders({
    userId: USER_ID_OWNER,
    userEmail: USER_EMAIL_OWNER,
  });

  const created = await getJson(`${BASE_URL}/api/v1/playground/sessions`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      templateId: TEMPLATE_TENANT_SLUG,
    }),
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.payload.ok, true);
  assert.equal(created.payload.data.visibility, "private");
  assert.equal(created.payload.data.files.length, 1);
  assert.equal(created.payload.data.files[0].path, "server.js");

  privateSessionId = created.payload.data.id;

  const list = await getJson(`${BASE_URL}/api/v1/playground/sessions?status=active&limit=10`, {
    headers: ownerHeaders,
  });

  assert.equal(list.response.status, 200);
  assert.equal(list.payload.ok, true);
  assert.equal(list.payload.data.count >= 1, true);
  assert.equal(
    list.payload.data.items.some((session) => session.id === privateSessionId),
    true
  );

  const invalid = await getJson(`${BASE_URL}/api/v1/playground/sessions?status=invalid`, {
    headers: ownerHeaders,
  });

  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.payload.ok, false);
  assert.equal(invalid.payload.error, "INVALID_PLAYGROUND_FILTER");
});

test("session visibility and ownership rules are enforced", async () => {
  const ownerHeaders = authHeaders({
    userId: USER_ID_OWNER,
    userEmail: USER_EMAIL_OWNER,
  });
  const otherHeaders = authHeaders({
    userId: USER_ID_OTHER,
    userEmail: USER_EMAIL_OTHER,
  });

  const privateReadByOther = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${privateSessionId}`,
    { headers: otherHeaders }
  );

  assert.equal(privateReadByOther.response.status, 403);
  assert.equal(privateReadByOther.payload.ok, false);
  assert.equal(privateReadByOther.payload.error, "FORBIDDEN");

  const unlistedCreate = await getJson(`${BASE_URL}/api/v1/playground/sessions`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      templateId: TEMPLATE_PUBLIC_SLUG,
      visibility: "unlisted",
    }),
  });

  assert.equal(unlistedCreate.response.status, 201);
  assert.equal(unlistedCreate.payload.ok, true);
  assert.equal(unlistedCreate.payload.data.visibility, "unlisted");
  assert.equal(unlistedCreate.payload.data.files[0].path, "main.ts");
  unlistedSessionId = unlistedCreate.payload.data.id;

  const unlistedReadByOther = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${unlistedSessionId}`,
    { headers: otherHeaders }
  );

  assert.equal(unlistedReadByOther.response.status, 200);
  assert.equal(unlistedReadByOther.payload.ok, true);
  assert.equal(unlistedReadByOther.payload.data.id, unlistedSessionId);

  const patchByOther = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${privateSessionId}/files`,
    {
      method: "PATCH",
      headers: otherHeaders,
      body: JSON.stringify({
        mode: "merge",
        files: [
          {
            path: "hack.js",
            language: "javascript",
            content: 'console.log("not allowed")',
          },
        ],
      }),
    }
  );

  assert.equal(patchByOther.response.status, 403);
  assert.equal(patchByOther.payload.ok, false);
  assert.equal(patchByOther.payload.error, "FORBIDDEN");
});

test("owner can patch files, run session, and list runs", async () => {
  const ownerHeaders = authHeaders({
    userId: USER_ID_OWNER,
    userEmail: USER_EMAIL_OWNER,
  });

  const patch = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${privateSessionId}/files`,
    {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({
        mode: "replace",
        files: [
          {
            path: "server.js",
            language: "javascript",
            content: 'console.log("updated from integration test")',
          },
          {
            path: "README.md",
            language: "markdown",
            content: "# Integration Test",
          },
        ],
      }),
    }
  );

  assert.equal(patch.response.status, 200);
  assert.equal(patch.payload.ok, true);
  assert.equal(patch.payload.data.files.length, 2);
  assert.equal(
    patch.payload.data.files.some((file) => file.path === "README.md"),
    true
  );

  const run = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${privateSessionId}/run`,
    {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        summary: "integration run",
      }),
    }
  );

  assert.equal(run.response.status, 201);
  assert.equal(run.payload.ok, true);
  assert.equal(run.payload.data.mode, "run");
  assert.equal(run.payload.data.status, "succeeded");
  assert.equal(run.payload.data.sessionId, privateSessionId);
  assert.equal(Array.isArray(run.payload.data.checks), true);
  assert.equal(run.payload.data.checks.length, 1);
  assert.equal(run.payload.data.checks[0].passed, true);
  firstRunId = run.payload.data.id;

  const fallbackRun = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${unlistedSessionId}/run`,
    {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        mode: "test",
      }),
    }
  );

  assert.equal(fallbackRun.response.status, 201);
  assert.equal(fallbackRun.payload.ok, true);
  assert.equal(fallbackRun.payload.data.mode, "test");
  assert.equal(fallbackRun.payload.data.status, "failed");
  assert.equal(Array.isArray(fallbackRun.payload.data.checks), true);
  assert.equal(fallbackRun.payload.data.checks.length >= 1, true);

  const runs = await getJson(
    `${BASE_URL}/api/v1/playground/sessions/${privateSessionId}/runs?limit=5`,
    {
      headers: ownerHeaders,
    }
  );

  assert.equal(runs.response.status, 200);
  assert.equal(runs.payload.ok, true);
  assert.equal(runs.payload.data.items.length >= 1, true);
  assert.equal(runs.payload.data.items[0].id, firstRunId);
  assert.equal(runs.payload.data.items[0].mode, "run");

  const db = client.db(dbName);
  const storedSession = await db.collection("playground_sessions").findOne({
    tenantId: TENANT_ID,
    _id: new ObjectId(privateSessionId),
  });

  assert.ok(storedSession);
  assert.ok(storedSession.latestRunId);
  assert.equal(storedSession.latestRunId.toString(), firstRunId);
});
