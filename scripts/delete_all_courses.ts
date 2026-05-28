import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri || !dbName) {
  console.error("MONGODB_URI or MONGODB_DB_NAME not found");
  process.exit(1);
}

const COLLECTIONS = [
  "courses",
  "modules",
  "lessons",
  "projects",
  "project_submissions",
  "rubrics",
  "capstones",
  "quizzes",
  "quiz_attempts",
  "enrollments",
  "progress",
  "progress_events",
];

async function run() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(dbName);
  
  console.log(`Connected to MongoDB directly. Database: ${dbName}`);

  for (const collectionName of COLLECTIONS) {
    try {
      const col = db.collection(collectionName);
      const result = await col.deleteMany({});
      console.log(`Deleted ${result.deletedCount} documents from ${collectionName}`);
    } catch (e) {
      console.error(`Failed to delete ${collectionName}:`, e);
    }
  }

  await client.close();
  console.log("Finished deleting all courses and related content.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error deleting courses:", err);
  process.exit(1);
});
