const { MongoClient, ObjectId } = require("mongodb");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readArg(prefix) {
  const found = process.argv.find((value) => value.startsWith(prefix));
  if (!found) return undefined;
  const value = found.slice(prefix.length).trim();
  return value.length > 0 ? value : undefined;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function utcDaysAgo(days, hour, minute) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function resolveUser(db, tenantId, selector) {
  const users = db.collection("users");
  if (!selector) {
    return users.findOne({ tenantId }, { sort: { updatedAt: -1, createdAt: -1 } });
  }

  const normalized = selector.trim();
  const candidates = [
    { tenantId, clerkUserId: normalized },
    { tenantId, email: normalized },
    { tenantId, emailLower: normalized.toLowerCase() },
  ];
  if (ObjectId.isValid(normalized)) {
    candidates.push({ tenantId, _id: new ObjectId(normalized) });
  }

  for (const query of candidates) {
    const match = await users.findOne(query);
    if (match) return match;
  }

  return null;
}

async function resolveCourse(db, tenantId, selector) {
  const courses = db.collection("courses");
  if (!selector) {
    return courses.findOne(
      { tenantId, status: "published" },
      { sort: { updatedAt: -1, createdAt: -1 } }
    );
  }

  const normalized = selector.trim();
  if (ObjectId.isValid(normalized)) {
    const byId = await courses.findOne({
      tenantId,
      _id: new ObjectId(normalized),
    });
    if (byId) return byId;
  }

  return courses.findOne({
    tenantId,
    slug: normalized,
  });
}

function makeProgressEvent(params) {
  const now = new Date();
  const progressDelta = params.progressPercent - params.previousProgressPercent;
  const timeSpentDelta = params.timeSpentSeconds - params.previousTimeSpentSeconds;

  return {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    courseId: params.courseId,
    lessonId: params.lessonId,
    moduleId: params.moduleId,
    enrollmentId: params.enrollmentId,
    eventType: params.eventType,
    state: params.state,
    progressPercent: params.progressPercent,
    progressDelta,
    timeSpentSeconds: params.timeSpentSeconds,
    timeSpentDelta,
    occurredAt: params.occurredAt,
    metadata: { source: "backfill_progress_snapshot_v1" },
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const uri = requireEnv("MONGODB_URI");
  const dbName = requireEnv("MONGODB_DB_NAME");
  const tenantId =
    readArg("--tenant=") || process.env.APP_DEFAULT_TENANT_ID || "public";
  const userSelector = readArg("--user=");
  const courseSelector = readArg("--course=");
  const completedTarget = Math.max(1, toInt(readArg("--completed="), 4));
  const inProgressTarget = Math.max(1, toInt(readArg("--in-progress="), 2));
  const dryRun = process.argv.includes("--dry-run");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const user = await resolveUser(db, tenantId, userSelector);
    if (!user) throw new Error(`No user found for tenant "${tenantId}"`);

    const course = await resolveCourse(db, tenantId, courseSelector);
    if (!course) throw new Error(`No course found for tenant "${tenantId}"`);

    const modules = await db
      .collection("modules")
      .find({ tenantId, courseId: course._id, isPublished: true })
      .project({ _id: 1, order: 1, title: 1 })
      .sort({ order: 1 })
      .toArray();
    const moduleOrder = new Map(
      modules.map((module, index) => [module._id.toString(), module.order ?? index + 1])
    );

    const lessons = await db
      .collection("lessons")
      .find({ tenantId, courseId: course._id, isPublished: true })
      .project({ _id: 1, moduleId: 1, order: 1, title: 1 })
      .toArray();

    const orderedLessons = lessons
      .slice()
      .sort((a, b) => {
        const moduleDelta =
          (moduleOrder.get(a.moduleId.toString()) ?? 0) -
          (moduleOrder.get(b.moduleId.toString()) ?? 0);
        if (moduleDelta !== 0) return moduleDelta;
        return (a.order ?? 0) - (b.order ?? 0);
      });

    if (orderedLessons.length === 0) {
      throw new Error(`No published lessons found in course "${course.slug}"`);
    }

    const progressCollection = db.collection("progress");
    const eventsCollection = db.collection("progress_events");
    const enrollmentsCollection = db.collection("enrollments");

    const existingProgress = await progressCollection
      .find({
        tenantId,
        userId: user._id,
        courseId: course._id,
      })
      .project({ lessonId: 1 })
      .toArray();
    const existingLessonIdSet = new Set(
      existingProgress.map((row) => String(row.lessonId))
    );

    const availableLessons = orderedLessons.filter(
      (lesson) => !existingLessonIdSet.has(lesson._id.toString())
    );

    const completedCount = Math.min(completedTarget, availableLessons.length);
    const inProgressCount = Math.min(
      inProgressTarget,
      Math.max(0, availableLessons.length - completedCount)
    );
    const selectedCompleted = availableLessons.slice(0, completedCount);
    const selectedInProgress = availableLessons.slice(
      completedCount,
      completedCount + inProgressCount
    );

    if (selectedCompleted.length === 0 && selectedInProgress.length === 0) {
      console.log("Seed progress activity: nothing to insert (all lessons already have progress).");
      return;
    }

    const now = new Date();
    let enrollment = await enrollmentsCollection.findOne({
      tenantId,
      userId: user._id,
      courseId: course._id,
    });

    if (!enrollment && !dryRun) {
      const enrollmentDoc = {
        _id: new ObjectId(),
        tenantId,
        userId: user._id,
        courseId: course._id,
        status: "active",
        enrolledAt: now,
        progressPercent: 0,
        source: "direct",
        createdAt: now,
        updatedAt: now,
      };
      await enrollmentsCollection.insertOne(enrollmentDoc);
      enrollment = enrollmentDoc;
    }

    const progressDocs = [];
    const events = [];
    let dayCursor = selectedCompleted.length + selectedInProgress.length + 1;
    let totalTimeCounter = 0;

    for (const lesson of selectedCompleted) {
      const lessonId = lesson._id.toString();
      const moduleId = lesson.moduleId.toString();
      const startedAt = utcDaysAgo(dayCursor, 14, 10);
      const completedAt = utcDaysAgo(dayCursor - 1, 20, 20);
      totalTimeCounter += 1800;

      const progressDoc = {
        _id: new ObjectId(),
        tenantId,
        userId: user._id,
        courseId: course._id,
        moduleId,
        lessonId,
        enrollmentId: enrollment?._id ?? null,
        state: "completed",
        progressPercent: 100,
        startedAt,
        completedAt,
        lastActivityAt: completedAt,
        timeSpentSeconds: totalTimeCounter,
        createdAt: startedAt,
        updatedAt: completedAt,
      };
      progressDocs.push(progressDoc);

      events.push(
        makeProgressEvent({
          tenantId,
          userId: user._id,
          courseId: course._id,
          moduleId,
          lessonId,
          enrollmentId: enrollment?._id ?? null,
          eventType: "lesson_started",
          state: "in_progress",
          progressPercent: 1,
          previousProgressPercent: 0,
          timeSpentSeconds: 0,
          previousTimeSpentSeconds: 0,
          occurredAt: startedAt,
        }),
        makeProgressEvent({
          tenantId,
          userId: user._id,
          courseId: course._id,
          moduleId,
          lessonId,
          enrollmentId: enrollment?._id ?? null,
          eventType: "lesson_completed",
          state: "completed",
          progressPercent: 100,
          previousProgressPercent: 1,
          timeSpentSeconds: totalTimeCounter,
          previousTimeSpentSeconds: 0,
          occurredAt: completedAt,
        })
      );

      dayCursor -= 2;
    }

    for (const [index, lesson] of selectedInProgress.entries()) {
      const lessonId = lesson._id.toString();
      const moduleId = lesson.moduleId.toString();
      const startedAt = utcDaysAgo(Math.max(1, index + 1), 9, 15);
      const progressedAt = utcDaysAgo(Math.max(0, index), 19, 40);
      const progressPercent = clampPercent(35 + index * 20);
      totalTimeCounter += 900;

      const progressDoc = {
        _id: new ObjectId(),
        tenantId,
        userId: user._id,
        courseId: course._id,
        moduleId,
        lessonId,
        enrollmentId: enrollment?._id ?? null,
        state: "in_progress",
        progressPercent,
        startedAt,
        completedAt: null,
        lastActivityAt: progressedAt,
        timeSpentSeconds: totalTimeCounter,
        createdAt: startedAt,
        updatedAt: progressedAt,
      };
      progressDocs.push(progressDoc);

      events.push(
        makeProgressEvent({
          tenantId,
          userId: user._id,
          courseId: course._id,
          moduleId,
          lessonId,
          enrollmentId: enrollment?._id ?? null,
          eventType: "lesson_started",
          state: "in_progress",
          progressPercent: 1,
          previousProgressPercent: 0,
          timeSpentSeconds: 0,
          previousTimeSpentSeconds: 0,
          occurredAt: startedAt,
        }),
        makeProgressEvent({
          tenantId,
          userId: user._id,
          courseId: course._id,
          moduleId,
          lessonId,
          enrollmentId: enrollment?._id ?? null,
          eventType: "lesson_progressed",
          state: "in_progress",
          progressPercent,
          previousProgressPercent: 1,
          timeSpentSeconds: totalTimeCounter,
          previousTimeSpentSeconds: 0,
          occurredAt: progressedAt,
        })
      );
    }

    if (!dryRun) {
      if (progressDocs.length > 0) {
        await progressCollection.insertMany(progressDocs, { ordered: false });
      }
      if (events.length > 0) {
        await eventsCollection.insertMany(events, { ordered: false });
      }

      const [totalLessons, completedLessons] = await Promise.all([
        db.collection("lessons").countDocuments({
          tenantId,
          courseId: course._id,
          isPublished: true,
        }),
        progressCollection.countDocuments({
          tenantId,
          userId: user._id,
          courseId: course._id,
          state: "completed",
        }),
      ]);

      const progressPercent =
        totalLessons > 0 ? clampPercent((completedLessons / totalLessons) * 100) : 0;

      await enrollmentsCollection.updateOne(
        {
          tenantId,
          userId: user._id,
          courseId: course._id,
        },
        {
          $set: {
            status: progressPercent >= 100 ? "completed" : "active",
            progressPercent,
            lastLessonId:
              progressDocs[progressDocs.length - 1]?.lessonId ??
              orderedLessons[0]._id.toString(),
            completedAt: progressPercent >= 100 ? new Date() : null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: new ObjectId(),
            tenantId,
            userId: user._id,
            courseId: course._id,
            enrolledAt: now,
            source: "direct",
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }

    console.log("Seed progress activity: OK");
    console.log(
      JSON.stringify(
        {
          tenantId,
          userId: user._id.toString(),
          userEmail: user.email,
          courseId: course._id.toString(),
          courseSlug: course.slug,
          insertedProgress: progressDocs.length,
          insertedProgressEvents: events.length,
          insertedCompletedLessons: selectedCompleted.length,
          insertedInProgressLessons: selectedInProgress.length,
          dryRun,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Seed progress activity: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
