import { MongoClient, ObjectId } from "mongodb";
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
  
  const modulesCol = db.collection("modules");
  const lessonsCol = db.collection("lessons");

  const course = await db.collection("courses").findOne({ slug: "html-foundations-and-production-patterns", tenantId });
  const courseId = course!._id;

  const modules = await modulesCol.find({ courseId, tenantId }).toArray();
  const placeholderMap: Record<string, ObjectId> = {
    "MODULE_01_ID_PLACEHOLDER": modules.find(m => m.slug === "module-01-foundations")!._id,
    "MODULE_02_ID_PLACEHOLDER": modules.find(m => m.slug === "module-02-media-tables-and-forms")!._id,
    "MODULE_03_ID_PLACEHOLDER": modules.find(m => m.slug === "module-03-accessibility-metadata-and-html-quality")!._id,
    "MODULE_04_ID_PLACEHOLDER": modules.find(m => m.slug === "module-04-production-patterns-and-capstone-build")!._id,
  };

  const lessons = await lessonsCol.find({ courseSlug: "html-foundations-and-production-patterns", tenantId }).toArray();
  let updatedLessons = 0;
  for (const l of lessons) {
    if (typeof l.moduleId === "string" && l.moduleId.includes("PLACEHOLDER")) {
      const mId = placeholderMap[l.moduleId];
      if (mId) {
        await lessonsCol.updateOne(
          { _id: l._id },
          { $set: { moduleId: mId } }
        );
        updatedLessons++;
      }
    }
  }

  console.log(`Updated ${updatedLessons} lessons that had placeholder moduleId.`);

  await client.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
