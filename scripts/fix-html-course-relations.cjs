const { MongoClient, ObjectId } = require('mongodb');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

(async () => {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';
  const courseSlug = 'html-foundations-and-production-patterns';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const courses = db.collection('courses');
  const modules = db.collection('modules');
  const lessons = db.collection('lessons');
  const quizzes = db.collection('quizzes');
  const projects = db.collection('projects');

  const course = await courses.findOne({ tenantId, slug: courseSlug });
  if (!course) throw new Error('Course not found');

  const courseId = course._id;

  const moduleDocs = await modules.find({ tenantId, courseSlug }).sort({ order: 1 }).toArray();
  const moduleByLogicalId = new Map(moduleDocs.map(m => [m.id, m]));

  // Normalize modules
  for (const m of moduleDocs) {
    await modules.updateOne(
      { _id: m._id },
      {
        $set: {
          courseId,
          isPublished: true,
          title: m.title || m.slug || m.id,
          slug: m.slug || m.id,
          description: m.description || `Module: ${m.title || m.id}`,
          order: Number.isInteger(m.order) ? m.order : 1,
          updatedAt: new Date(),
        },
      }
    );
  }

  const lessonDocs = await lessons.find({ tenantId, courseSlug }).toArray();

  // Re-link lessons to actual module ObjectIds and normalize fields
  for (const l of lessonDocs) {
    const moduleDoc = moduleByLogicalId.get(l.moduleId) || moduleByLogicalId.get(l.module) || null;
    const moduleIdObj = moduleDoc?._id || null;

    await lessons.updateOne(
      { _id: l._id },
      {
        $set: {
          courseId,
          moduleId: moduleIdObj,
          isPublished: true,
          slug: l.slug || l.id,
          title: l.title || l.slug || l.id,
          summary: l.summary || l.expectedOutput || 'HTML lesson',
          description: l.description || l.expectedOutput || 'HTML lesson',
          contentType: l.contentType || 'text',
          isPreview: l.isPreview ?? true,
          durationMinutes: (() => {
            const m = String(l.duration || '').match(/^(\d+)m$/);
            return m ? Number(m[1]) : 15;
          })(),
          order: Number.isInteger(l.order) ? l.order : 1,
          updatedAt: new Date(),
        },
      }
    );
  }

  // Assign deterministic order per module by filename/id
  const freshLessons = await lessons.find({ tenantId, courseSlug }).toArray();
  const grouped = new Map();
  for (const l of freshLessons) {
    const key = l.moduleId ? l.moduleId.toString() : 'unlinked';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(l);
  }
  for (const [key, arr] of grouped.entries()) {
    arr.sort((a,b)=>String(a.id||a.slug).localeCompare(String(b.id||b.slug)));
    for (let i=0;i<arr.length;i++) {
      await lessons.updateOne({ _id: arr[i]._id }, { $set: { order: i+1 } });
    }
  }

  // Relink quizzes/projects courseId and lessonId with real ObjectIds
  const lessonByLogicalId = new Map((await lessons.find({ tenantId, courseSlug }).toArray()).map(l => [l.id, l]));
  const moduleFirstLesson = new Map();
  for (const l of await lessons.find({ tenantId, courseSlug }).sort({ order: 1 }).toArray()) {
    const k = l.moduleId?.toString();
    if (k && !moduleFirstLesson.has(k)) moduleFirstLesson.set(k, l);
  }

  const moduleDocsFresh = await modules.find({ tenantId, courseSlug }).toArray();
  const moduleObjByLogical = new Map(moduleDocsFresh.map(m => [m.id, m]));

  const quizDocs = await quizzes.find({ tenantId, courseSlug }).toArray();
  for (const q of quizDocs) {
    let lessonObj = null;
    if (q.lessonId && ObjectId.isValid(String(q.lessonId))) {
      lessonObj = await lessons.findOne({ _id: new ObjectId(String(q.lessonId)) });
    }
    if (!lessonObj) {
      // map by moduleId logical
      const moduleDoc = moduleObjByLogical.get(q.moduleId) || null;
      if (moduleDoc) lessonObj = moduleFirstLesson.get(moduleDoc._id.toString()) || null;
    }
    await quizzes.updateOne({ _id: q._id }, {
      $set: {
        courseId,
        lessonId: lessonObj?._id || null,
        moduleId: lessonObj?.moduleId || q.moduleId,
        isPublished: true,
        updatedAt: new Date(),
      }
    });
  }

  const projectDocs = await projects.find({ tenantId, courseSlug }).toArray();
  for (const p of projectDocs) {
    let moduleDoc = moduleObjByLogical.get(p.moduleId) || null;
    const first = moduleDoc ? moduleFirstLesson.get(moduleDoc._id.toString()) : null;
    await projects.updateOne({ _id: p._id }, {
      $set: {
        courseId,
        lessonId: first?._id || p.lessonId || null,
        moduleId: moduleDoc?._id || p.moduleId,
        isPublished: true,
        updatedAt: new Date(),
      }
    });
  }

  // recompute module aggregates
  const finalModules = await modules.find({ tenantId, courseSlug }).toArray();
  let totalLessons = 0;
  let totalDuration = 0;
  for (const m of finalModules) {
    const moduleLessons = await lessons.find({ tenantId, courseId, moduleId: m._id, isPublished: true }).toArray();
    const lessonsCount = moduleLessons.length;
    const durationMinutes = moduleLessons.reduce((s,l)=>s+(l.durationMinutes||0),0);
    totalLessons += lessonsCount;
    totalDuration += durationMinutes;
    await modules.updateOne({ _id: m._id }, { $set: { lessonsCount, durationMinutes } });
  }

  // recompute course aggregates and publish fields
  await courses.updateOne({ _id: courseId }, {
    $set: {
      status: 'published',
      visibility: 'public',
      category: course.category || 'WEB DEVELOPMENT',
      summary: course.summary || 'HTML foundations and production patterns.',
      description: course.description || 'Learn HTML from structure to production-quality patterns.',
      level: course.level || 'beginner',
      tags: Array.isArray(course.tags) && course.tags.length ? course.tags : ['html','web','accessibility','seo'],
      modulesCount: finalModules.length,
      lessonsCount: totalLessons,
      durationMinutes: totalDuration,
      publishedAt: course.publishedAt || new Date(),
      updatedAt: new Date(),
    }
  });

  const checkModules = await modules.countDocuments({ tenantId, courseId, isPublished: true });
  const checkLessons = await lessons.countDocuments({ tenantId, courseId, isPublished: true });
  console.log(JSON.stringify({ ok:true, courseId: String(courseId), modules: checkModules, lessons: checkLessons }, null, 2));

  await client.close();
})();
