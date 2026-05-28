import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";

if (!uri || !dbName) {
  console.error("MONGODB_URI or MONGODB_DB_NAME not found");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(dbName);
  
  console.log(`Connected to MongoDB directly. Database: ${dbName}`);

  // Publish all courses
  let res = await db.collection("courses").updateMany(
    { tenantId },
    { $set: { status: "published", visibility: "public" } }
  );
  console.log(`Published ${res.modifiedCount} courses`);

  // Publish all modules
  res = await db.collection("modules").updateMany(
    { tenantId },
    { $set: { isPublished: true, status: "published" } }
  );
  console.log(`Published ${res.modifiedCount} modules`);

  // Publish all lessons
  res = await db.collection("lessons").updateMany(
    { tenantId },
    { $set: { isPublished: true, status: "published" } }
  );
  console.log(`Published ${res.modifiedCount} lessons`);

  // Publish all quizzes
  res = await db.collection("quizzes").updateMany(
    { tenantId },
    { $set: { isPublished: true, status: "published" } }
  );
  console.log(`Published ${res.modifiedCount} quizzes`);

  await client.close();
  console.log("Finished publishing course content.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error publishing course:", err);
  process.exit(1);
});
