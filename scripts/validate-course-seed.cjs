const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function main() {
  const payloadPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '../../docs/courses/web-development/seed-ready-html-course-v1.json');

  if (!fs.existsSync(payloadPath)) {
    console.error(`[validate-course-seed] Payload not found: ${payloadPath}`);
    process.exit(1);
  }

  const payload = readJson(payloadPath);
  const errors = [];

  const requiredTop = ['track', 'course', 'summary', 'modules', 'lessons', 'quizzes', 'projects', 'rubrics', 'capstones'];
  requiredTop.forEach((k) => assert(k in payload, `Missing top-level key: ${k}`, errors));

  assert(Array.isArray(payload.modules), 'modules must be an array', errors);
  assert(Array.isArray(payload.lessons), 'lessons must be an array', errors);
  assert(Array.isArray(payload.quizzes), 'quizzes must be an array', errors);

  if (payload.course) {
    ['id', 'title', 'slug', 'level', 'language', 'version'].forEach((k) => {
      assert(isNonEmptyString(payload.course[k]), `course.${k} must be a non-empty string`, errors);
    });
  }

  const moduleIds = new Set();
  for (const m of payload.modules || []) {
    ['id', 'slug', 'title', 'path'].forEach((k) => {
      assert(isNonEmptyString(m[k]), `module missing/invalid ${k}: ${JSON.stringify(m)}`, errors);
    });
    assert(Number.isInteger(m.order), `module.order must be integer: ${m.id || 'unknown'}`, errors);
    if (m.id) moduleIds.add(m.id);
  }

  const quizIds = new Set();
  for (const q of payload.quizzes || []) {
    assert(isNonEmptyString(q.id), `quiz.id missing`, errors);
    assert(isNonEmptyString(q.moduleId), `quiz.moduleId missing for ${q.id || 'unknown'}`, errors);
    assert(moduleIds.has(q.moduleId), `quiz.moduleId not found in modules: ${q.moduleId}`, errors);
    assert(Array.isArray(q.questions) && q.questions.length > 0, `quiz.questions missing/empty for ${q.id || 'unknown'}`, errors);
    if (Array.isArray(q.questions)) {
      q.questions.forEach((qq, idx) => {
        ['id', 'objective', 'question', 'explanation'].forEach((k) => {
          assert(isNonEmptyString(qq[k]), `quiz ${q.id} question ${idx + 1} missing ${k}`, errors);
        });
        assert(Array.isArray(qq.options) && qq.options.length >= 2, `quiz ${q.id} question ${idx + 1} options invalid`, errors);
        assert(Number.isInteger(qq.correctOption), `quiz ${q.id} question ${idx + 1} correctOption must be integer`, errors);
        if (Array.isArray(qq.options) && Number.isInteger(qq.correctOption)) {
          assert(qq.correctOption >= 0 && qq.correctOption < qq.options.length, `quiz ${q.id} question ${idx + 1} correctOption out of range`, errors);
        }
      });
    }
    if (q.id) quizIds.add(q.id);
  }

  const lessonIds = new Set();
  for (const l of payload.lessons || []) {
    ['id', 'slug', 'title', 'moduleId', 'duration', 'language', 'quizId', 'bodyMarkdown'].forEach((k) => {
      assert(isNonEmptyString(l[k]), `lesson missing/invalid ${k}: ${l.id || 'unknown'}`, errors);
    });
    assert(moduleIds.has(l.moduleId), `lesson.moduleId not found in modules: ${l.moduleId} (lesson ${l.id || 'unknown'})`, errors);
    assert(/^[0-9]+m$/.test(l.duration || ''), `lesson.duration must match ^[0-9]+m$: ${l.id || 'unknown'}`, errors);
    assert(quizIds.has(l.quizId), `lesson.quizId not found in quizzes: ${l.quizId} (lesson ${l.id || 'unknown'})`, errors);
    if (l.id) {
      assert(!lessonIds.has(l.id), `duplicate lesson id: ${l.id}`, errors);
      lessonIds.add(l.id);
    }
  }

  const summary = payload.summary || {};
  const expected = {
    moduleCount: (payload.modules || []).length,
    lessonCount: (payload.lessons || []).length,
    quizCount: (payload.quizzes || []).length,
    projectCount: (payload.projects || []).length,
    rubricCount: (payload.rubrics || []).length,
    capstoneCount: (payload.capstones || []).length,
  };

  Object.keys(expected).forEach((k) => {
    if (summary[k] !== undefined) {
      assert(summary[k] === expected[k], `summary.${k}=${summary[k]} does not match actual ${expected[k]}`, errors);
    }
  });

  if (errors.length > 0) {
    console.error('[validate-course-seed] Validation FAILED');
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }

  console.log('[validate-course-seed] Validation PASSED');
  console.log(JSON.stringify(expected, null, 2));
}

main();
