/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { requireAdmin } from "@/lib/auth-admin";
import { getMongoDb } from "@/lib/mongodb";
import { coursesCollection, modulesCollection, lessonsCollection, quizzesCollection } from "@/lib/db/collections";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { z } from "zod";

const courseImportSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  summary: z.string().optional(),
  category: z.string().optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
  durationMinutes: z.number().optional()
});

const moduleImportSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  order: z.number().optional(),
  durationMinutes: z.number().optional(),
  isPublished: z.boolean().optional()
});

const moduleImportArraySchema = z.union([
  moduleImportSchema,
  z.array(moduleImportSchema)
]);

const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";

export async function createDraftCourseAction(formData: FormData) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const summary = formData.get("summary") as string;
  
  if (!title || !slug) {
    throw new Error("Title and Slug are required.");
  }
  
  const now = new Date();
  
  await coursesCollection(db).insertOne({
    _id: new ObjectId(),
    tenantId,
    title,
    slug,
    description,
    summary,
    status: "draft" as any,
    visibility: "private" as any,
    modulesCount: 0,
    lessonsCount: 0,
    durationMinutes: 0,
    createdAt: now,
    updatedAt: now,
  });
  
  revalidatePath("/admin/courses");
  return { success: true };
}

export async function createModuleAction(courseIdStr: string, formData: FormData) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const courseId = new ObjectId(courseIdStr);
  
  if (!title || !slug) {
    throw new Error("Title and Slug are required.");
  }
  
  const now = new Date();
  
  await modulesCollection(db).insertOne({
    _id: new ObjectId(),
    tenantId,
    courseId,
    title,
    slug,
    order: Date.now(), // simple ordering
    lessonsCount: 0,
    durationMinutes: 0,
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  });
  
  revalidatePath(`/admin/courses/${courseIdStr}`);
  return { success: true };
}

export async function createLessonAction(courseIdStr: string, moduleIdStr: string, formData: FormData) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const courseId = new ObjectId(courseIdStr);
  const moduleId = new ObjectId(moduleIdStr);
  
  if (!title || !slug) {
    throw new Error("Title and Slug are required.");
  }
  
  const now = new Date();
  
  await lessonsCollection(db).insertOne({
    _id: new ObjectId(),
    id: `lesson-${Date.now()}`,
    tenantId,
    courseId,
    moduleId,
    title,
    slug,
    order: Date.now(),
    durationMinutes: 0,
    contentType: "text" as any,
    isPreview: false,
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  });
  
  revalidatePath(`/admin/courses/${courseIdStr}`);
  return { success: true };
}

