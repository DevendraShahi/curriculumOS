import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";

async function run() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(dbName);
  
  const lessonsCol = db.collection("lessons");
  const allLessons = await lessonsCol.find({}).toArray();
  console.log(`Total lessons in DB: ${allLessons.length}`);
  for (const l of allLessons) {
      console.log(`Lesson: ${l.slug}, courseSlug: ${l.courseSlug}, moduleSlug: ${l.moduleSlug}, courseId: ${l.courseId}, moduleId: ${l.moduleId}`);
  }

  await client.close();
  process.exit(0);
}

run();
