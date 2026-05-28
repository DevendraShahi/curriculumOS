import { ObjectId } from "mongodb";
import { coursesCollection, lessonsCollection, modulesCollection } from "@/lib/db/collections";
import { getEnrollment } from "@/lib/repositories/enrollment-repository";
import {
  countProjectSubmissionsByStatus,
  createProjectSubmission,
  getLatestProjectSubmissionByUser,
  listProjectSubmissionsByUser,
} from "@/lib/repositories/project-submission-repository";
import {
  getPublishedProjectByIdOrSlug,
  listPublishedProjects,
} from "@/lib/repositories/project-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalUrl(value: unknown): string | undefined {
  const raw = normalizeOptionalString(value);
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("INVALID_URL");
    }
    return parsed.toString();
  } catch {
    throw new Error("INVALID_URL");
  }
}

export async function listPublicProjectsService(params: {
  tenantId: string;
  actor?: ActorContext | null;
  limit?: number;
}) {
  const db = await getMongoDb();
  const projects = await listPublishedProjects(db, {
    tenantId: params.tenantId,
    limit: params.limit,
  });

  const courseIds = Array.from(
    new Map(projects.map((item) => [item.courseId.toString(), item.courseId])).values()
  );
  const moduleIds = Array.from(
    new Map(projects.map((item) => [item.moduleId.toString(), item.moduleId])).values()
  );
  const lessonIds = Array.from(
    new Map(
      projects
        .filter((item) => item.lessonId && item.lessonId instanceof ObjectId)
        .map((item) => [item.lessonId!.toString(), item.lessonId as ObjectId])
    ).values()
  );

  const [courseRows, moduleRows, lessonRows] = await Promise.all([
    coursesCollection(db)
      .find({ tenantId: params.tenantId, _id: { $in: courseIds } })
      .project({ _id: 1, slug: 1, title: 1 })
      .toArray(),
    modulesCollection(db)
      .find({ tenantId: params.tenantId, _id: { $in: moduleIds } })
      .project({ _id: 1, slug: 1, title: 1 })
      .toArray(),
    lessonsCollection(db)
      .find({ tenantId: params.tenantId, _id: { $in: lessonIds } })
      .project({ _id: 1, slug: 1, title: 1 })
      .toArray(),
  ]);

  const courseMap = new Map(courseRows.map((item) => [item._id.toString(), item]));
  const moduleMap = new Map(moduleRows.map((item) => [item._id.toString(), item]));
  const lessonMap = new Map(lessonRows.map((item) => [item._id.toString(), item]));

  let viewerSubmissionMap = new Map<
    string,
    {
      status: string;
      submittedAt: string;
    }
  >();

  if (params.actor) {
    const user = await syncActorToUserDocument(params.actor);
    const submissions = await listProjectSubmissionsByUser(db, {
      tenantId: params.tenantId,
      userId: user._id,
      limit: 200,
    });

    viewerSubmissionMap = new Map();
    for (const submission of submissions) {
      const key = submission.projectId.toString();
      if (!viewerSubmissionMap.has(key)) {
        viewerSubmissionMap.set(key, {
          status: submission.status,
          submittedAt: submission.submittedAt.toISOString(),
        });
      }
    }
  }

  return projects.map((project) => {
    const foundCourse = courseMap.get(project.courseId.toString()) ?? null;
    const foundModule = moduleMap.get(project.moduleId.toString()) ?? null;
    const foundLesson = project.lessonId && project.lessonId instanceof ObjectId
      ? lessonMap.get(project.lessonId.toString()) ?? null
      : null;

    return {
      id: project._id.toString(),
      slug: project.slug,
      title: project.title,
      summary: project.summary ?? "",
      estimatedMinutes: project.estimatedMinutes,
      rubric: project.rubric,
      course: foundCourse
        ? {
            id: foundCourse._id.toString(),
            slug: foundCourse.slug,
            title: foundCourse.title,
          }
        : null,
      module: foundModule
        ? {
            id: foundModule._id.toString(),
            slug: foundModule.slug,
            title: foundModule.title,
          }
        : null,
      lesson: foundLesson
        ? {
            id: foundLesson._id.toString(),
            slug: foundLesson.slug,
            title: foundLesson.title,
          }
        : null,
      viewerLatestSubmission: viewerSubmissionMap.get(project._id.toString()) ?? null,
    };
  });
}

