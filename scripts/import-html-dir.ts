import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const tenantId = process.env.APP_DEFAULT_TENANT_ID || 'public';

if (!uri || !dbName) {
  console.error('MONGODB_URI or MONGODB_DB_NAME not found');
  process.exit(1);
}

const dirPath = '/Users/devendrashahithakuri/Work/curriculum/docs/html';

function readJson(fileName: string) {
  const filePath = path.join(dirPath, fileName);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

function resolveCompanionFileName(
  files: string[],
  lesson: { id?: string; slug?: string; order?: number },
  suffix: "exercises" | "resources"
): string | null {
  const candidates: string[] = [];

  if (lesson.slug) {
    candidates.push(`${lesson.slug}-${suffix}.json`);
  }

  if (lesson.id) {
    const idMatch = String(lesson.id).match(/^(lesson-\d{2})-/i);
    if (idMatch) {
      candidates.push(`${idMatch[1].toLowerCase()}-${suffix}.json`);
    }
  }

  if (typeof lesson.order === "number" && Number.isFinite(lesson.order)) {
    const orderLabel = String(lesson.order).padStart(2, "0");
    candidates.push(`lesson-${orderLabel}-${suffix}.json`);
  }

  for (const name of candidates) {
    if (files.includes(name)) return name;
  }

  return null;
}

async function run() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to MongoDB. Database: ${dbName}`);

  const collections = {
    courses: db.collection('courses'),
    modules: db.collection('modules'),
    lessons: db.collection('lessons'),
    quizzes: db.collection('quizzes'),
    projects: db.collection('projects'),
    rubrics: db.collection('rubrics'),
    capstones: db.collection('capstones'),
  };

  const now = new Date();

  // 1. Course
  const coursePayload = readJson('course-meta.json');
  if (!coursePayload) throw new Error("course-meta.json not found");

  const base = {
    tenantId,
    courseSlug: coursePayload.slug,
    contentVersion: '1.0.0',
    source: 'html-directory-seed',
    updatedAt: now,
  };

  const courseDoc = { ...coursePayload, ...base };
  delete courseDoc.schemaVersion;
  delete courseDoc.entityType;

  await collections.courses.updateOne(
    { slug: courseDoc.slug, tenantId },
    {
      $set: courseDoc,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  const courseRecord = await collections.courses.findOne({ slug: courseDoc.slug, tenantId });
  const courseId = courseRecord!._id.toString();
  console.log(`Inserted course ${courseDoc.slug} with ID ${courseId}`);

  // 2. Modules
  const files = fs.readdirSync(dirPath);
  const moduleFiles = files.filter(f => f.startsWith('module-') && f.endsWith('-meta.json')).sort();
  
  const moduleIdMap: Record<string, string> = {};

  for (const modFile of moduleFiles) {
    const modPayload = readJson(modFile);
    if (!modPayload) continue;

    const modDoc = { ...modPayload, courseId, ...base };
    delete modDoc.schemaVersion;
    delete modDoc.entityType;

    await collections.modules.updateOne(
      { slug: modDoc.slug, tenantId },
      {
        $set: modDoc,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    
    const insertedModule = await collections.modules.findOne({ slug: modDoc.slug, tenantId });
    if (insertedModule) {
      const match = modFile.match(/module-(\d+)-/);
      if (match) {
        const numStr = match[1];
        const placeholder = `MODULE_${numStr}_ID_PLACEHOLDER`;
        moduleIdMap[placeholder] = insertedModule._id.toString();
      }
    }
    
    console.log(`Inserted module ${modDoc.slug}`);
  }

  // 3. Lessons
  const lessonFiles = files.filter(f => f.startsWith('lesson-') && !f.includes('-exercises') && !f.includes('-quiz') && !f.includes('-resources'));
  
  for (const lessonFile of lessonFiles) {
    const payload = readJson(lessonFile);
    if (!payload) continue;

    const lessonDoc = { ...payload, courseId, ...base };
    delete lessonDoc.schemaVersion;
    delete lessonDoc.entityType;

    if (lessonDoc.moduleId && moduleIdMap[lessonDoc.moduleId]) {
      lessonDoc.moduleId = moduleIdMap[lessonDoc.moduleId];
    }

    // Attach exercises if any
    const exerciseFile = resolveCompanionFileName(files, lessonDoc, "exercises");
    const exercisesPayload = exerciseFile ? readJson(exerciseFile) : null;
    if (exercisesPayload && exercisesPayload.exercises) {
      lessonDoc.exercises = exercisesPayload.exercises;
    }

    // Attach resources if any
    const resourcesFile = resolveCompanionFileName(files, lessonDoc, "resources");
    const resourcesPayload = resourcesFile ? readJson(resourcesFile) : null;
    if (resourcesPayload && typeof resourcesPayload === "object") {
      lessonDoc.resources = resourcesPayload;
    }

    await collections.lessons.updateOne(
      { slug: lessonDoc.slug || lessonDoc.id, tenantId },
      {
        $set: lessonDoc,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    console.log(`Inserted lesson ${lessonDoc.slug || lessonDoc.id}`);
  }

  // 4. Quizzes
  const quizFiles = files.filter(f => f.includes('-quiz.json'));
  for (const quizFile of quizFiles) {
    const qPayload = readJson(quizFile);
    if (!qPayload) continue;

    const quizDoc = { ...qPayload, courseId, ...base };
    if (quizDoc.moduleId && moduleIdMap[quizDoc.moduleId]) {
      quizDoc.moduleId = moduleIdMap[quizDoc.moduleId];
    }

    if (quizDoc.questions) {
      quizDoc.questions = quizDoc.questions.map((q: any) => ({
        ...q,
        prompt: q.prompt || q.question,
        answerIndex: q.answerIndex !== undefined ? q.answerIndex : q.correctOption
      }));
    }

    await collections.quizzes.updateOne(
      { slug: quizDoc.slug || quizDoc.id, tenantId },
      {
        $set: quizDoc,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    console.log(`Inserted quiz ${quizDoc.slug || quizDoc.id}`);
  }

  console.log("Finished importing all HTML course content.");
  await client.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
