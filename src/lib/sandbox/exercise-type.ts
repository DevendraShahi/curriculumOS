export type NormalizedExerciseType = "sandbox" | "quiz" | "reading" | "project";

export function normalizeExerciseType(
  type: string | null | undefined
): NormalizedExerciseType | "unsupported" {
  switch (type) {
    case "sandbox":
    case "live-exercise":
    case "live-editor":
      return "sandbox";

    case "quiz":
      return "quiz";

    case "reading":
      return "reading";

    case "project":
      return "project";

    default:
      return "unsupported";
  }
}
