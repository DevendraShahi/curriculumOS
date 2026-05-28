const { MongoClient, ObjectId } = require("mongodb");
const {
  curriculumSeedData,
  curriculumSeedSlugs,
} = require("./curriculum-seed-data.cjs");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = requireEnv("MONGODB_DB_NAME");
const tenantId = process.env.APP_DEFAULT_TENANT_ID || "public";
const shouldResetFirst = process.argv.includes("--reset");

function sumDurations(lessons) {
  return lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0);
}

function buildLessonObjectives(lessonSeed) {
  return [
    `Understand the core concept in "${lessonSeed.title}".`,
    "Apply the concept in a practical implementation task.",
    "Validate the outcome against quality and correctness checks.",
  ];
}

function buildLessonInstructions(lessonSeed) {
  return [
    `Read the lesson brief and goal for "${lessonSeed.title}".`,
    "Implement the required changes in the starter files.",
    "Run the checks and confirm expected output before marking complete.",
  ];
}

function buildLessonBodyMarkdown(courseSeed, moduleSeed, lessonSeed) {
  return [
    `## ${lessonSeed.title}`,
    "",
    lessonSeed.summary || "This lesson focuses on practical application and production discipline.",
    "",
    "### Context",
    `Track: ${courseSeed.title}  •  Module: ${moduleSeed.title}`,
    "",
    "### Completion Checklist",
    "- Understand the concept and tradeoffs.",
    "- Implement the required change.",
    "- Verify expected output and quality.",
  ].join("\n");
}

function buildLessonStarterFiles(lessonSeed) {
  if (lessonSeed.contentType === "quiz") {
    return [];
  }

  if (lessonSeed.contentType === "project") {
    return [
      {
        path: "src/App.tsx",
        language: "tsx",
        content: [
          "export default function App() {",
          "  return (",
          "    <main>",
          "      {/* TODO: implement project requirements */}",
          `      <h1>${lessonSeed.title}</h1>`,
          "    </main>",
          "  );",
          "}",
        ].join("\n"),
      },
      {
        path: "README.md",
        language: "markdown",
        content: `# ${lessonSeed.title}\n\nImplement the project deliverable and verify expected behavior.`,
      },
    ];
  }

  return [
    {
      path: "src/App.tsx",
      language: "tsx",
      content: [
        "export default function App() {",
        "  return (",
        "    <main>",
        `      <h1>${lessonSeed.title}</h1>`,
        "      {/* TODO: complete the lesson exercise */}",
        "    </main>",
        "  );",
        "}",
      ].join("\n"),
    },
  ];
}

function buildExpectedOutput(lessonSeed) {
  if (lessonSeed.contentType === "quiz") {
    return ["Submit all answers and review explanation feedback."];
  }
  if (lessonSeed.contentType === "project") {
    return [
      "Feature implementation is complete.",
      "Code is readable and maintainable.",
      "Validation checks pass.",
    ];
  }
  return [
    "Concept is implemented in code.",
    "Output matches lesson requirement.",
  ];
}