export async function getPublicProjectDetailService(params: {
  tenantId: string;
  projectIdOrSlug: string;
  actor?: ActorContext | null;
}) {
  const db = await getMongoDb();
  const project = await getPublishedProjectByIdOrSlug(db, {
    tenantId: params.tenantId,
    projectIdOrSlug: params.projectIdOrSlug,
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const [course, module, lesson, submissionStats] = await Promise.all([
    coursesCollection(db).findOne(
      { tenantId: params.tenantId, _id: project.courseId },
      { projection: { _id: 1, slug: 1, title: 1 } }
    ),
    modulesCollection(db).findOne(
      { tenantId: params.tenantId, _id: project.moduleId },
      { projection: { _id: 1, slug: 1, title: 1 } }
    ),
    project.lessonId && project.lessonId instanceof ObjectId
      ? lessonsCollection(db).findOne(
          { tenantId: params.tenantId, _id: project.lessonId },
          { projection: { _id: 1, slug: 1, title: 1 } }
        )
      : Promise.resolve(null),
    countProjectSubmissionsByStatus(db, {
      tenantId: params.tenantId,
      projectId: project._id,
    }),
  ]);

  let viewer = null as
    | {
        latestSubmission: {
          id: string;
          status: string;
          submittedAt: string;
        } | null;
      }
    | null;

  if (params.actor) {
    const user = await syncActorToUserDocument(params.actor);
    const latest = await getLatestProjectSubmissionByUser(db, {
      tenantId: params.tenantId,
      userId: user._id,
      projectId: project._id,
    });

    viewer = {
      latestSubmission: latest
        ? {
            id: latest._id.toString(),
            status: latest.status,
            submittedAt: latest.submittedAt.toISOString(),
          }
        : null,
    };
  }

  return {
    id: project._id.toString(),
    slug: project.slug,
    title: project.title,
    summary: project.summary ?? "",
    estimatedMinutes: project.estimatedMinutes,
    rubric: project.rubric,
    course: course
      ? { id: course._id.toString(), slug: course.slug, title: course.title }
      : null,
    module: module
      ? { id: module._id.toString(), slug: module.slug, title: module.title }
      : null,
    lesson: lesson
      ? { id: lesson._id.toString(), slug: lesson.slug, title: lesson.title }
      : null,
    stats: {
      submissions: submissionStats,
    },
    viewer,
  };
}

export async function submitCurrentActorProject(
  actor: ActorContext,
  params: {
    projectIdOrSlug: string;
    summary?: unknown;
    repositoryUrl?: unknown;
    liveUrl?: unknown;
    notes?: unknown;
  }
) {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const project = await getPublishedProjectByIdOrSlug(db, {
    tenantId: actor.tenantId,
    projectIdOrSlug: params.projectIdOrSlug,
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const enrollment = await getEnrollment(
    db,
    actor.tenantId,
    user._id,
    project.courseId
  );

  if (!enrollment) {
    throw new Error("ENROLLMENT_REQUIRED");
  }

  const submission = await createProjectSubmission(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    courseId: project.courseId,
    moduleId: project.moduleId,
    lessonId: project.lessonId instanceof ObjectId ? project.lessonId : undefined,
    projectId: project._id,
    enrollmentId: enrollment._id,
    summary: normalizeOptionalString(params.summary),
    repositoryUrl: normalizeOptionalUrl(params.repositoryUrl),
    liveUrl: normalizeOptionalUrl(params.liveUrl),
    notes: normalizeOptionalString(params.notes),
  });

  return {
    id: submission._id.toString(),
    projectId: submission.projectId.toString(),
    status: submission.status,
    submittedAt: submission.submittedAt.toISOString(),
    summary: submission.summary ?? null,
    repositoryUrl: submission.repositoryUrl ?? null,
    liveUrl: submission.liveUrl ?? null,
    notes: submission.notes ?? null,
  };
}

export async function listCurrentActorProjectSubmissions(
  actor: ActorContext,
  params: {
    projectIdOrSlug: string;
    limit?: number;
  }
) {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);
  const project = await getPublishedProjectByIdOrSlug(db, {
    tenantId: actor.tenantId,
    projectIdOrSlug: params.projectIdOrSlug,
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const submissions = await listProjectSubmissionsByUser(db, {
    tenantId: actor.tenantId,
    userId: user._id,
    projectId: project._id,
    limit: params.limit,
  });

  return submissions.map((submission) => ({
    id: submission._id.toString(),
    status: submission.status,
    submittedAt: submission.submittedAt.toISOString(),
    summary: submission.summary ?? null,
    repositoryUrl: submission.repositoryUrl ?? null,
    liveUrl: submission.liveUrl ?? null,
    notes: submission.notes ?? null,
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
  }));
}

export function parseProjectLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

export function parseProjectObjectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error("INVALID_PROJECT_ID");
  }

  return new ObjectId(value);
}
