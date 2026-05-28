const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function resolveExerciseFilePath(payloadDir, lesson) {
  const candidates = [];

  if (lesson.slug) {
    candidates.push(`${lesson.slug}-exercises.json`);
  }

  if (lesson.id) {
    const idMatch = String(lesson.id).match(/^(lesson-\d{2})-/i);
    if (idMatch) {
      candidates.push(`${idMatch[1].toLowerCase()}-exercises.json`);
    }
  }

  if (typeof lesson.order === "number" && Number.isFinite(lesson.order)) {
    const orderLabel = String(lesson.order).padStart(2, "0");
    candidates.push(`lesson-${orderLabel}-exercises.json`);
  }

  for (const filename of candidates) {
    const candidatePath = path.join(payloadDir, filename);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function resolveResourceFilePath(payloadDir, lesson) {
  const candidates = [];

  if (lesson.slug) {
    candidates.push(`${lesson.slug}-resources.json`);
  }

  if (lesson.id) {
    const idMatch = String(lesson.id).match(/^(lesson-\d{2})-/i);
    if (idMatch) {
      candidates.push(`${idMatch[1].toLowerCase()}-resources.json`);
    }
  }

  if (typeof lesson.order === "number" && Number.isFinite(lesson.order)) {
    const orderLabel = String(lesson.order).padStart(2, "0");
    candidates.push(`lesson-${orderLabel}-resources.json`);
  }

  const searchRoots = [
    payloadDir,
    path.resolve(__dirname, "../../../docs/html"),
    path.resolve(__dirname, "../../../docs/css"),
  ];

  for (const rootDir of searchRoots) {
    for (const filename of candidates) {
      const candidatePath = path.join(rootDir, filename);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function normalizeRecord(record, base) {
  return {
    ...record,
    ...base,
  };
}

async function upsertMany(collection, items, keyField, transform, { dryRun = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, plannedOps: 0 };

  const records = items.map((item) => {
    const r = transform ? transform(item) : item;
    const key = r[keyField];
    if (!key) throw new Error(`Missing key field '${keyField}' for collection '${collection.collectionName}'`);
    return r;
  });

  if (dryRun) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, plannedOps: records.length };
  }

  const ops = records.map((record) => ({
    updateOne: {
      filter: { [keyField]: record[keyField], tenantId: record.tenantId },
      update: {
        $set: record,
        $setOnInsert: { createdAt: record.createdAt },
      },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(ops, { ordered: false });
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: result.upsertedCount,
    plannedOps: records.length,
  };
}

async function main() {
  const uri = requireEnv('MONGODB_URI');
  const dbName = requireEnv('MONGODB_DB_NAME');
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';

  const dryRun = process.argv.includes('--dry-run');
  const payloadArg = process.argv.find((a) => a.endsWith('.json'));
    const payloadPath = payloadArg
      ? path.resolve(payloadArg)
      : path.resolve(__dirname, '../../../docs/courses/web-development/seed-ready-html-course-v1.json');

  if (!fs.existsSync(payloadPath)) {
    throw new Error(`Payload not found: ${payloadPath}`);
  }

  const payload = readJson(payloadPath);
   const now = new Date();

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
     };

    const course = normalizeRecord(payload.course, base);

    let courseResult;
    if (dryRun) {
      courseResult = { plannedOps: 1 };
    } else {
      courseResult = await collections.courses.updateOne(
        { slug: course.slug, tenantId },
        {
          $set: course,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
    }

    const courseDoc = dryRun ? { _id: null } : await collections.courses.findOne({ slug: course.slug, tenantId }, { projection: { _id: 1, slug: 1 } });

    const courseIdValue = courseDoc?._id || null;

    const payloadDir = path.dirname(payloadPath);

    const moduleResults = await upsertMany(collections.modules, payload.modules || [], 'id', (m) => normalizeRecord({ ...m, courseId: courseIdValue, slug: m.slug || m.id }, base), { dryRun });
    
    const lessonResults = await upsertMany(collections.lessons, payload.lessons || [], 'id', (l) => {
      const durationMinutes = l.duration ? parseInt(String(l.duration).replace(/\D/g, ''), 10) : 0;
      
      let exercises = [];
      const exercisePath = resolveExerciseFilePath(payloadDir, l);
      if (exercisePath) {
        try {
          const exPayload = readJson(exercisePath);
          if (exPayload && Array.isArray(exPayload.exercises)) {
            exercises = exPayload.exercises;
          }
        } catch (e) {
          console.warn(`[WARNING] Failed to parse exercises for ${l.slug}:`, e.message);
        }
      }

      let resources;
      const resourcePath = resolveResourceFilePath(payloadDir, l);
      if (resourcePath) {
        try {
          const resourcePayload = readJson(resourcePath);
          if (resourcePayload && typeof resourcePayload === "object") {
            resources = resourcePayload;
          }
        } catch (e) {
          console.warn(`[WARNING] Failed to parse resources for ${l.slug}:`, e.message);
        }
      }

      return normalizeRecord({ 
        ...l, 
        courseId: courseIdValue, 
        slug: l.slug || l.id,
        durationMinutes,
        outcomes: l.outcomes || [],
        exercises: exercises.length > 0 ? exercises : undefined,
        resources: resources && typeof resources === "object" ? resources : undefined,
      }, base);
    }, { dryRun });

    const quizResults = await upsertMany(collections.quizzes, payload.quizzes || [], 'id', (q) => {
      const questions = (q.questions || []).map(question => ({
        ...question,
        prompt: question.prompt || question.question,
        answerIndex: question.answerIndex !== undefined ? question.answerIndex : question.correctOption
      }));
      return normalizeRecord({ ...q, courseId: courseIdValue, slug: q.slug || q.id, questions }, base);
    }, { dryRun });
    const projectResults = await upsertMany(collections.projects, payload.projects || [], 'id', (p) => normalizeRecord({ ...p, courseId: courseIdValue, slug: p.slug || p.id, lessonId: p.lessonId || `project:${p.id}` }, base), { dryRun });
    const rubricResults = await upsertMany(collections.rubrics, payload.rubrics || [], 'id', (r) => normalizeRecord({ ...r, courseId: courseIdValue, slug: r.slug || r.id }, base), { dryRun });
    const capstoneResults = await upsertMany(collections.capstones, payload.capstones || [], 'id', (c) => normalizeRecord({ ...c, courseId: courseIdValue, slug: c.slug || c.id }, base), { dryRun });

    const output = {
      mode: dryRun ? 'dry-run' : 'apply',
      tenantId,
      dbName,
      payloadPath,
      summary: payload.summary,
      results: {
        course: dryRun ? courseResult : {
          matchedCount: courseResult.matchedCount,
          modifiedCount: courseResult.modifiedCount,
          upsertedCount: courseResult.upsertedCount,
        },
        modules: moduleResults,
        lessons: lessonResults,
        quizzes: quizResults,
        projects: projectResults,
        rubrics: rubricResults,
        capstones: capstoneResults,
      },
    };

    console.log('[import-course-seed] SUCCESS');
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('[import-course-seed] FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
