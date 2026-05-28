#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function normalizeResources(raw) {
  const record = raw && typeof raw === "object" ? raw : {};
  const evalRaw =
    record.evaluationNotes && typeof record.evaluationNotes === "object"
      ? record.evaluationNotes
      : null;

  const externalResources = Array.isArray(record.externalResources)
    ? record.externalResources
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const title = typeof item.title === "string" ? item.title.trim() : "";
          const url = typeof item.url === "string" ? item.url.trim() : "";
          const description = typeof item.description === "string" ? item.description.trim() : "";
          if (!title && !url && !description) return null;
          return {
            ...(title ? { title } : {}),
            ...(url ? { url } : {}),
            ...(description ? { description } : {}),
          };
        })
        .filter(Boolean)
    : [];

  return {
    teachingFocus: normalizeStringList(record.teachingFocus),
    teachingAids: normalizeStringList(record.teachingAids),
    resourcePrompts: normalizeStringList(record.resourcePrompts),
    learnerReference: normalizeStringList(record.learnerReference),
    instructorNotes: normalizeStringList(record.instructorNotes),
    externalResources,
    ...(evalRaw
      ? {
          evaluationNotes: {
            scoringDimensions: normalizeStringList(evalRaw.scoringDimensions),
            atRisk: typeof evalRaw.atRisk === "string" ? evalRaw.atRisk.trim() : "",
            competent: typeof evalRaw.competent === "string" ? evalRaw.competent.trim() : "",
            excellent: typeof evalRaw.excellent === "string" ? evalRaw.excellent.trim() : "",
          },
        }
      : {}),
  };
}

function collectResourceFiles(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir)
    .filter(
      (name) =>
        /^lesson-\d{2}-resources\.json$/i.test(name) ||
        /^lesson-\d{2}-.+-resources\.json$/i.test(name)
    )
    .map((name) => path.join(baseDir, name));
}

async function main() {
  const uri = requireEnv("MONGODB_URI");
  const dbName = requireEnv("MONGODB_DB_NAME");
  const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";
  const now = new Date();

  const roots = [
    path.resolve(__dirname, "../../../docs/html"),
    path.resolve(__dirname, "../../../docs/css"),
  ];
  const files = roots.flatMap(collectResourceFiles);

  if (files.length === 0) {
    console.log("[backfill-lesson-resources] No resource files found.");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const lessons = db.collection("lessons");
    let matched = 0;
    let modified = 0;

    for (const filePath of files) {
      const payload = readJson(filePath);
      const lessonId =
        typeof payload.lessonId === "string" && payload.lessonId.trim()
          ? payload.lessonId.trim()
          : null;
      const lessonSlug =
        typeof payload.lessonSlug === "string" && payload.lessonSlug.trim()
          ? payload.lessonSlug.trim()
          : null;

      if (!lessonId && !lessonSlug) {
        console.warn(`[skip] Missing lessonId/lessonSlug in ${path.basename(filePath)}`);
        continue;
      }

      const filter = {
        tenantId,
        $or: [
          ...(lessonId ? [{ id: lessonId }] : []),
          ...(lessonSlug ? [{ slug: lessonSlug }] : []),
        ],
      };

      const resources = normalizeResources(payload);
      const result = await lessons.updateMany(filter, {
        $set: {
          resources,
          updatedAt: now,
        },
      });

      matched += result.matchedCount;
      modified += result.modifiedCount;
    }

    console.log("[backfill-lesson-resources] SUCCESS");
    console.log(
      JSON.stringify(
        {
          tenantId,
          dbName,
          files: files.length,
          matched,
          modified,
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
  console.error("[backfill-lesson-resources] FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
