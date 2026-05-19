import type { ProgressEventDocument } from "@/lib/db/models";

export const DEFAULT_METRIC_WINDOW_DAYS = 28;
export const DEFAULT_WEEK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WeeklyMetricCell = {
  dayStartMs: number;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export type RecentProgressOutputItem = {
  id: string;
  tone: "accent" | "muted";
  message: string;
  occurredAt: string;
};

export type WeeklyProgressMetrics = {
  cells: WeeklyMetricCell[];
  thisWeekTouches: number;
  thisWeekCompleted: number;
  thisWeekActiveDays: number;
  streakDays: number;
  headline: string;
  recentOutput: RecentProgressOutputItem[];
};

export function toUtcDayStartMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toIntensity(count: number, maxCount: number): WeeklyMetricCell["intensity"] {
  if (count <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function compactLessonId(lessonId: string): string {
  if (lessonId.length <= 12) return lessonId;
  return `${lessonId.slice(0, 6)}…${lessonId.slice(-4)}`;
}

export function toLessonLookupKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

function formatRecentEventMessage(
  event: ProgressEventDocument,
  lessonTitlesById?: Map<string, string>
): string {
  const lesson =
    lessonTitlesById?.get(toLessonLookupKey(event.courseId.toString(), event.lessonId)) ??
    lessonTitlesById?.get(event.lessonId) ??
    compactLessonId(event.lessonId);
  switch (event.eventType) {
    case "lesson_started":
      return `Started lesson ${lesson}`;
    case "lesson_completed":
      return `Completed lesson ${lesson}`;
    case "lesson_reopened":
      return `Reopened lesson ${lesson}`;
    case "lesson_progressed":
    default:
      return `Updated ${lesson} to ${event.progressPercent}%`;
  }
}

/**
 * Metric definitions:
 * - update: one immutable progress event written when lesson state/progress/time changes
 * - active day: a UTC day with >=1 update
 * - weekly window: today (UTC) + previous 6 UTC days
 * - streak: consecutive active UTC days ending today
 * - completed: count of "lesson_completed" events within weekly window
 */
export function buildWeeklyProgressMetrics(params: {
  events: ProgressEventDocument[];
  lessonTitlesById?: Map<string, string>;
  now?: Date;
  metricWindowDays?: number;
  weekDays?: number;
  recentOutputLimit?: number;
}): WeeklyProgressMetrics {
  const now = params.now ?? new Date();
  const metricWindowDays = Math.max(7, params.metricWindowDays ?? DEFAULT_METRIC_WINDOW_DAYS);
  const weekDays = Math.max(1, params.weekDays ?? DEFAULT_WEEK_DAYS);
  const recentOutputLimit = Math.max(1, params.recentOutputLimit ?? 3);

  const todayStartMs = toUtcDayStartMs(now);
  const startWindowMs = todayStartMs - (metricWindowDays - 1) * DAY_MS;
  const weekStartMs = todayStartMs - (weekDays - 1) * DAY_MS;

  const dayCounts = new Map<number, number>();
  let thisWeekTouches = 0;
  let thisWeekCompleted = 0;
  const thisWeekActiveDaySet = new Set<number>();

  for (const event of params.events) {
    const dayStartMs = toUtcDayStartMs(event.occurredAt);
    if (dayStartMs < startWindowMs || dayStartMs > todayStartMs) continue;

    dayCounts.set(dayStartMs, (dayCounts.get(dayStartMs) ?? 0) + 1);

    if (dayStartMs >= weekStartMs) {
      thisWeekTouches += 1;
      thisWeekActiveDaySet.add(dayStartMs);
      if (event.eventType === "lesson_completed") {
        thisWeekCompleted += 1;
      }
    }
  }

  const maxCount = Math.max(1, ...dayCounts.values());
  const cells: WeeklyMetricCell[] = [];
  for (let offset = metricWindowDays - 1; offset >= 0; offset -= 1) {
    const dayStartMs = todayStartMs - offset * DAY_MS;
    const count = dayCounts.get(dayStartMs) ?? 0;
    cells.push({
      dayStartMs,
      count,
      intensity: toIntensity(count, maxCount),
    });
  }

  let streakDays = 0;
  for (let offset = 0; offset < metricWindowDays; offset += 1) {
    const dayStartMs = todayStartMs - offset * DAY_MS;
    if ((dayCounts.get(dayStartMs) ?? 0) > 0) {
      streakDays += 1;
    } else {
      break;
    }
  }

  const headline =
    thisWeekTouches > 0
      ? `You logged ${thisWeekTouches} learning update${
          thisWeekTouches === 1 ? "" : "s"
        } in the last ${weekDays} days.`
      : "No learning activity logged this week yet.";

  const recentOutput: RecentProgressOutputItem[] = params.events
    .slice(0, recentOutputLimit)
    .map((event) => ({
      id: event._id.toString(),
      tone: event.eventType === "lesson_completed" ? "accent" : "muted",
      message: formatRecentEventMessage(event, params.lessonTitlesById),
      occurredAt: event.occurredAt.toISOString(),
    }));

  if (recentOutput.length === 0) {
    recentOutput.push({
      id: "no-events",
      tone: "muted",
      message: "No progress events recorded yet.",
      occurredAt: now.toISOString(),
    });
  }

  return {
    cells,
    thisWeekTouches,
    thisWeekCompleted,
    thisWeekActiveDays: thisWeekActiveDaySet.size,
    streakDays,
    headline,
    recentOutput,
  };
}
