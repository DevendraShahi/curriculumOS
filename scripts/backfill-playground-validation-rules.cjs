/* eslint-disable @typescript-eslint/no-require-imports */
const { MongoClient } = require("mongodb");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = requireEnv("MONGODB_DB_NAME");
const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";

function buildRulesFromStarterFiles(starterFiles) {
  if (!Array.isArray(starterFiles)) return [];
  return starterFiles
    .filter((file) => file && typeof file.path === "string" && file.path.trim().length > 0)
    .slice(0, 20)
    .map((file, index) => ({
      id: `starter_file_exists_${index + 1}`,
      label: `File exists: ${file.path.trim()}`,
      type: "file_exists",
      filePath: file.path.trim(),
      required: true,
      caseSensitive: true,
    }));
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const collection = db.collection("playground_templates");

    const cursor = collection.find({
      tenantId,
      $or: [{ validationRules: { $exists: false } }, { validationRules: { $size: 0 } }],
    });

    let scanned = 0;
    let updated = 0;
    while (await cursor.hasNext()) {
      const template = await cursor.next();
      if (!template) continue;
      scanned += 1;

      const rules = buildRulesFromStarterFiles(template.starterFiles);
      if (rules.length === 0) continue;

      const result = await collection.updateOne(
        { _id: template._id, tenantId },
        {
          $set: {
            validationRules: rules,
            updatedAt: new Date(),
          },
        }
      );
      if (result.modifiedCount > 0) {
        updated += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenantId,
          scanned,
          updated,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
