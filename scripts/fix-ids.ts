import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function run() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  
  if (!uri || !dbName) {
    console.error('MONGODB_URI or MONGODB_DB_NAME not found');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  
  const modules = await db.collection('modules').find().toArray();
  let modUpdates = 0;
  for (const m of modules) {
    if (typeof m.courseId === 'string' && ObjectId.isValid(m.courseId)) {
      await db.collection('modules').updateOne({ _id: m._id }, { $set: { courseId: new ObjectId(m.courseId) } });
      modUpdates++;
    }
  }
  console.log(`Updated ${modUpdates} modules`);

  const lessons = await db.collection('lessons').find().toArray();
  let lessonUpdates = 0;
  for (const l of lessons) {
    const update: any = {};
    if (typeof l.courseId === 'string' && ObjectId.isValid(l.courseId)) update.courseId = new ObjectId(l.courseId);
    if (typeof l.moduleId === 'string' && ObjectId.isValid(l.moduleId)) update.moduleId = new ObjectId(l.moduleId);
    if (Object.keys(update).length > 0) {
      await db.collection('lessons').updateOne({ _id: l._id }, { $set: update });
      lessonUpdates++;
    }
  }
  console.log(`Updated ${lessonUpdates} lessons`);

  const quizzes = await db.collection('quizzes').find().toArray();
  let quizUpdates = 0;
  for (const q of quizzes) {
    const update: any = {};
    if (typeof q.courseId === 'string' && ObjectId.isValid(q.courseId)) update.courseId = new ObjectId(q.courseId);
    if (typeof q.moduleId === 'string' && ObjectId.isValid(q.moduleId)) update.moduleId = new ObjectId(q.moduleId);
    if (Object.keys(update).length > 0) {
      await db.collection('quizzes').updateOne({ _id: q._id }, { $set: update });
      quizUpdates++;
    }
  }
  console.log(`Updated ${quizUpdates} quizzes`);

  await client.close();
  process.exit(0);
}

run().catch(console.error);
