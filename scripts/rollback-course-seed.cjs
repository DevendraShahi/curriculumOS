const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';
  const dryRun = process.argv.includes('--dry-run');

  const payloadArg = process.argv.find((a) => a.endsWith('.json'));
  const payloadPath = payloadArg
    ? path.resolve(payloadArg)
    : path.resolve(__dirname, '../../docs/courses/web-development/seed-ready-html-course-v1.json');

  if (!fs.existsSync(payloadPath)) throw new Error(`Payload not found: ${payloadPath}`);

  const payload = readJson(payloadPath);
  const moduleIds = (payload.modules || []).map((m) => m.id);
  const lessonIds = (payload.lessons || []).map((l) => l.id);
  const quizIds = (payload.quizzes || []).map((q) => q.id);
  const projectIds = (payload.projects || []).map((p) => p.id);
  const rubricIds = (payload.rubrics || []).map((r) => r.id);
  const capstoneIds = (payload.capstones || []).map((c) => c.id);

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    const plan = {
      courses: { slug: payload.course.slug, tenantId },
      modules: { id: { $in: moduleIds }, tenantId },
      lessons: { id: { $in: lessonIds }, tenantId },
      quizzes: { id: { $in: quizIds }, tenantId },
      projects: { id: { $in: projectIds }, tenantId },
      rubrics: { id: { $in: rubricIds }, tenantId },
      capstones: { id: { $in: capstoneIds }, tenantId },
    };

    if (dryRun) {
      const counts = {
        courses: await db.collection('courses').countDocuments(plan.courses),
        modules: await db.collection('modules').countDocuments(plan.modules),
        lessons: await db.collection('lessons').countDocuments(plan.lessons),
        quizzes: await db.collection('quizzes').countDocuments(plan.quizzes),
        projects: await db.collection('projects').countDocuments(plan.projects),
        rubrics: await db.collection('rubrics').countDocuments(plan.rubrics),
        capstones: await db.collection('capstones').countDocuments(plan.capstones),
      };

      console.log('[rollback-course-seed] DRY RUN');
      console.log(JSON.stringify({ tenantId, dbName, payloadPath, counts }, null, 2));
      return;
    }

    const [
      deletedCapstones,
      deletedRubrics,
      deletedProjects,
      deletedQuizzes,
      deletedLessons,
      deletedModules,
      deletedCourse,
    ] = await Promise.all([
      db.collection('capstones').deleteMany(plan.capstones),
      db.collection('rubrics').deleteMany(plan.rubrics),
      db.collection('projects').deleteMany(plan.projects),
      db.collection('quizzes').deleteMany(plan.quizzes),
      db.collection('lessons').deleteMany(plan.lessons),
      db.collection('modules').deleteMany(plan.modules),
      db.collection('courses').deleteMany(plan.courses),
    ]);

    console.log('[rollback-course-seed] SUCCESS');
    console.log(JSON.stringify({
      tenantId,
      dbName,
      payloadPath,
      deleted: {
        courses: deletedCourse.deletedCount,
        modules: deletedModules.deletedCount,
        lessons: deletedLessons.deletedCount,
        quizzes: deletedQuizzes.deletedCount,
        projects: deletedProjects.deletedCount,
        rubrics: deletedRubrics.deletedCount,
        capstones: deletedCapstones.deletedCount,
      },
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('[rollback-course-seed] FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
