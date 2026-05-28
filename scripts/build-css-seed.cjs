#!/usr/bin/env node
/**
 * build-css-seed.cjs
 *
 * Assembles all CSS course JSON files from docs/css/ into a single
 * seed-ready file compatible with import-course-seed.cjs and
 * validate-course-seed.cjs.
 *
 * Usage:
 *   node scripts/build-css-seed.cjs                # build → docs/css/seed-ready-css-course-v1.json
 *   node scripts/build-css-seed.cjs --dry-run      # validate only, no file written
 *   node scripts/build-css-seed.cjs --out <path>   # custom output path
 *
 * Validator contract (validate-course-seed.cjs):
 *   module  : id, slug, title, path, order (integer)
 *   lesson  : id, slug, title, moduleId (→ module.id), duration ("Nm"), language, quizId (→ quiz.id), bodyMarkdown
 *   quiz    : id, moduleId (→ module.id), questions[], questions[].{id,objective,question,explanation,options[],correctOption(int)}
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CSS_DIR    = path.resolve(__dirname, '../../../docs/css');
const OUT_DEFAULT = path.join(CSS_DIR, 'seed-ready-css-course-v1.json');

const DRY_RUN  = process.argv.includes('--dry-run');
const outIdx   = process.argv.indexOf('--out');
const OUT_PATH = outIdx !== -1 ? path.resolve(process.argv[outIdx + 1]) : OUT_DEFAULT;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${e.message}`);
  }
}

function requireJson(filePath) {
  const data = readJson(filePath);
  if (!data) throw new Error(`Required file not found: ${path.basename(filePath)}`);
  return data;
}

/** Extract lesson/quiz number from filename: lesson-03-... → 3 */
function fileNum(filename) {
  const m = filename.match(/(?:lesson|quiz)-(\d+)-/);
  return m ? parseInt(m[1], 10) : null;
}