function buildQuizQuestions(lessonSeed) {
  return [
    {
      prompt: `${lessonSeed.title}: Which approach is most production-ready?`,
      options: [
        "Define explicit inputs/outputs and validate edge cases.",
        "Rely on assumptions and skip validation to save time.",
        "Optimize before the feature works correctly.",
        "Hardcode behavior for the happy path only.",
      ],
      answerIndex: 0,
      explanation:
        "Production-ready code starts with explicit contracts and predictable behavior across edge cases.",
    },
    {
      prompt: `${lessonSeed.title}: What is the best way to improve maintainability?`,
      options: [
        "Keep logic isolated and responsibilities clear.",
        "Place all logic into one large function.",
        "Duplicate code to move faster.",
        "Avoid naming conventions or structure.",
      ],
      answerIndex: 0,
      explanation:
        "Separation of concerns and clear boundaries improve readability, testing, and long-term changes.",
    },
    {
      prompt: `${lessonSeed.title}: Which validation strategy is strongest?`,
      options: [
        "Validate user input and fail with clear errors.",
        "Ignore invalid input and continue silently.",
        "Only validate in the UI.",
        "Validate only in production after release.",
      ],
      answerIndex: 0,
      explanation:
        "Validation should happen at system boundaries with clear failure messages and safe defaults.",
    },
    {
      prompt: `${lessonSeed.title}: Which testing outcome matters most?`,
      options: [
        "Critical path behavior is verified and repeatable.",
        "Only lint passes while behavior is unchecked.",
        "Tests are skipped when deadlines are tight.",
        "Tests assert implementation details only.",
      ],
      answerIndex: 0,
      explanation:
        "Reliable tests cover behavior and outcomes, especially critical-path functionality.",
    },
    {
      prompt: `${lessonSeed.title}: What indicates this lesson is truly complete?`,
      options: [
        "Requirements, edge cases, and quality checks are all satisfied.",
        "The code compiles once on local machine only.",
        "The feature works for a single demo input.",
        "Only the UI was updated without logic validation.",
      ],
      answerIndex: 0,
      explanation:
        "Completion means correctness, robustness, and quality criteria are all met, not just superficial output.",
    },
  ];
}

async function resetSeedDomain(db) {
  const coursesCollection = db.collection("courses");
  const modulesCollection = db.collection("modules");
  const lessonsCollection = db.collection("lessons");
  const projectsCollection = db.collection("projects");
  const quizzesCollection = db.collection("quizzes");
  const projectSubmissionsCollection = db.collection("project_submissions");
  const quizAttemptsCollection = db.collection("quiz_attempts");
  const enrollmentsCollection = db.collection("enrollments");
  const progressCollection = db.collection("progress");
  const progressEventsCollection = db.collection("progress_events");
  const certificatesCollection = db.collection("certificates");

  const courses = await coursesCollection
    .find({
      tenantId,
      slug: { $in: curriculumSeedSlugs },
    })
    .project({ _id: 1 })
    .toArray();

  const courseIds = courses.map((item) => item._id);
  const moduleIds = (
    await modulesCollection
      .find({
        tenantId,
        courseId: { $in: courseIds },
      })
      .project({ _id: 1 })
      .toArray()
  ).map((item) => item._id);

  const [
    deletedProgress,
    deletedProgressEvents,
    deletedEnrollments,
    deletedCertificates,
    deletedLessons,
    deletedProjects,
    deletedProjectSubmissions,
    deletedQuizzes,
    deletedQuizAttempts,
    deletedModules,
    deletedCourses,
  ] = await Promise.all([
    progressCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    progressEventsCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    enrollmentsCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    certificatesCollection.deleteMany({
      tenantId,
      courseId: { $in: courseIds },
    }),
    lessonsCollection.deleteMany({
      tenantId,
      $or: [{ courseId: { $in: courseIds } }, { moduleId: { $in: moduleIds } }],
    }),
    projectsCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    projectSubmissionsCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    quizzesCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    quizAttemptsCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    modulesCollection.deleteMany({ tenantId, courseId: { $in: courseIds } }),
    coursesCollection.deleteMany({ tenantId, slug: { $in: curriculumSeedSlugs } }),
  ]);

  return {
    deletedProgress: deletedProgress.deletedCount,
    deletedProgressEvents: deletedProgressEvents.deletedCount,
    deletedEnrollments: deletedEnrollments.deletedCount,
    deletedCertificates: deletedCertificates.deletedCount,
    deletedLessons: deletedLessons.deletedCount,
    deletedProjects: deletedProjects.deletedCount,
    deletedProjectSubmissions: deletedProjectSubmissions.deletedCount,
    deletedQuizzes: deletedQuizzes.deletedCount,
    deletedQuizAttempts: deletedQuizAttempts.deletedCount,
    deletedModules: deletedModules.deletedCount,
    deletedCourses: deletedCourses.deletedCount,
  };
}

