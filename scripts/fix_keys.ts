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
  
  console.log(`Connected to MongoDB directly. Database: ${dbName}`);

  const coursesCol = db.collection("courses");
  const modulesCol = db.collection("modules");
  const lessonsCol = db.collection("lessons");
  const quizzesCol = db.collection("quizzes");

  const course = await coursesCol.findOne({ slug: "html-foundations-and-production-patterns", tenantId });
  if (!course) {
    console.error("Course not found!");
    process.exit(1);
  }

  const courseId = course._id;
  console.log(`Course _id is ${courseId}`);

  // Update modules courseId
  let res = await modulesCol.updateMany(
    { courseSlug: "html-foundations-and-production-patterns", tenantId },
    { $set: { courseId: courseId } }
  );
  console.log(`Updated courseId on ${res.modifiedCount} modules`);

  // Get all modules to build the moduleSlug -> moduleId map
  const modules = await modulesCol.find({ courseId, tenantId }).toArray();
  const moduleMap: Record<string, ObjectId> = {};
  for (const m of modules) {
    moduleMap[m.slug] = m._id;
  }

  // Update lessons courseId and moduleId
  const lessons = await lessonsCol.find({ courseSlug: "html-foundations-and-production-patterns", tenantId }).toArray();
  let updatedLessons = 0;
  for (const l of lessons) {
    const mId = moduleMap[l.moduleSlug];
    if (mId) {
      await lessonsCol.updateOne(
        { _id: l._id },
        { $set: { courseId: courseId, moduleId: mId } }
      );
      updatedLessons++;
    }
  }
  console.log(`Updated courseId and moduleId on ${updatedLessons} lessons`);

  // Update quizzes courseId and moduleId
  const quizzes = await quizzesCol.find({ courseSlug: "html-foundations-and-production-patterns", tenantId }).toArray();
  let updatedQuizzes = 0;
  for (const q of quizzes) {
    // some quizzes might have moduleSlug, some might not. Let's just set courseId and optionally moduleId
    const mId = q.moduleSlug ? moduleMap[q.moduleSlug] : null;
    const updateDoc: any = { courseId: courseId };
    if (mId) {
      updateDoc.moduleId = mId;
    }
    await quizzesCol.updateOne(
      { _id: q._id },
      { $set: updateDoc }
    );
    updatedQuizzes++;
  }
  console.log(`Updated courseId and moduleId on ${updatedQuizzes} quizzes`);

  await client.close();
  console.log("Finished fixing foreign keys.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error fixing keys:", err);
  process.exit(1);
});
