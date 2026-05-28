const { MongoClient } = require('mongodb');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

(async () => {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';
  const slug = 'html-foundations-and-production-patterns';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const lessonsCount = await db.collection('lessons').countDocuments({ tenantId, courseSlug: slug });
  const modulesCount = await db.collection('modules').countDocuments({ tenantId, courseSlug: slug });
  const lessons = await db.collection('lessons').find({ tenantId, courseSlug: slug }).toArray();

  const totalMinutes = lessons.reduce((sum, l) => {
    if (typeof l.durationMinutes === 'number' && !Number.isNaN(l.durationMinutes)) return sum + l.durationMinutes;
    const m = /([0-9]+)m/.exec(l.duration || '');
    return sum + (m ? Number(m[1]) : 15);
  }, 0);

  const summary = 'Build valid, semantic, accessible HTML and production-ready page structures.';
  const description = 'A complete beginner-to-production HTML curriculum covering semantics, forms, accessibility, SEO, debugging, and capstone delivery.';

  const update = {
    title: 'HTML Foundations and Production Patterns',
    summary,
    description,
    category: 'WEB DEVELOPMENT',
    level: 'beginner',
    tags: ['html', 'semantic-html', 'accessibility', 'seo', 'forms'],
    status: 'published',
    visibility: 'public',
    modulesCount,
    lessonsCount,
    durationMinutes: totalMinutes,
    publishedAt: new Date(),
    updatedAt: new Date(),
    isPublished: true,
  };

  const result = await db.collection('courses').updateOne(
    { tenantId, slug },
    { $set: update },
    { upsert: false }
  );

  console.log('patched', { matched: result.matchedCount, modified: result.modifiedCount, modulesCount, lessonsCount, durationMinutes: totalMinutes });

  const course = await db.collection('courses').findOne({ tenantId, slug });
  console.log('course_status', {
    status: course?.status,
    visibility: course?.visibility,
    category: course?.category,
    modulesCount: course?.modulesCount,
    lessonsCount: course?.lessonsCount,
    durationMinutes: course?.durationMinutes,
  });

  await client.close();
})();
