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

  const payloadArg = process.argv.find((a) => a.endsWith('.json'));
  const payloadPath = payloadArg
    ? path.resolve(payloadArg)
    : path.resolve(__dirname, '../../docs/courses/web-development/seed-ready-html-course-v1.json');

  if (!fs.existsSync(payloadPath)) throw new Error(`Payload not found: ${payloadPath}`);
  const payload = readJson(payloadPath);

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    const courseSlug = payload.course.slug;
    const expected = payload.summary;

    const [
      courseCount,
      moduleCount,
      lessonCount,
      quizCount,
      projectCount,
      rubricCount,
      capstoneCount,
      quizzesMissingSlug,
      quizzesMissingCourseId,
      projectsMissingLessonId,
    ] = await Promise.all([
      db.collection('courses').countDocuments({ tenantId, slug: courseSlug }),
      db.collection('modules').countDocuments({ tenantId, courseSlug }),
      db.collection('lessons').countDocuments({ tenantId, courseSlug }),
      db.collection('quizzes').countDocuments({ tenantId, courseSlug }),
      db.collection('projects').countDocuments({ tenantId, courseSlug }),
      db.collection('rubrics').countDocuments({ tenantId, courseSlug }),
      db.collection('capstones').countDocuments({ tenantId, courseSlug }),
      db.collection('quizzes').countDocuments({ tenantId, courseSlug, $or: [{ slug: null }, { slug: { $exists: false } }, { slug: '' }] }),
      db.collection('quizzes').countDocuments({ tenantId, courseSlug, $or: [{ courseId: null }, { courseId: { $exists: false } }] }),
      db.collection('projects').countDocuments({ tenantId, courseSlug, $or: [{ lessonId: null }, { lessonId: { $exists: false } }, { lessonId: '' }] }),
    ]);

    const checks = {
      courseCount,
      moduleCount,
      lessonCount,
      quizCount,
      projectCount,
      rubricCount,
      capstoneCount,
      quizzesMissingSlug,
      quizzesMissingCourseId,
      projectsMissingLessonId,
    };

    const failures = [];
    if (courseCount !== 1) failures.push(`Expected 1 course, found ${courseCount}`);
    if (moduleCount !== expected.moduleCount) failures.push(`Expected moduleCount=${expected.moduleCount}, found ${moduleCount}`);
    if (lessonCount !== expected.lessonCount) failures.push(`Expected lessonCount=${expected.lessonCount}, found ${lessonCount}`);
    if (quizCount !== expected.quizCount) failures.push(`Expected quizCount=${expected.quizCount}, found ${quizCount}`);
    if (projectCount !== expected.projectCount) failures.push(`Expected projectCount=${expected.projectCount}, found ${projectCount}`);
    if (rubricCount !== expected.rubricCount) failures.push(`Expected rubricCount=${expected.rubricCount}, found ${rubricCount}`);
    if (capstoneCount !== expected.capstoneCount) failures.push(`Expected capstoneCount=${expected.capstoneCount}, found ${capstoneCount}`);
    if (quizzesMissingSlug !== 0) failures.push(`quizzesMissingSlug=${quizzesMissingSlug}`);
    if (quizzesMissingCourseId !== 0) failures.push(`quizzesMissingCourseId=${quizzesMissingCourseId}`);
    if (projectsMissingLessonId !== 0) failures.push(`projectsMissingLessonId=${projectsMissingLessonId}`);

    console.log('[verify-course-seed-state] RESULT');
    console.log(JSON.stringify({ tenantId, dbName, courseSlug, checks }, null, 2));

    if (failures.length) {
      console.error('[verify-course-seed-state] FAILED');
      failures.forEach((f) => console.error(`- ${f}`));
      process.exit(1);
    }

    console.log('[verify-course-seed-state] PASSED');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('[verify-course-seed-state] FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
