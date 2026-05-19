const { MongoClient, ObjectId } = require("mongodb");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    write: false,
    tenantId: undefined,
    batchSize: 500,
  };

  for (const arg of argv) {
    if (arg === "--write") {
      options.write = true;
      continue;
    }

    if (arg.startsWith("--tenant=")) {
      options.tenantId = arg.slice("--tenant=".length).trim() || undefined;
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      const value = Number.parseInt(arg.slice("--batch-size=".length), 10);
      if (!Number.isFinite(value) || value < 1 || value > 5000) {
        throw new Error("Invalid --batch-size value. Use 1..5000.");
      }
      options.batchSize = value;
      continue;
    }

    if (arg === "--help") {
      console.log(
        [
          "Usage:",
          "  node scripts/backfill-relation-refs.cjs [--write] [--tenant=<tenantId>] [--batch-size=<n>]",
          "",
          "Flags:",
          "  --write         Apply updates (default is dry-run).",
          "  --tenant=...    Restrict backfill to a single tenant.",
          "  --batch-size=   Bulk write batch size (default: 500).",
        ].join("\n")
      );
      process.exit(0);
    }
  }

  return options;
}

function makeTenantFilter(tenantId) {
  return tenantId ? { tenantId } : {};
}

function isMissingObjectId(value) {
  return !value || !(value instanceof ObjectId);
}

function parseObjectIdFromString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !ObjectId.isValid(trimmed)) return null;
  return new ObjectId(trimmed);
}

function buildLessonLookupKey(tenantId, courseId, lessonIdOrSlug) {
  return `${tenantId}:${courseId.toString()}:${lessonIdOrSlug}`;
}

function makeLessonResolver(db) {
  const cache = new Map();
  const lessons = db.collection("lessons");

  return async function resolveLesson({ tenantId, courseId, lessonIdOrSlug }) {
    const key = buildLessonLookupKey(tenantId, courseId, lessonIdOrSlug);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const lookup = lessonIdOrSlug.trim();
    const byObjectId = parseObjectIdFromString(lookup);
    let lesson = null;

    if (byObjectId) {
      lesson = await lessons.findOne(
        { tenantId, courseId, _id: byObjectId },
        { projection: { _id: 1, moduleId: 1, slug: 1 } }
      );
    }

    if (!lesson) {
      lesson = await lessons.findOne(
        { tenantId, courseId, slug: lookup },
        { projection: { _id: 1, moduleId: 1, slug: 1 } }
      );
    }

    cache.set(key, lesson);
    return lesson;
  };
}

async function flushBulk({ collection, pending, write }) {
  if (pending.length === 0) return 0;
  if (!write) return pending.length;

  const result = await collection.bulkWrite(pending, { ordered: false });
  return result.modifiedCount + result.upsertedCount;
}

async function backfillProgress({ db, options, resolveLesson }) {
  const collection = db.collection("progress");
  const filter = {
    ...makeTenantFilter(options.tenantId),
    $or: [
      { lessonRefId: { $exists: false } },
      { lessonRefId: null },
      { moduleRefId: { $exists: false } },
      { moduleRefId: null },
    ],
  };

  const cursor = collection.find(filter);
  const pending = [];
  const stats = { scanned: 0, matched: 0, applied: 0 };

  for await (const row of cursor) {
    stats.scanned += 1;

    const update = {};
    const lessonId = typeof row.lessonId === "string" ? row.lessonId.trim() : "";
    if (!lessonId) continue;

    const lesson = await resolveLesson({
      tenantId: row.tenantId,
      courseId: row.courseId,
      lessonIdOrSlug: lessonId,
    });

    if (lesson) {
      if (isMissingObjectId(row.lessonRefId)) {
        update.lessonRefId = lesson._id;
      }
      if (isMissingObjectId(row.moduleRefId)) {
        update.moduleRefId = lesson.moduleId;
      }
      if (typeof row.moduleId !== "string" || !row.moduleId.trim()) {
        update.moduleId = lesson.moduleId.toString();
      }
    }

    if (Object.keys(update).length === 0) continue;

    stats.matched += 1;
    pending.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: update },
      },
    });

    if (pending.length >= options.batchSize) {
      stats.applied += await flushBulk({
        collection,
        pending,
        write: options.write,
      });
      pending.length = 0;
    }
  }

  stats.applied += await flushBulk({
    collection,
    pending,
    write: options.write,
  });

  return stats;
}

