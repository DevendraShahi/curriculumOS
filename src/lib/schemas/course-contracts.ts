import { z } from 'zod';

// Base schemas
export const CourseMetaSchema = z.object({
  schemaVersion: z.string().optional(),
  entityType: z.literal('course'),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  category: z.string().optional(),
  level: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string(),
  visibility: z.string(),
  instructorIds: z.array(z.string()).optional(),
  modulesCount: z.number().optional(),
  lessonsCount: z.number().optional(),
  durationMinutes: z.number().optional(),
  publishedAt: z.string().nullable().optional(),
  tenantId: z.string().optional(),
});

export const ModuleMetaSchema = z.object({
  schemaVersion: z.string().optional(),
  entityType: z.literal('module'),
  courseSlug: z.string(),
  courseId: z.string().optional(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number(),
  durationMinutes: z.number().optional(),
  lessonsCount: z.number().optional(),
  isPublished: z.boolean(),
  tenantId: z.string().optional(),
  lessonRefs: z.array(z.string()),
});

export const LessonSchema = z.object({
  schemaVersion: z.string().optional(),
  entityType: z.literal('lesson'),
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  courseId: z.string().optional(),
  courseSlug: z.string(),
  moduleId: z.string().optional(),
  moduleSlug: z.string(),
  order: z.number(),
  contentType: z.enum(['text', 'video', 'project', 'quiz']).catch('text'),
  durationMinutes: z.number().optional(),
  summary: z.string(),
  description: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  learningObjectives: z.array(z.string()),
  instructions: z.array(z.string()).optional(),
  starterFiles: z.array(z.any()).optional(),
  expectedOutput: z.array(z.any()).optional(),
  bodyMarkdown: z.string(),
  isPreview: z.boolean().optional(),
  isPublished: z.boolean(),
  tenantId: z.string().optional(),
});

export const ValidationRuleSchema = z.object({
  type: z.string(),
  tag: z.string().optional(),
  message: z.string().optional(),
  // Add other properties if validation rules expand
}).passthrough();

export const HintSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  content: z.string(),
});

export const ExerciseSchema = z.object({
  id: z.string(),
  type: z.enum(['live-editor', 'sandbox', 'live-exercise']).catch('live-editor'),
  task: z.string(),
  instructions: z.string(),
  starterCode: z.string().optional(),
  hints: z.array(z.union([z.string(), HintSchema])).optional(),
  validationRules: z.array(ValidationRuleSchema).min(1, "Must contain at least one validation rule"),
});

export const LessonExercisesSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().optional(),
  courseId: z.string().optional(),
  courseSlug: z.string(),
  moduleId: z.string().optional(),
  lessonId: z.string(),
  exercises: z.array(ExerciseSchema).refine(
    (exercises) => exercises.every((ex) => ex.type === 'live-editor' || ex.type === 'sandbox' || ex.type === 'live-exercise'),
    "Non-coding exercise types are not allowed"
  ),
});

export const QuizQuestionSchema = z.object({
  id: z.string(),
  objective: z.string().optional(),
  prompt: z.string(),
  options: z.array(z.string()),
  answerIndex: z.number(),
  answer: z.string().optional(),
  explanation: z.string().optional(),
}).refine(data => data.answerIndex < data.options.length, {
  message: "answerIndex must be a valid index in options array",
  path: ["answerIndex"],
});

export const LessonQuizSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().optional(),
  summary: z.string().optional(),
  lessonId: z.string().optional(),
  moduleId: z.string().optional(),
  passingScore: z.number(),
  timeLimitMinutes: z.number().optional(),
  questionCount: z.number(),
  questions: z.array(QuizQuestionSchema),
}).refine(data => data.questionCount === data.questions.length, {
  message: "questionCount must match the length of questions array",
  path: ["questionCount"],
});

export const ExternalResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url("Must be a valid URL"),
  kind: z.string().optional(),
  downloadable: z.boolean().optional(),
  description: z.string().optional(),
});

export const LessonResourcesSchema = z.object({
  entityType: z.literal('lesson-resources'),
  courseSlug: z.string(),
  moduleSlug: z.string(),
  lessonId: z.string(),
  lessonSlug: z.string(),
  status: z.string().optional(),
  externalResources: z.array(ExternalResourceSchema),
  learnerReference: z.array(z.string()).optional(),
  resourcePrompts: z.array(z.string()).optional(),
  // Internal notes are stripped during parse
});

// Infer types
export type CourseMeta = z.infer<typeof CourseMetaSchema>;
export type ModuleMeta = z.infer<typeof ModuleMetaSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonExercises = z.infer<typeof LessonExercisesSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type LessonQuiz = z.infer<typeof LessonQuizSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type LessonResources = z.infer<typeof LessonResourcesSchema>;
export type ExternalResource = z.infer<typeof ExternalResourceSchema>;
