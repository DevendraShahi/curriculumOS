import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import {
  buildWeeklyProgressMetrics,
  toUtcDayStartMs,
} from "../../src/lib/services/progress-metrics-service.ts";

function makeEvent({
  courseId = new ObjectId(),
  lessonId = "lesson-1",
  eventType = "lesson_progressed",
  state = "in_progress",
  progressPercent = 50,
  occurredAt,
}) {
  const when = new Date(occurredAt);
  return {
    _id: new ObjectId(),
    tenantId: "public",
    userId: new ObjectId(),
    courseId,
    lessonId,
    moduleId: null,
    enrollmentId: null,
    eventType,
    state,
    progressPercent,
    progressDelta: progressPercent,
    timeSpentSeconds: 0,
    timeSpentDelta: 0,
    occurredAt: when,
    metadata: { source: "api_v1_progress" },
    createdAt: when,
    updatedAt: when,
  };
}

test("7-day metrics include UTC week window and exclude prior day", () => {
  const now = new Date("2026-05-16T12:00:00.000Z");
  const courseId = new ObjectId();
  const events = [
    makeEvent({
      courseId,
      lessonId: "lesson-today",
      occurredAt: "2026-05-16T09:00:00.000Z",
      eventType: "lesson_progressed",
    }),
    makeEvent({
      courseId,
      lessonId: "lesson-yesterday",
      occurredAt: "2026-05-15T18:30:00.000Z",
      eventType: "lesson_completed",
      state: "completed",
      progressPercent: 100,
    }),
    makeEvent({
      courseId,
      lessonId: "lesson-window-start",
      occurredAt: "2026-05-10T00:00:00.000Z",
      eventType: "lesson_started",
      progressPercent: 1,
    }),
    makeEvent({
      courseId,
      lessonId: "lesson-outside-7d",
      occurredAt: "2026-05-09T23:59:59.000Z",
      eventType: "lesson_progressed",
    }),
  ];

  const metrics = buildWeeklyProgressMetrics({
    events,
    now,
    metricWindowDays: 28,
    weekDays: 7,
  });

  assert.equal(metrics.thisWeekTouches, 3);
  assert.equal(metrics.thisWeekCompleted, 1);
  assert.equal(metrics.thisWeekActiveDays, 3);
});

test("streak counts consecutive active UTC days ending today", () => {
  const now = new Date("2026-05-16T12:00:00.000Z");
  const courseId = new ObjectId();
  const events = [
    makeEvent({ courseId, lessonId: "a", occurredAt: "2026-05-16T02:00:00.000Z" }),
    makeEvent({ courseId, lessonId: "b", occurredAt: "2026-05-15T02:00:00.000Z" }),
    makeEvent({ courseId, lessonId: "c", occurredAt: "2026-05-14T02:00:00.000Z" }),
    makeEvent({ courseId, lessonId: "d", occurredAt: "2026-05-13T02:00:00.000Z" }),
    makeEvent({ courseId, lessonId: "older", occurredAt: "2026-05-10T02:00:00.000Z" }),
  ];

  const metrics = buildWeeklyProgressMetrics({
    events,
    now,
    metricWindowDays: 28,
    weekDays: 7,
  });

  assert.equal(metrics.streakDays, 4);
});

test("UTC midnight boundary maps activity into correct days", () => {
  const now = new Date("2026-05-16T12:00:00.000Z");
  const courseId = new ObjectId();
  const events = [
    makeEvent({
      courseId,
      lessonId: "before-midnight",
      occurredAt: "2026-05-15T23:59:59.999Z",
    }),
    makeEvent({
      courseId,
      lessonId: "after-midnight",
      occurredAt: "2026-05-16T00:00:00.000Z",
    }),
  ];

  const metrics = buildWeeklyProgressMetrics({
    events,
    now,
    metricWindowDays: 28,
    weekDays: 7,
  });

  const day15 = toUtcDayStartMs(new Date("2026-05-15T12:00:00.000Z"));
  const day16 = toUtcDayStartMs(new Date("2026-05-16T12:00:00.000Z"));

  const cell15 = metrics.cells.find((cell) => cell.dayStartMs === day15);
  const cell16 = metrics.cells.find((cell) => cell.dayStartMs === day16);

  assert.equal(metrics.thisWeekTouches, 2);
  assert.equal(metrics.thisWeekActiveDays, 2);
  assert.equal(metrics.streakDays, 2);
  assert.equal(cell15?.count, 1);
  assert.equal(cell16?.count, 1);
});
