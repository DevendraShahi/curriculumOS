const { MongoClient } = require("mongodb");
const { curriculumSeedSlugs } = require("./curriculum-seed-data.cjs");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = requireEnv("MONGODB_DB_NAME");
const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";

if (!process.argv.includes("--confirm")) {
  console.error(
    "Reset aborted. Run with --confirm to delete seeded curriculum data."
  );
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    const courses = await db
      .collection("courses")
      .find({ tenantId, slug: { $in: curriculumSeedSlugs } })
      .project({ _id: 1 })
      .toArray();

    const courseIds = courses.map((item) => item._id);
    const modules = await db
      .collection("modules")
      .find({ tenantId, courseId: { $in: courseIds } })
      .project({ _id: 1 })
      .toArray();
    const moduleIds = modules.map((item) => item._id);

    const [
      deletedProgress,
      deletedProgressEvents,
      deletedEnrollments,
      deletedCertificates,
      deletedLessons,
      deletedProjects,
      deletedProjectSubmissions,
      deletedQuizzes,
      deletedQuizAttempts,
      deletedModules,
      deletedCourses,
    ] = await Promise.all([
      db.collection("progress").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("progress_events").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("enrollments").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("certificates").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("lessons").deleteMany({
        tenantId,
        $or: [{ courseId: { $in: courseIds } }, { moduleId: { $in: moduleIds } }],
      }),
      db.collection("projects").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("project_submissions").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("quizzes").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("quiz_attempts").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("modules").deleteMany({ tenantId, courseId: { $in: courseIds } }),
      db.collection("courses").deleteMany({ tenantId, slug: { $in: curriculumSeedSlugs } }),
    ]);

    console.log("Curriculum reset: OK");
    console.log("Database:", dbName);
    console.log("Tenant:", tenantId);
    console.log(
      JSON.stringify(
        {
          deletedProgress: deletedProgress.deletedCount,
          deletedProgressEvents: deletedProgressEvents.deletedCount,
          deletedEnrollments: deletedEnrollments.deletedCount,
          deletedCertificates: deletedCertificates.deletedCount,
          deletedLessons: deletedLessons.deletedCount,
          deletedProjects: deletedProjects.deletedCount,
          deletedProjectSubmissions: deletedProjectSubmissions.deletedCount,
          deletedQuizzes: deletedQuizzes.deletedCount,
          deletedQuizAttempts: deletedQuizAttempts.deletedCount,
          deletedModules: deletedModules.deletedCount,
          deletedCourses: deletedCourses.deletedCount,
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
  console.error("Curriculum reset: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
