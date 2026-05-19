const { MongoClient, ObjectId } = require("mongodb");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function readArg(prefix) {
  const entry = process.argv.find((value) => value.startsWith(prefix));
  if (!entry) return undefined;
  return entry.slice(prefix.length).trim() || undefined;
}

function toDateOrNull(value) {
  if (!(value instanceof Date)) return null;
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

function pickDate(...values) {
  for (const value of values) {
    const date = toDateOrNull(value);
    if (date) return date;
  }
  return new Date();
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNonNegativeInteger(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function startedPercentFromFinal(finalPercent) {
  if (finalPercent <= 1) return 1;
  if (finalPercent >= 100) return 99;
  return finalPercent;
}

function pushEvent(events, state, eventType, progress, params) {
  const progressPercent = clampPercent(params.progressPercent);
  const timeSpentSeconds = toNonNegativeInteger(params.timeSpentSeconds);
  const previous = events[events.length - 1];
  const previousProgress = previous ? previous.progressPercent : 0;
  const previousTime = previous ? previous.timeSpentSeconds ?? 0 : 0;
  const now = new Date();

  events.push({
    _id: new ObjectId(),
    tenantId: progress.tenantId,
    userId: progress.userId,
    courseId: progress.courseId,
    lessonId: progress.lessonId,
    moduleId: progress.moduleId ?? null,
    enrollmentId: progress.enrollmentId ?? null,
    eventType,
    state,
    progressPercent,
    progressDelta: progressPercent - previousProgress,
    timeSpentSeconds,
    timeSpentDelta: timeSpentSeconds - previousTime,
    occurredAt: params.occurredAt,
    metadata: {
      source: "backfill_progress_snapshot_v1",
    },
    createdAt: now,
    updatedAt: now,
  });
}

function buildBackfillEvents(progress) {
  const events = [];

  const state =
    progress.state === "completed" || progress.state === "in_progress"
      ? progress.state
      : "not_started";
  const finalPercent = clampPercent(progress.progressPercent ?? 0);
  const finalTimeSpent = toNonNegativeInteger(progress.timeSpentSeconds ?? 0);

  const startedAt = toDateOrNull(progress.startedAt);
  const completedAt = toDateOrNull(progress.completedAt);
  const lastActivityAt = toDateOrNull(progress.lastActivityAt);
  const updatedAt = toDateOrNull(progress.updatedAt);
  const createdAt = toDateOrNull(progress.createdAt);
  const fallbackAt = pickDate(lastActivityAt, updatedAt, completedAt, startedAt, createdAt);

  if (state === "completed") {
    if (startedAt) {
      pushEvent(events, "in_progress", "lesson_started", progress, {
        occurredAt: startedAt,
        progressPercent: startedPercentFromFinal(finalPercent),
        timeSpentSeconds: 0,
      });
    }

    pushEvent(events, "completed", "lesson_completed", progress, {
      occurredAt: pickDate(completedAt, lastActivityAt, updatedAt, startedAt, createdAt, fallbackAt),
      progressPercent: finalPercent > 0 ? finalPercent : 100,
      timeSpentSeconds: finalTimeSpent,
    });

    return events;
  }

  if (state === "in_progress") {
    const startedAtOrFallback = pickDate(startedAt, lastActivityAt, updatedAt, createdAt, fallbackAt);
    const startedPercent = startedPercentFromFinal(finalPercent);
    pushEvent(events, "in_progress", "lesson_started", progress, {
      occurredAt: startedAtOrFallback,
      progressPercent: startedPercent,
      timeSpentSeconds: 0,
    });

    const progressedAt = pickDate(lastActivityAt, updatedAt, createdAt, startedAtOrFallback);
    const hasMoreProgress = finalPercent > startedPercent || finalTimeSpent > 0;
    const isLaterMoment =
      progressedAt.getTime() > startedAtOrFallback.getTime();

    if (hasMoreProgress || isLaterMoment) {
      pushEvent(events, "in_progress", "lesson_progressed", progress, {
        occurredAt: progressedAt,
        progressPercent: finalPercent,
        timeSpentSeconds: finalTimeSpent,
      });
    }

    return events;
  }

  if (finalPercent <= 0 && finalTimeSpent <= 0) {
    return events;
  }

  pushEvent(events, "not_started", "lesson_progressed", progress, {
    occurredAt: fallbackAt,
    progressPercent: finalPercent,
    timeSpentSeconds: finalTimeSpent,
  });
  return events;
}

async function main() {
  const uri = requireEnv("MONGODB_URI");
  const dbName = requireEnv("MONGODB_DB_NAME");
  const defaultTenantId = process.env.APP_DEFAULT_TENANT_ID || "public";
  const processAllTenants = hasFlag("--all-tenants");
  const tenantId = readArg("--tenant=") || (processAllTenants ? null : defaultTenantId);
  const dryRun = hasFlag("--dry-run");
  const force = hasFlag("--force");
  const batchSize = Math.max(
    1,
    Math.min(1000, Number.parseInt(readArg("--batch-size=") || "400", 10) || 400)
  );

  const client = new MongoClient(uri);
  await client.connect();

  const summary = {
    scannedProgressRows: 0,
    skippedExistingHistory: 0,
    skippedNoActivity: 0,
    generatedEvents: 0,
    insertedEvents: 0,
    tenantScope: tenantId ?? "all",
    dryRun,
    force,
    batchSize,
  };

  try {
    const db = client.db(dbName);
    const progressCollection = db.collection("progress");
    const progressEventsCollection = db.collection("progress_events");

    const cursor = progressCollection
      .find(tenantId ? { tenantId } : {})
      .sort({ updatedAt: 1, _id: 1 });

    let insertBuffer = [];

    for await (const progress of cursor) {
      summary.scannedProgressRows += 1;

      if (!force) {
        const existing = await progressEventsCollection.findOne(
          {
            tenantId: progress.tenantId,
            userId: progress.userId,
            courseId: progress.courseId,
            lessonId: progress.lessonId,
          },
          { projection: { _id: 1 } }
        );

        if (existing) {
          summary.skippedExistingHistory += 1;
          continue;
        }
      }

      const events = buildBackfillEvents(progress);
      if (events.length === 0) {
        summary.skippedNoActivity += 1;
        continue;
      }

      summary.generatedEvents += events.length;
      if (dryRun) continue;

      insertBuffer.push(...events);
      if (insertBuffer.length >= batchSize) {
        const result = await progressEventsCollection.insertMany(insertBuffer, {
          ordered: false,
        });
        summary.insertedEvents += result.insertedCount;
        insertBuffer = [];
      }
    }

    if (!dryRun && insertBuffer.length > 0) {
      const result = await progressEventsCollection.insertMany(insertBuffer, {
        ordered: false,
      });
      summary.insertedEvents += result.insertedCount;
    }

    console.log("Progress events backfill: OK");
    console.log("Database:", dbName);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.scannedProgressRows === 0) {
      console.log(
        "No progress rows found in this tenant scope. Try --all-tenants or --tenant=<tenant-id> if needed."
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Progress events backfill: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