export async function saveLessonBlocksAction(lessonIdStr: string, blocks: any[]) {
  await requireAdmin();
  const db = await getMongoDb();
  const lessonObjId = new ObjectId(lessonIdStr);
  
  const lesson = await lessonsCollection(db).findOne({ _id: lessonObjId });
  if (!lesson) throw new Error("Lesson not found");
  
  const now = new Date();
  
  let bodyMarkdown = "";
  let videoUrl = "";
  let videoProvider: "youtube" | "vimeo" | "loom" | "wistia" | "mux" = "youtube";
  let starterFiles: any[] = [];
  
  const lists: Record<string, string[]> = {
    learningObjectives: [],
    prerequisites: [],
    outcomes: [],
    instructions: [],
    expectedOutput: []
  };
  
  const exercises: any[] = [];
  const questions: any[] = [];
  const resources = { externalResources: [] as any[] };
  
  for (const block of blocks) {
    if (block.type === "markdown") {
      bodyMarkdown += (block.data?.content || "") + "\n\n";
    }
    if (block.type === "video") {
      videoUrl = block.data?.videoUrl || "";
      videoProvider = block.data?.videoProvider || "youtube";
    }
    if (block.type === "starter_files") {
      starterFiles = block.data?.files || [];
    }
    if (block.type === "list") {
      const type = block.data?.listType;
      if (type && lists[type] !== undefined) {
        lists[type] = block.data?.items || [];
      }
    }
    if (block.type === "exercise") {
      exercises.push({
        id: crypto.randomUUID(),
        type: block.data?.type || "live-editor",
        task: block.data?.task || "",
        instructions: block.data?.instructions || "",
        validationRules: [{ type: "no-op" }]
      });
    }
    if (block.type === "quiz") {
      const qs = block.data?.questions || [];
      questions.push(...qs.map((q: any) => ({
        id: q.id || crypto.randomUUID(),
        question: q.question,
        options: q.options,
        correctOption: q.correctOption || 0,
        explanation: q.explanation || ""
      })));
    }
    if (block.type === "resource") {
      resources.externalResources.push({
        id: crypto.randomUUID(),
        title: block.data?.title || "External Link",
        url: block.data?.url || "#",
        description: block.data?.description || ""
      });
    }
  }
  
  // Set content type to video if videoUrl exists, otherwise text
  const contentType = videoUrl ? "video" : "text";

  await lessonsCollection(db).updateOne(
    { _id: lessonObjId },
    {
      $set: {
        contentType,
        videoUrl,
        videoProvider,
        learningObjectives: lists.learningObjectives,
        prerequisites: lists.prerequisites,
        outcomes: lists.outcomes,
        instructions: lists.instructions,
        expectedOutput: lists.expectedOutput,
        starterFiles: starterFiles.length > 0 ? starterFiles as any : undefined,
        bodyMarkdown: bodyMarkdown.trim(),
        exercises: exercises.length > 0 ? exercises as any : undefined,
        resources: resources.externalResources.length > 0 ? resources as any : undefined,
        updatedAt: now
      }
    }
  );
  
  // Upsert Quiz if questions exist
  if (questions.length > 0) {
    const quizSlug = `${lesson.slug}-quiz`;
    await quizzesCollection(db).updateOne(
      { lessonId: lesson.id as any, courseId: lesson.courseId },
      {
        $set: {
          id: `quiz-${lesson.id}`,
          tenantId,
          courseId: lesson.courseId,
          moduleId: lesson.moduleId as any,
          lessonId: lesson.id as any,
          slug: quizSlug,
          title: "Lesson Quiz",
          passingScore: 100,
          timeLimitMinutes: 0,
          questionCount: questions.length,
          questions: questions as any,
          isPublished: false,
          status: "published" as any, // assuming status string literal type compatibility
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
  }
  
  revalidatePath(`/admin/courses/${lesson.courseId.toString()}`);
  return { success: true, message: "Lesson blocks saved." };
}

export async function importCourseJsonAction(jsonString: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  let rawData;
  try {
    rawData = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Invalid JSON format");
  }

  const result = courseImportSchema.safeParse(rawData);
  if (!result.success) {
    const errorMsg = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation Error: ${errorMsg}`);
  }

  const data = result.data;
  const now = new Date();
  const courseId = new ObjectId();
  
  await coursesCollection(db).insertOne({
    _id: courseId,
    tenantId,
    title: data.title,
    slug: data.slug,
    description: data.description || "",
    summary: data.summary || "",
    category: data.category || "",
    level: data.level || "beginner",
    tags: data.tags || [],
    status: data.status || "draft",
    visibility: data.visibility || "private",
    modulesCount: 0,
    lessonsCount: 0,
    durationMinutes: data.durationMinutes || 0,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/admin/courses");
  return { success: true, courseId: courseId.toString() };
}

export async function importModuleJsonAction(courseIdStr: string, jsonString: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  let rawData;
  try {
    rawData = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Invalid JSON format");
  }

  const result = moduleImportArraySchema.safeParse(rawData);
  if (!result.success) {
    const errorMsg = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation Error: ${errorMsg}`);
  }

  const modulesData = Array.isArray(result.data) ? result.data : [result.data];
  
  const courseId = new ObjectId(courseIdStr);
  const now = new Date();

  for (const mod of modulesData) {
    const moduleId = new ObjectId();
    await modulesCollection(db).insertOne({
      _id: moduleId,
      tenantId,
      courseId,
      title: mod.title,
      slug: mod.slug,
      description: mod.description || "",
      order: typeof mod.order === 'number' ? mod.order : Date.now(),
      lessonsCount: 0,
      durationMinutes: mod.durationMinutes || 0,
      isPublished: mod.isPublished === true,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath(`/admin/courses/${courseIdStr}`);
  return { success: true };
}

export async function toggleCourseStatusAction(courseIdStr: string, currentStatus: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const courseId = new ObjectId(courseIdStr);
  const newStatus = currentStatus === "published" ? "draft" : "published";
  
  await coursesCollection(db).updateOne(
    { _id: courseId },
    { $set: { status: newStatus as any, updatedAt: new Date() } }
  );
  
  revalidatePath("/admin/courses");
}

export async function toggleModuleStatusAction(moduleIdStr: string, currentIsPublished: boolean, courseIdStr: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const moduleId = new ObjectId(moduleIdStr);
  const newStatus = !currentIsPublished;
  
  await modulesCollection(db).updateOne(
    { _id: moduleId },
    { $set: { isPublished: newStatus, updatedAt: new Date() } }
  );
  
  revalidatePath(`/admin/courses/${courseIdStr}`);
}

export async function toggleLessonStatusAction(lessonIdStr: string, currentIsPublished: boolean, courseIdStr: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const lessonId = new ObjectId(lessonIdStr);
  const newStatus = !currentIsPublished;
  
  await lessonsCollection(db).updateOne(
    { _id: lessonId },
    { $set: { isPublished: newStatus, updatedAt: new Date() } }
  );
  
  revalidatePath(`/admin/courses/${courseIdStr}`);
}

export async function moveLessonAction(lessonIdStr: string, newModuleIdStr: string, courseIdStr: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const lessonId = new ObjectId(lessonIdStr);
  const newModuleId = new ObjectId(newModuleIdStr);
  
  await lessonsCollection(db).updateOne(
    { _id: lessonId },
    { $set: { moduleId: newModuleId, updatedAt: new Date() } }
  );
  
  revalidatePath(`/admin/courses/${courseIdStr}`);
}

export async function updateCourseMediaAction(courseIdStr: string, mediaType: "image" | "video", url: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const courseId = new ObjectId(courseIdStr);
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (mediaType === "image") {
    updateData.imageUrl = url;
  } else if (mediaType === "video") {
    updateData.videoUrl = url;
  }
  
  await coursesCollection(db).updateOne(
    { _id: courseId },
    { $set: updateData }
  );
  
  revalidatePath(`/admin/courses/${courseIdStr}`);
  revalidatePath("/admin/courses");
  revalidatePath("/");
  revalidatePath("/curriculum");
}

export async function deleteCourseAction(courseIdStr: string) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const courseId = new ObjectId(courseIdStr);
  
  await Promise.all([
    coursesCollection(db).deleteOne({ _id: courseId }),
    modulesCollection(db).deleteMany({ courseId }),
    lessonsCollection(db).deleteMany({ courseId }),
    quizzesCollection(db).deleteMany({ courseId })
  ]);
  
  revalidatePath("/admin/courses");
}

export async function importLessonJsonAction(
  courseIdStr: string,
  moduleIdStr: string,
  payload: {
    lessonId?: string;
    lessonJson?: string;
    quizJson?: string;
    exercisesJson?: string;
    resourcesJson?: string;
  }
) {
  await requireAdmin();
  const db = await getMongoDb();
  
  const courseId = new ObjectId(courseIdStr);
  const moduleId = new ObjectId(moduleIdStr);

  const existingLessonId = payload.lessonId ? new ObjectId(payload.lessonId) : null;
  const now = new Date();

  let lessonData: any = null;
  if (payload.lessonJson) {
    try {
      const raw = JSON.parse(payload.lessonJson);
      // Validate with zod
      // We aren't doing strict validation yet because existing payloads might be missing fields,
      // but let's at least ensure it doesn't crash on bad JSON.
      lessonData = raw;
    } catch (e) {
      throw new Error("Invalid Lesson JSON syntax");
    }
  }

  if (!existingLessonId && (!lessonData || !lessonData.title || !lessonData.slug)) {
    throw new Error("Lesson JSON is required and must contain at least a 'title' and 'slug' for new lessons");
  }

  let exercises = null;
  if (payload.exercisesJson) {
    try {
      const parsed = JSON.parse(payload.exercisesJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      
      // Basic validation for exercises
      if (arr.some(ex => !ex.id || !ex.task || !ex.instructions)) {
         throw new Error("Each exercise must include at least an 'id', 'task', and 'instructions'");
      }
      exercises = arr;
    } catch (e: any) {
      throw new Error("Invalid Exercises JSON syntax: " + e.message);
    }
  }

  let resources = null;
  if (payload.resourcesJson) {
    try {
      const parsed = JSON.parse(payload.resourcesJson);
      
      // Basic validation for resources
      if (parsed.externalResources && Array.isArray(parsed.externalResources)) {
        if (parsed.externalResources.some((r: any) => !r.id || !r.title || !r.url)) {
          throw new Error("Each external resource must include at least 'id', 'title', and 'url'");
        }
      }
      resources = parsed;
    } catch (e: any) {
      throw new Error("Invalid Resources JSON syntax: " + e.message);
    }
  }

  let quizData = null;
  if (payload.quizJson) {
    try {
      const rawQuiz = JSON.parse(payload.quizJson);
      
      if (!rawQuiz.questions || !Array.isArray(rawQuiz.questions)) {
        throw new Error("Quiz JSON must contain a 'questions' array");
      }
      quizData = rawQuiz;
    } catch (e: any) {
      throw new Error("Invalid Quiz JSON syntax: " + e.message);
    }
  }

  let finalLessonId = existingLessonId;

  if (existingLessonId) {
    const updateFields: any = { updatedAt: now };
    
    if (lessonData) {
      if (lessonData.title) updateFields.title = lessonData.title;
      if (lessonData.slug) updateFields.slug = lessonData.slug;
      if (lessonData.bodyMarkdown !== undefined) updateFields.bodyMarkdown = lessonData.bodyMarkdown;
      if (lessonData.videoUrl !== undefined) updateFields.videoUrl = lessonData.videoUrl;
      if (lessonData.videoProvider !== undefined) updateFields.videoProvider = lessonData.videoProvider;
      if (lessonData.starterFiles !== undefined) updateFields.starterFiles = lessonData.starterFiles;
      if (lessonData.learningObjectives !== undefined) updateFields.learningObjectives = lessonData.learningObjectives;
      if (lessonData.prerequisites !== undefined) updateFields.prerequisites = lessonData.prerequisites;
      if (lessonData.outcomes !== undefined) updateFields.outcomes = lessonData.outcomes;
      if (lessonData.instructions !== undefined) updateFields.instructions = lessonData.instructions;
      if (lessonData.expectedOutput !== undefined) updateFields.expectedOutput = lessonData.expectedOutput;
      if (lessonData.order !== undefined) updateFields.order = lessonData.order;
      if (lessonData.isPublished !== undefined) updateFields.isPublished = lessonData.isPublished;
      if (lessonData.durationMinutes !== undefined) updateFields.durationMinutes = lessonData.durationMinutes;
      if (lessonData.contentType !== undefined) updateFields.contentType = lessonData.contentType;
      if (lessonData.isPreview !== undefined) updateFields.isPreview = lessonData.isPreview;
    }

    if (exercises !== null) updateFields.exercises = exercises;
    if (resources !== null) updateFields.resources = resources;

    await lessonsCollection(db).updateOne(
      { _id: existingLessonId },
      { $set: updateFields }
    );
  } else {
    finalLessonId = new ObjectId();
    const newLesson = {
      _id: finalLessonId,
      id: lessonData.id || finalLessonId.toString(),
      tenantId,
      courseId,
      moduleId,
      title: lessonData.title,
      slug: lessonData.slug,
      bodyMarkdown: lessonData.bodyMarkdown || "",
      exercises: exercises || [],
      resources: resources || { externalResources: [] },
      videoUrl: lessonData.videoUrl,
      videoProvider: lessonData.videoProvider,
      starterFiles: lessonData.starterFiles,
      learningObjectives: lessonData.learningObjectives,
      prerequisites: lessonData.prerequisites,
      outcomes: lessonData.outcomes,
      instructions: lessonData.instructions,
      expectedOutput: lessonData.expectedOutput,
      order: lessonData.order || Date.now(),
      isPublished: lessonData.isPublished || false,
      durationMinutes: lessonData.durationMinutes || 0,
      contentType: lessonData.contentType || "markdown",
      isPreview: lessonData.isPreview || false,
      createdAt: now,
      updatedAt: now,
    };

    await lessonsCollection(db).insertOne(newLesson);

    await modulesCollection(db).updateOne(
      { _id: moduleId },
      { $inc: { lessonsCount: 1 } }
    );

    await coursesCollection(db).updateOne(
      { _id: courseId },
      { $inc: { lessonsCount: 1 } }
    );
  }

  if (quizData && finalLessonId) {
    const lessonObj = await lessonsCollection(db).findOne({ _id: finalLessonId });
    const lessonStringId = lessonObj?.id || finalLessonId.toString();

    const existingQuiz = await quizzesCollection(db).findOne({ lessonId: { $in: [lessonStringId, finalLessonId.toString()] } });
    
    const questions = (quizData.questions || []).map((q: any) => ({
      ...q,
      prompt: q.prompt || q.question || "",
      answerIndex: q.answerIndex !== undefined ? q.answerIndex : (q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0)
    }));
    const questionCount = questions.length;
    
    if (existingQuiz) {
      await quizzesCollection(db).updateOne(
        { _id: existingQuiz._id },
        { $set: { 
          questions, 
          questionCount,
          lessonId: lessonStringId, 
          slug: existingQuiz.slug || (lessonData?.slug ? `${lessonData.slug}-quiz` : `quiz-${lessonStringId}`),
          title: existingQuiz.title || (lessonData?.title ? `${lessonData.title} Quiz` : "Quiz"),
          order: existingQuiz.order || lessonData?.order || 0,
          passingScore: existingQuiz.passingScore || 80,
          timeLimitMinutes: existingQuiz.timeLimitMinutes || 0,
          isPublished: true,
          status: "published",
          updatedAt: now 
        } }
      );
    } else {
      await quizzesCollection(db).insertOne({
        _id: new ObjectId(),
        tenantId,
        courseId,
        moduleId,
        lessonId: lessonStringId,
        slug: lessonData?.slug ? `${lessonData.slug}-quiz` : `quiz-${lessonStringId}`,
        title: lessonData?.title ? `${lessonData.title} Quiz` : "Quiz",
        order: lessonData?.order || 0,
        passingScore: 80,
        timeLimitMinutes: 0,
        questionCount,
        isPublished: true,
        status: "published",
        questions,
        createdAt: now,
        updatedAt: now,
      } as any);
    }
  }

  revalidatePath(`/admin/courses/${courseIdStr}`);
}

export async function deleteModuleAction(courseIdStr: string, moduleIdStr: string) {
  await requireAdmin();
  const db = await getMongoDb();
  const moduleId = new ObjectId(moduleIdStr);

  await Promise.all([
    modulesCollection(db).deleteOne({ _id: moduleId }),
    lessonsCollection(db).deleteMany({ moduleId }),
    // Delete quizzes linked to those lessons
    quizzesCollection(db).deleteMany({ moduleId })
  ]);

  await coursesCollection(db).updateOne(
    { _id: new ObjectId(courseIdStr) },
    { $inc: { modulesCount: -1 } }
  );

  revalidatePath(`/admin/courses/${courseIdStr}`);
  return { success: true };
}

export async function deleteLessonAction(courseIdStr: string, moduleIdStr: string, lessonIdStr: string) {
  await requireAdmin();
  const db = await getMongoDb();
  const lessonObjId = new ObjectId(lessonIdStr);

  const lesson = await lessonsCollection(db).findOne({ _id: lessonObjId });
  
  await Promise.all([
    lessonsCollection(db).deleteOne({ _id: lessonObjId }),
    // Delete quizzes linked to this lesson (using both string id and object id just in case)
    lesson ? quizzesCollection(db).deleteOne({ lessonId: { $in: [lesson.id, lessonIdStr] } }) : Promise.resolve()
  ]);

  await Promise.all([
    coursesCollection(db).updateOne(
      { _id: new ObjectId(courseIdStr) },
      { $inc: { lessonsCount: -1 } }
    ),
    modulesCollection(db).updateOne(
      { _id: new ObjectId(moduleIdStr) },
      { $inc: { lessonsCount: -1 } }
    )
  ]);

  revalidatePath(`/admin/courses/${courseIdStr}`);
  return { success: true };
}