/** Strip scaffolding-only keys that confuse the importer */
function stripMeta(obj) {
  const out = { ...obj };
  delete out.schemaVersion;
  delete out.entityType;
  return out;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function warn(msg) { console.warn(`  ⚠  ${msg}`); }
function ok(msg)   { console.log(`  ✓  ${msg}`); }

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------
async function build() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   CSS Course Seed Assembler  v2              ║');
  console.log(DRY_RUN
    ? '║   Mode: DRY RUN  (no file written)           ║'
    : '║   Mode: BUILD                                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const errors   = [];
  const warnings = [];

  // ── 1. Course meta ────────────────────────────────────────────────────────
  console.log('── Step 1: Course meta');
  const courseMeta = requireJson(path.join(CSS_DIR, 'course-meta.json'));
  const course     = stripMeta(courseMeta);

  course.id       = course.id       || course.slug;
  course.slug     = course.slug     || 'mastering-css-foundations-to-production-systems';
  course.title    = course.title    || 'Mastering CSS: Foundations to Production Systems';
  course.level    = course.level    || 'beginner';
  course.language = course.language || 'en';
  course.version  = course.version  || '1.0.0';
  course.track    = course.track    || 'web-development';

  ok(`course: ${course.slug}`);

  // ── 2. Modules ────────────────────────────────────────────────────────────
  console.log('\n── Step 2: Modules');
  const moduleFiles = fs.readdirSync(CSS_DIR)
    .filter(f => f.startsWith('module-') && f.endsWith('-meta.json'))
    .sort();

  if (moduleFiles.length === 0) errors.push('No module-*-meta.json files found');

  const modules = [];
  // orderN → module.id (slug)  — used later to resolve lesson/quiz moduleId
  const orderToModuleId = {};

  for (const modFile of moduleFiles) {
    const raw = requireJson(path.join(CSS_DIR, modFile));
    const mod = stripMeta(raw);

    // Derive order from filename if missing
    const match = modFile.match(/module-(\d+)-/);
    if (!mod.order && match) mod.order = parseInt(match[1], 10);

    // Validator requires: id, slug, title, path, order
    mod.id   = mod.slug;   // use slug as the stable id — importer maps this to ObjectId
    mod.path = mod.path || mod.slug;

    if (!mod.slug)  { errors.push(`${modFile}: missing slug`);  continue; }
    if (!mod.title) { errors.push(`${modFile}: missing title`); continue; }

    orderToModuleId[mod.order] = mod.id;
    modules.push(mod);
    ok(`module ${mod.order}: ${mod.id}`);
  }

  // Build placeholder → module.id map (lessons/quizzes store "MODULE_01_ID_PLACEHOLDER")
  const placeholderToModuleId = {};
  modules.forEach(mod => {
    const n = pad2(mod.order);
    placeholderToModuleId[`MODULE_${n}_ID_PLACEHOLDER`] = mod.id;
    // Also handle zero-padded variants
    placeholderToModuleId[`MODULE_0${mod.order}_ID_PLACEHOLDER`] = mod.id;
  });

  // ── 3. Lessons ────────────────────────────────────────────────────────────
  console.log('\n── Step 3: Lessons');
  const lessonMainFiles = fs.readdirSync(CSS_DIR)
    .filter(f => {
      if (!f.startsWith('lesson-') || !f.endsWith('.json')) return false;
      if (f.includes('-exercises') || f.includes('-quiz') || f.includes('-resources')) return false;
      return true;
    })
    .sort();

  if (lessonMainFiles.length === 0) errors.push('No lesson JSON files found');

  const lessons    = [];
  const lessonNums = new Set();

  for (const lFile of lessonMainFiles) {
    const num = fileNum(lFile);
    if (!num) { warn(`Cannot extract lesson number from: ${lFile}`); continue; }
    if (lessonNums.has(num)) { errors.push(`Duplicate lesson number ${num}: ${lFile}`); continue; }
    lessonNums.add(num);

    const raw    = requireJson(path.join(CSS_DIR, lFile));
    const lesson = stripMeta(raw);

    // ── Resolve moduleId ───────────────────────────────────────────────────
    // Source files have: "moduleId": "MODULE_01_ID_PLACEHOLDER"
    // We need it to equal module.id (= module slug)
    const rawModuleId = String(lesson.moduleId || lesson.moduleSlug || '');
    if (rawModuleId.includes('PLACEHOLDER')) {
      const resolved = placeholderToModuleId[rawModuleId];
      if (resolved) {
        lesson.moduleId = resolved;
      } else {
        // Fall back: infer module order from lesson number (lessons 1–4 → mod 1, 5–8 → mod 2, …)
        const modOrder = Math.ceil(num / 4);
        lesson.moduleId = orderToModuleId[modOrder] || rawModuleId;
        if (lesson.moduleId === rawModuleId) {
          warnings.push(`Lesson ${num}: could not resolve moduleId from placeholder "${rawModuleId}"`);
        }
      }
    } else if (rawModuleId) {
      lesson.moduleId = rawModuleId;
    } else {
      // No moduleId at all — infer from lesson order
      const modOrder = Math.ceil(num / 4);
      lesson.moduleId = orderToModuleId[modOrder] || '';
      warnings.push(`Lesson ${num}: no moduleId found, inferred from order → ${lesson.moduleId}`);
    }

    // ── Required fields (validator spec) ──────────────────────────────────
    // id
    lesson.id = lesson.id || `lesson-${pad2(num)}-${lesson.slug || ''}`;

    // duration → must match /^[0-9]+m$/
    if (!lesson.duration || !/^\d+m$/.test(lesson.duration)) {
      const mins = lesson.durationMinutes || lesson.duration_minutes || 0;
      lesson.duration = mins ? `${mins}m` : '60m';
    }

    // language
    lesson.language = lesson.language || 'en';

    // order
    lesson.order = lesson.order || num;

    // courseId
    lesson.courseId = course.slug;

    // track
    lesson.track = lesson.track || course.track || 'web-development';

    // quizId is set after quizzes are built (need quiz.id)
    // Store lesson num so we can back-reference later
    lesson._lessonNum = num;

    // ── Attach exercises ───────────────────────────────────────────────────
    const exFile = path.join(CSS_DIR, `lesson-${pad2(num)}-exercises.json`);
    const exData = readJson(exFile);
    if (exData && Array.isArray(exData.exercises) && exData.exercises.length > 0) {
      lesson.exercises = exData.exercises;
      ok(`lesson ${pad2(num)}: ${lesson.slug} [+${exData.exercises.length} exercises]`);
    } else {
      if (!exData) warn(`lesson-${pad2(num)}-exercises.json not found`);
      lesson.exercises = [];
      ok(`lesson ${pad2(num)}: ${lesson.slug} [no exercises]`);
    }

    // ── Attach resources ───────────────────────────────────────────────────
    const resourcesFile = path.join(CSS_DIR, `lesson-${pad2(num)}-resources.json`);
    const resourcesData = readJson(resourcesFile);
    if (resourcesData && typeof resourcesData === "object") {
      lesson.resources = stripMeta(resourcesData);
      ok(`lesson ${pad2(num)}: ${lesson.slug} [+resources]`);
    } else {
      lesson.resources = undefined;
      warn(`lesson-${pad2(num)}-resources.json not found`);
    }

    lessons.push(lesson);
  }

  lessons.sort((a, b) => a.order - b.order);

  // ── 4. Quizzes ────────────────────────────────────────────────────────────
  console.log('\n── Step 4: Quizzes');
  const quizFiles = fs.readdirSync(CSS_DIR)
    .filter(f => f.startsWith('lesson-') && f.includes('-quiz.json'))
    .sort();

  const quizzes = [];
  // lessonNum → quiz.id  — used to back-fill lesson.quizId
  const lessonNumToQuizId = {};

  for (const qFile of quizFiles) {
    const num = fileNum(qFile);
    const raw  = readJson(path.join(CSS_DIR, qFile));
    if (!raw) { warn(`${qFile}: could not read`); continue; }

    const quiz = stripMeta(raw);

    // ── Normalise id ──────────────────────────────────────────────────────
    quiz.id = quiz.id || quiz.slug || `quiz-lesson-${pad2(num)}`;

    // ── courseId ──────────────────────────────────────────────────────────
    quiz.courseId = course.slug;

    // ── Resolve moduleId ──────────────────────────────────────────────────
    // Same logic as lessons: resolve placeholder or infer from quiz lesson number
    const rawMid = String(quiz.moduleId || '');
    if (rawMid.includes('PLACEHOLDER')) {
      const resolved = placeholderToModuleId[rawMid];
      if (resolved) {
        quiz.moduleId = resolved;
      } else {
        const modOrder = Math.ceil(num / 4);
        quiz.moduleId = orderToModuleId[modOrder] || rawMid;
      }
    } else if (!rawMid) {
      const modOrder = Math.ceil(num / 4);
      quiz.moduleId = orderToModuleId[modOrder] || '';
    }

    // ── Normalise questions ───────────────────────────────────────────────
    // Validator requires per-question: id, objective, question, explanation, options[], correctOption (int)
    if (Array.isArray(quiz.questions)) {
      quiz.questions = quiz.questions.map((q, idx) => {
        const norm = { ...q };

        // question text
        norm.question = norm.question || norm.prompt || '';

        // objective (required by validator)
        norm.objective = norm.objective || norm.category || `Question ${idx + 1}`;

        // explanation (required by validator)
        norm.explanation = norm.explanation || norm.rationale || '';

        // correctOption must be an integer index
        if (typeof norm.correctOption !== 'number') {
          // Try answerIndex first, then correctAnswer as string → index lookup
          if (typeof norm.answerIndex === 'number') {
            norm.correctOption = norm.answerIndex;
          } else if (typeof norm.correctAnswer === 'string' && Array.isArray(norm.options)) {
            const idx2 = norm.options.indexOf(norm.correctAnswer);
            norm.correctOption = idx2 >= 0 ? idx2 : 0;
          } else {
            norm.correctOption = 0;
          }
        }
        norm.correctOption = parseInt(norm.correctOption, 10);

        // keep answerIndex for importer compatibility
        norm.answerIndex = norm.correctOption;

        return norm;
      });
      quiz.questionCount = quiz.questions.length;
    }

    if (num) lessonNumToQuizId[num] = quiz.id;
    ok(`quiz ${pad2(num || 0)}: ${quiz.id} [${quiz.questionCount || 0} questions]`);
    quizzes.push(quiz);
  }

  // ── 5. Back-fill lesson.quizId ────────────────────────────────────────────
  for (const lesson of lessons) {
    const n = lesson._lessonNum;
    const quizId = lessonNumToQuizId[n];
    if (quizId) {
      lesson.quizId = quizId;
    } else {
      warnings.push(`Lesson ${n} (${lesson.slug}): no matching quiz found`);
      lesson.quizId = '';
    }
    delete lesson._lessonNum;  // clean up temp field
    delete lesson.moduleSlug;  // clean up temp field
  }

  // ── 6. Assemble payload ───────────────────────────────────────────────────
  console.log('\n── Step 5: Assemble');

  const payload = {
    track: course.track || 'web-development',
    course: {
      id:       course.id || course.slug,
      title:    course.title,
      slug:     course.slug,
      level:    course.level,
      language: course.language,
      version:  course.version,
    },
    meta: {
      thumbnailUrl:    course.thumbnailUrl    || null,
      thumbnail:       course.thumbnail       || null,
      summary:         course.summary         || null,
      description:     course.description     || null,
      category:        course.category        || null,
      tags:            course.tags            || [],
      status:          course.status          || 'draft',
      visibility:      course.visibility      || 'private',
      durationMinutes: course.durationMinutes || null,
      tenantId:        course.tenantId        || 'public',
      source:          'seed-ready-css-course-v1',
    },
    summary: {
      moduleCount:   modules.length,
      lessonCount:   lessons.length,
      quizCount:     quizzes.length,
      projectCount:  0,
      rubricCount:   0,
      capstoneCount: 0,
    },
    modules,
    lessons,
    quizzes,
    projects:  [],
    rubrics:   [],
    capstones: [],
  };

  // ── 7. Internal validation ────────────────────────────────────────────────
  console.log('\n── Step 6: Validate');

  const moduleIds = new Set(modules.map(m => m.id));
  const quizIds   = new Set(quizzes.map(q => q.id));

  if (modules.length !== 4)
    errors.push(`Expected 4 modules, got ${modules.length}`);
  else ok(`${modules.length} modules`);

  if (lessons.length !== 16)
    warn(`Expected 16 lessons, got ${lessons.length}`);
  else ok(`${lessons.length} lessons`);

  if (quizzes.length !== 16)
    warn(`Expected 16 quizzes, got ${quizzes.length}`);
  else ok(`${quizzes.length} quizzes`);

  for (const l of lessons) {
    if (!moduleIds.has(l.moduleId))
      errors.push(`Lesson ${l.order} (${l.slug}): moduleId "${l.moduleId}" not in modules`);
    if (!quizIds.has(l.quizId))
      errors.push(`Lesson ${l.order} (${l.slug}): quizId "${l.quizId}" not in quizzes`);
    if (!/^\d+m$/.test(l.duration || ''))
      errors.push(`Lesson ${l.order} (${l.slug}): invalid duration "${l.duration}"`);
    if (!l.language)
      errors.push(`Lesson ${l.order} (${l.slug}): missing language`);
    if (!l.bodyMarkdown || l.bodyMarkdown.length < 50)
      errors.push(`Lesson ${l.order} (${l.slug}): bodyMarkdown missing or too short`);
  }

  for (const q of quizzes) {
    if (!moduleIds.has(q.moduleId))
      errors.push(`Quiz ${q.id}: moduleId "${q.moduleId}" not in modules`);
    const qs = q.questions || [];
    if (qs.length < 3)
      errors.push(`Quiz ${q.id}: only ${qs.length} questions (expected ≥3)`);
    qs.forEach((qq, i) => {
      if (typeof qq.correctOption !== 'number')
        errors.push(`Quiz ${q.id} Q${i+1}: correctOption is not a number`);
    });
  }

  // ── 8. Report ─────────────────────────────────────────────────────────────
  console.log('\n── Summary');
  console.log(`  Modules:  ${modules.length}`);
  console.log(`  Lessons:  ${lessons.length}`);
  console.log(`  Quizzes:  ${quizzes.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Errors:   ${errors.length}`);

  if (warnings.length) {
    console.log('\n  Warnings:');
    warnings.forEach(w => console.log(`    ⚠  ${w}`));
  }

  if (errors.length) {
    console.error('\n  Errors:');
    errors.forEach(e => console.error(`    ✗  ${e}`));
    console.error('\n❌ Build failed — fix errors before importing.\n');
    process.exit(1);
  }

  // ── 9. Write ──────────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n✅ Dry-run complete — all checks passed. No file written.');
    console.log(`   Would write to: ${OUT_PATH}`);
    console.log(`   Estimated size: ~${Math.round(JSON.stringify(payload).length / 1024)} KB\n`);
    return;
  }

  const json = JSON.stringify(payload, null, 2);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, json, 'utf8');

  const sizeKB = Math.round(json.length / 1024);
  const relOut  = path.relative(path.join(__dirname, '..'), OUT_PATH);

  console.log(`\n✅ Seed file written: ${OUT_PATH}`);
  console.log(`   Size: ~${sizeKB} KB`);
  console.log(`\nNext steps:`);
  console.log(`  npm run css:seed:validate`);
  console.log(`  npm run css:seed:import:dry`);
  console.log(`  npm run css:seed:import\n`);
}

build().catch(err => {
  console.error('\n❌ Assembler crashed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
