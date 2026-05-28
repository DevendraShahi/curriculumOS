import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const payloadPath = path.resolve(process.cwd(), '../../docs/courses/web-development/seed-ready-html-course-v1.json');

test('course seed payload exists', () => {
  assert.equal(fs.existsSync(payloadPath), true, `Payload not found: ${payloadPath}`);
});

test('course seed payload has expected summary counts', () => {
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  assert.equal(payload.modules.length, 4);
  assert.equal(payload.lessons.length, 16);
  assert.equal(payload.quizzes.length, 4);
  assert.equal(payload.projects.length, 3);
  assert.equal(payload.rubrics.length, 4);
  assert.equal(payload.capstones.length, 1);

  assert.equal(payload.summary.moduleCount, payload.modules.length);
  assert.equal(payload.summary.lessonCount, payload.lessons.length);
  assert.equal(payload.summary.quizCount, payload.quizzes.length);
  assert.equal(payload.summary.projectCount, payload.projects.length);
  assert.equal(payload.summary.rubricCount, payload.rubrics.length);
  assert.equal(payload.summary.capstoneCount, payload.capstones.length);
});

test('lessons reference valid module and quiz ids', () => {
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const moduleIds = new Set(payload.modules.map((m) => m.id));
  const quizIds = new Set(payload.quizzes.map((q) => q.id));

  for (const lesson of payload.lessons) {
    assert.ok(moduleIds.has(lesson.moduleId), `Invalid moduleId on lesson ${lesson.id}: ${lesson.moduleId}`);
    assert.ok(quizIds.has(lesson.quizId), `Invalid quizId on lesson ${lesson.id}: ${lesson.quizId}`);
    assert.match(lesson.duration, /^[0-9]+m$/, `Invalid duration format on lesson ${lesson.id}: ${lesson.duration}`);
    assert.ok(lesson.bodyMarkdown && lesson.bodyMarkdown.length > 20, `Lesson body too short: ${lesson.id}`);
  }
});
