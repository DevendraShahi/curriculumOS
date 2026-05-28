const { MongoClient } = require('mongodb');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

(async () => {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const slug = 'html-foundations-and-production-patterns';
  const course = await db.collection('courses').findOne({ tenantId, slug });
  const modules = await db.collection('modules').find({ tenantId, courseSlug: slug }).sort({ order: 1 }).toArray();
  const lessons = await db.collection('lessons').find({ tenantId, courseSlug: slug }).sort({ id: 1 }).limit(3).toArray();

  console.log('COURSE_EXISTS', !!course);
  console.log('COURSE_FIELDS', course ? {
    id: course.id,
    slug: course.slug,
    title: course.title,
    category: course.category,
    level: course.level,
    isPublished: course.isPublished,
    durationMinutes: course.durationMinutes,
    modulesCount: course.modulesCount,
    tenantId: course.tenantId,
  } : null);
  console.log('MODULE_COUNT', modules.length);
  console.log('MODULE_SAMPLE', modules[0] ? {
    id: modules[0].id,
    title: modules[0].title,
    slug: modules[0].slug,
    courseId: modules[0].courseId,
    durationMinutes: modules[0].durationMinutes,
    isPublished: modules[0].isPublished,
    order: modules[0].order,
  } : null);
  console.log('LESSON_SAMPLE', lessons[0] ? {
    id: lessons[0].id,
    title: lessons[0].title,
    slug: lessons[0].slug,
    moduleId: lessons[0].moduleId,
    durationMinutes: lessons[0].durationMinutes,
    isPublished: lessons[0].isPublished,
    order: lessons[0].order,
  } : null);

  await client.close();
})();