async function backfillProgressEvents({ db, options, resolveLesson }) {
  const collection = db.collection("progress_events");
  const filter = {
    ...makeTenantFilter(options.tenantId),
    $or: [
      { lessonRefId: { $exists: false } },
      { lessonRefId: null },
      { moduleRefId: { $exists: false } },
      { moduleRefId: null },
    ],
  };

  const cursor = collection.find(filter);
  const pending = [];
  const stats = { scanned: 0, matched: 0, applied: 0 };

  for await (const row of cursor) {
    stats.scanned += 1;

    const update = {};
    const lessonId = typeof row.lessonId === "string" ? row.lessonId.trim() : "";
    if (!lessonId) continue;

    const lesson = await resolveLesson({
      tenantId: row.tenantId,
      courseId: row.courseId,
      lessonIdOrSlug: lessonId,
    });

    if (lesson) {
      if (isMissingObjectId(row.lessonRefId)) {
        update.lessonRefId = lesson._id;
      }
      if (isMissingObjectId(row.moduleRefId)) {
        update.moduleRefId = lesson.moduleId;
      }
      if (typeof row.moduleId !== "string" || !row.moduleId.trim()) {
        update.moduleId = lesson.moduleId.toString();
      }
    }

    if (Object.keys(update).length === 0) continue;

    stats.matched += 1;
    pending.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: update },
      },
    });

    if (pending.length >= options.batchSize) {
      stats.applied += await flushBulk({
        collection,
        pending,
        write: options.write,
      });
      pending.length = 0;
    }
  }

  stats.applied += await flushBulk({
    collection,
    pending,
    write: options.write,
  });

  return stats;
}

async function backfillEnrollments({ db, options, resolveLesson }) {
  const collection = db.collection("enrollments");
  const filter = {
    ...makeTenantFilter(options.tenantId),
    lastLessonId: { $type: "string" },
    $or: [{ lastLessonRefId: { $exists: false } }, { lastLessonRefId: null }],
  };

  const cursor = collection.find(filter);
  const pending = [];
  const stats = { scanned: 0, matched: 0, applied: 0 };

  for await (const row of cursor) {
    stats.scanned += 1;

    const lessonId = row.lastLessonId.trim();
    if (!lessonId) continue;

    const lesson = await resolveLesson({
      tenantId: row.tenantId,
      courseId: row.courseId,
      lessonIdOrSlug: lessonId,
    });

    if (!lesson) continue;

    stats.matched += 1;
    pending.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { lastLessonRefId: lesson._id } },
      },
    });

    if (pending.length >= options.batchSize) {
      stats.applied += await flushBulk({
        collection,
        pending,
        write: options.write,
      });
      pending.length = 0;
    }
  }

  stats.applied += await flushBulk({
    collection,
    pending,
    write: options.write,
  });

  return stats;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uri = requireEnv("MONGODB_URI");
  const dbName = requireEnv("MONGODB_DB_NAME");
  const client = new MongoClient(uri);

  await client.connect();
  try {
    const db = client.db(dbName);
    const resolveLesson = makeLessonResolver(db);

    const [progress, progressEvents, enrollments] = await Promise.all([
      backfillProgress({ db, options, resolveLesson }),
      backfillProgressEvents({ db, options, resolveLesson }),
      backfillEnrollments({ db, options, resolveLesson }),
    ]);

    const mode = options.write ? "WRITE" : "DRY-RUN";
    console.log(`[backfill-relation-refs] mode=${mode}`);
    console.log(
      `[progress] scanned=${progress.scanned} matched=${progress.matched} applied=${progress.applied}`
    );
    console.log(
      `[progress_events] scanned=${progressEvents.scanned} matched=${progressEvents.matched} applied=${progressEvents.applied}`
    );
    console.log(
      `[enrollments] scanned=${enrollments.scanned} matched=${enrollments.matched} applied=${enrollments.applied}`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("[backfill-relation-refs] failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