async function seedCourse(db, courseSeed) {
  const now = new Date();
  const coursesCollection = db.collection("courses");
  const modulesCollection = db.collection("modules");
  const lessonsCollection = db.collection("lessons");
  const projectsCollection = db.collection("projects");
  const quizzesCollection = db.collection("quizzes");

  const modulesCount = courseSeed.modules.length;
  const lessonsCount = courseSeed.modules.reduce(
    (total, module) => total + module.lessons.length,
    0
  );
  const durationMinutes = courseSeed.modules.reduce(
    (total, module) => total + sumDurations(module.lessons),
    0
  );

  const course = await coursesCollection.findOneAndUpdate(
    {
      tenantId,
      slug: courseSeed.slug,
    },
    {
      $set: {
        title: courseSeed.title,
        summary: courseSeed.summary,
        description: courseSeed.description,
        category: courseSeed.category,
        level: courseSeed.level,
        tags: courseSeed.tags,
        status: "published",
        visibility: "public",
        modulesCount,
        lessonsCount,
        durationMinutes,
        publishedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId,
        slug: courseSeed.slug,
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!course) {
    throw new Error(`Failed to seed course: ${courseSeed.slug}`);
  }

  const seededModuleIds = [];
  const seededModuleSlugs = [];
  const seededProjectSlugs = [];
  const seededQuizSlugs = [];
  let insertedLessons = 0;
  let insertedProjects = 0;
  let insertedQuizzes = 0;

  for (let moduleIndex = 0; moduleIndex < courseSeed.modules.length; moduleIndex += 1) {
    const moduleSeed = courseSeed.modules[moduleIndex];
    const moduleOrder = moduleIndex + 1;
    const moduleDuration = sumDurations(moduleSeed.lessons);
    const lessonsInModule = moduleSeed.lessons.length;

    const moduleDocument = await modulesCollection.findOneAndUpdate(
      {
        tenantId,
        courseId: course._id,
        slug: moduleSeed.slug,
      },
      {
        $set: {
          title: moduleSeed.title,
          description: moduleSeed.description,
          order: moduleOrder,
          durationMinutes: moduleDuration,
          lessonsCount: lessonsInModule,
          isPublished: true,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          tenantId,
          courseId: course._id,
          slug: moduleSeed.slug,
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    if (!moduleDocument) {
      throw new Error(
        `Failed to seed module: ${courseSeed.slug}/${moduleSeed.slug}`
      );
    }

    seededModuleIds.push(moduleDocument._id);
    seededModuleSlugs.push(moduleSeed.slug);

    const seededLessonSlugs = [];

    for (let lessonIndex = 0; lessonIndex < moduleSeed.lessons.length; lessonIndex += 1) {
      const lessonSeed = moduleSeed.lessons[lessonIndex];
      const lessonOrder = lessonIndex + 1;

      await lessonsCollection.findOneAndUpdate(
        {
          tenantId,
          moduleId: moduleDocument._id,
          slug: lessonSeed.slug,
        },
        {
          $set: {
            courseId: course._id,
            moduleId: moduleDocument._id,
            title: lessonSeed.title,
            summary: lessonSeed.summary,
            description: lessonSeed.summary,
            order: lessonOrder,
            durationMinutes: lessonSeed.durationMinutes,
            contentType: lessonSeed.contentType,
            isPreview: lessonSeed.isPreview,
            isPublished: true,
            videoUrl: lessonSeed.videoUrl ?? null,
            videoProvider: lessonSeed.videoProvider ?? null,
            learningObjectives: buildLessonObjectives(lessonSeed),
            instructions: buildLessonInstructions(lessonSeed),
            bodyMarkdown: buildLessonBodyMarkdown(
              courseSeed,
              moduleSeed,
              lessonSeed
            ),
            starterFiles: buildLessonStarterFiles(lessonSeed),
            expectedOutput: buildExpectedOutput(lessonSeed),
            updatedAt: now,
          },
          $setOnInsert: {
            _id: new ObjectId(),
            tenantId,
            slug: lessonSeed.slug,
            createdAt: now,
          },
        },
        {
          upsert: true,
        }
      );

      seededLessonSlugs.push(lessonSeed.slug);
      insertedLessons += 1;

      const lessonDocument = await lessonsCollection.findOne({
        tenantId,
        moduleId: moduleDocument._id,
        slug: lessonSeed.slug,
      });

      if (!lessonDocument) {
        throw new Error(
          `Failed to fetch seeded lesson: ${courseSeed.slug}/${moduleSeed.slug}/${lessonSeed.slug}`
        );
      }

      if (lessonSeed.contentType === "project") {
        const projectSlug = lessonSeed.slug;
        await projectsCollection.findOneAndUpdate(
          {
            tenantId,
            lessonId: lessonDocument._id,
          },
          {
            $set: {
              courseId: course._id,
              moduleId: moduleDocument._id,
              lessonId: lessonDocument._id,
              slug: projectSlug,
              title: `${lessonSeed.title} Project`,
              summary: lessonSeed.summary,
              order: lessonOrder,
              estimatedMinutes: lessonSeed.durationMinutes,
              isPublished: true,
              status: "published",
              rubric: [
                "Architecture quality",
                "Code clarity",
                "Feature completeness",
                "Testing discipline",
              ],
              updatedAt: now,
            },
            $setOnInsert: {
              _id: new ObjectId(),
              tenantId,
              createdAt: now,
            },
          },
          { upsert: true }
        );
        seededProjectSlugs.push(projectSlug);
        insertedProjects += 1;
      }

      if (lessonSeed.contentType === "quiz") {
        const quizSlug = lessonSeed.slug;
        const questions = buildQuizQuestions(lessonSeed);

        await quizzesCollection.findOneAndUpdate(
          {
            tenantId,
            lessonId: lessonDocument._id,
          },
          {
            $set: {
              courseId: course._id,
              moduleId: moduleDocument._id,
              lessonId: lessonDocument._id,
              slug: quizSlug,
              title: `${lessonSeed.title} Quiz`,
              summary: lessonSeed.summary,
              order: lessonOrder,
              passingScore: 70,
              timeLimitMinutes: Math.max(10, Math.ceil(lessonSeed.durationMinutes * 0.7)),
              questionCount: questions.length,
              questions,
              isPublished: true,
              status: "published",
              updatedAt: now,
            },
            $setOnInsert: {
              _id: new ObjectId(),
              tenantId,
              createdAt: now,
            },
          },
          { upsert: true }
        );
        seededQuizSlugs.push(quizSlug);
        insertedQuizzes += 1;
      }
    }

    await lessonsCollection.deleteMany({
      tenantId,
      moduleId: moduleDocument._id,
      slug: { $nin: seededLessonSlugs },
    });
  }

  await lessonsCollection.deleteMany({
    tenantId,
    courseId: course._id,
    moduleId: { $nin: seededModuleIds },
  });

  await modulesCollection.deleteMany({
    tenantId,
    courseId: course._id,
    slug: { $nin: seededModuleSlugs },
  });

  await projectsCollection.deleteMany({
    tenantId,
    courseId: course._id,
    slug: { $nin: seededProjectSlugs },
  });

  await quizzesCollection.deleteMany({
    tenantId,
    courseId: course._id,
    slug: { $nin: seededQuizSlugs },
  });

  return {
    courseId: course._id.toString(),
    courseSlug: courseSeed.slug,
    modules: modulesCount,
    lessons: insertedLessons,
    projects: insertedProjects,
    quizzes: insertedQuizzes,
    durationMinutes,
  };
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    let resetSummary = null;

    if (shouldResetFirst) {
      resetSummary = await resetSeedDomain(db);
    }

    const seeded = [];
    for (const course of curriculumSeedData) {
      // eslint-disable-next-line no-await-in-loop
      seeded.push(await seedCourse(db, course));
    }

    console.log("Curriculum seed: OK");
    console.log("Database:", dbName);
    console.log("Tenant:", tenantId);
    if (resetSummary) {
      console.log("Reset summary:", JSON.stringify(resetSummary));
    }
    for (const item of seeded) {
      console.log(
        `- ${item.courseSlug}: modules=${item.modules}, lessons=${item.lessons}, projects=${item.projects}, quizzes=${item.quizzes}, duration=${item.durationMinutes}m`
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Curriculum seed: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
