"use client";

import { useCallback } from "react";

type TelemetryEvent = 
  | { name: "lesson_started"; properties: { lessonId: string; courseId: string } }
  | { name: "lesson_completed"; properties: { lessonId: string; courseId: string; timeSpentSeconds?: number } }
  | { name: "exercise_started"; properties: { exerciseId: string; lessonId: string } }
  | { name: "exercise_completed"; properties: { exerciseId: string; lessonId: string } }
  | { name: "quiz_started"; properties: { quizId: string; lessonId: string } }
  | { name: "quiz_completed"; properties: { quizId: string; lessonId: string; score: number; passed: boolean } };

export function useTelemetry() {
  const track = useCallback((event: TelemetryEvent) => {
    // In the future, integrate PostHog, Vercel Web Analytics, or Segment here.
    if (process.env.NODE_ENV === "development") {
      console.log(`[Telemetry] ${event.name}`, event.properties);
    }
  }, []);

  return { track };
}
