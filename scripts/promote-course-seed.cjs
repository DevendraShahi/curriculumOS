const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function hashComparable(obj, excludeKeys = []) {
  const clone = JSON.parse(JSON.stringify(obj));
  for (const k of excludeKeys) delete clone[k];
  return stableStringify(clone);
}

async function indexExisting(collection, keyField, tenantId, keys) {
  const cursor = collection.find({ tenantId, [keyField]: { $in: keys } });
  const docs = await cursor.toArray();
  const map = new Map();
  for (const d of docs) map.set(d[keyField], d);
  return map;
}

function diffRecords(incoming, existingMap, keyField, compareExclude = []) {
  const create = [];
  const update = [];
  const unchanged = [];

  for (const item of incoming) {
    const key = item[keyField];
    const existing = existingMap.get(key);
    if (!existing) {
      create.push(key);
      continue;
    }

    const a = hashComparable(item, compareExclude);
    const b = hashComparable(existing, compareExclude.concat(['_id']));
    if (a === b) unchanged.push(key);
    else update.push(key);
  }

  return { create, update, unchanged };
}

async function main() {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');

  if (!dryRun && !apply) {
    throw new Error('Specify --dry-run or --apply');
  }

  const payloadArg = process.argv.find((a) => a.endsWith('.json'));
  const payloadPath = payloadArg
    ? path.resolve(payloadArg)
    : path.resolve(__dirname, '../../docs/courses/web-development/seed-ready-html-course-v1.json');

  if (!fs.existsSync(payloadPath)) throw new Error(`Payload not found: ${payloadPath}`);

  const payload = readJson(payloadPath);
  const now = new Date().toISOString();

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const collections = {
      courses: db.collection('courses'),
      modules: db.collection('modules'),
      lessons: db.collection('lessons'),
      quizzes: db.collection('quizzes'),
      projects: db.collection('projects'),
      rubrics: db.collection('rubrics'),
      capstones: db.collection('capstones'),
    };

    const base = {
      tenantId,
      track: payload.track,
      courseSlug: payload.course.slug,
      contentVersion: payload.course.version || '1.0.0',
      source: 'seed-ready-html-course-v1',
      updatedAt: now,
      createdAt: now,
    };

    const lessonById = new Map((payload.lessons || []).map((l) => [l.id, l]));

    const incoming = {
      courses: [{ ...payload.course, ...base }],
      modules: (payload.modules || []).map((x) => ({
        ...x,
        ...base,
        courseId: payload.course.slug,
        isPublished: true,
      })),
      lessons: (payload.lessons || []).map((x) => ({
        ...x,
        ...base,
        courseId: payload.course.slug,
        isPublished: true,
      })),
      quizzes: (payload.quizzes || []).map((x, idx) => {
        const lesson = lessonById.get(x.lessonId) || null;
        return {
          ...x,
          ...base,
          courseId: payload.course.slug,
          slug: x.slug || x.id,
          title: x.title || `Quiz ${idx + 1}`,
          lessonId: x.lessonId || lesson?.id || null,
          moduleId: x.moduleId || lesson?.moduleId || null,
          order: Number.isInteger(x.order) ? x.order : idx + 1,
          isPublished: true,
          passingScore: typeof x.passingScore === 'number' ? x.passingScore : 70,
        };
      }),
      projects: (payload.projects || []).map((x, idx) => {
        const moduleLessons = (payload.lessons || [])
          .filter((l) => l.moduleId === x.moduleId)
          .sort((a, b) => (a.order || 999) - (b.order || 999));
        const linkedLessonId = x.lessonId || (moduleLessons[0] ? moduleLessons[0].id : null);
        return {
          ...x,
          ...base,
          courseId: payload.course.slug,
          slug: x.slug || x.id,
          lessonId: linkedLessonId || `project:${x.id}`,
          moduleId: x.moduleId || (moduleLessons[0] ? moduleLessons[0].moduleId : null),
          order: Number.isInteger(x.order) ? x.order : idx + 1,
          isPublished: true,
        };
      }),
      rubrics: (payload.rubrics || []).map((x) => ({
        ...x,
        ...base,
        courseId: payload.course.slug,
      })),
      capstones: (payload.capstones || []).map((x, idx) => ({
        ...x,
        ...base,
        courseId: payload.course.slug,
        slug: x.slug || x.id,
        order: Number.isInteger(x.order) ? x.order : idx + 1,
        isPublished: true,
      })),
    };

    const keys = {
      courses: 'slug',
      modules: 'id',
      lessons: 'id',
      quizzes: 'id',
      projects: 'id',
      rubrics: 'id',
      capstones: 'id',
    };

    const compareExclude = ['updatedAt', 'createdAt', 'source'];

    const existingMaps = {};
    const diff = {};

    for (const name of Object.keys(incoming)) {
      const keyField = keys[name];
      const ids = incoming[name].map((x) => x[keyField]);
      existingMaps[name] = await indexExisting(collections[name], keyField, tenantId, ids);
      diff[name] = diffRecords(incoming[name], existingMaps[name], keyField, compareExclude);
    }

    const promotedCourseDoc = await collections.courses.findOne({ slug: payload.course.slug, tenantId }, { projection: { _id: 1 } });
    const promotedCourseId = promotedCourseDoc?._id || null;

    // Attach courseId for child records before diff/apply
    for (const key of ['modules','lessons','quizzes','projects','rubrics','capstones']) {
      incoming[key] = incoming[key].map((r) => ({ ...r, courseId: promotedCourseId }));
    }

    const report = {
      mode: dryRun ? 'dry-run' : 'apply',
      tenantId,
      dbName,
      payloadPath,
      contentVersion: payload.course.version,
      summary: payload.summary,
      diff,
      totals: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, {
        create: v.create.length,
        update: v.update.length,
        unchanged: v.unchanged.length,
      }])),
    };

    const reportPath = path.resolve(__dirname, '../../../docs/courses/web-development/course-promotion-diff-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (apply) {
      for (const name of Object.keys(incoming)) {
        const keyField = keys[name];
        const coll = collections[name];
        const rows = incoming[name];
        if (!rows.length) continue;

        const ops = rows.map((row) => {
          const { createdAt, ...rest } = row;
          return {
            updateOne: {
              filter: { [keyField]: row[keyField], tenantId },
              update: {
                $set: rest,
                $setOnInsert: { createdAt: createdAt || now },
              },
              upsert: true,
            },
          };
        });

        await coll.bulkWrite(ops, { ordered: false });
      }
    }

    console.log('[promote-course-seed] SUCCESS');
    console.log(JSON.stringify(report, null, 2));
    console.log(`Diff report written: ${reportPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('[promote-course-seed] FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
