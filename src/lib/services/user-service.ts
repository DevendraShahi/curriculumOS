import { ObjectId } from "mongodb";
import { countIssuedCertificates } from "@/lib/repositories/certificate-repository";
import {
  countEnrollmentsByStatus,
  listEnrollmentsByUser,
} from "@/lib/repositories/enrollment-repository";
import { countProgressByStateAcrossCourses } from "@/lib/repositories/progress-repository";
import { countPublishedLessonsByCourses } from "@/lib/repositories/syllabus-repository";
import { upsertUserFromIdentity } from "@/lib/repositories/user-repository";
import { getMongoDb } from "@/lib/mongodb";
import type { ActorContext } from "@/lib/services/auth-context";

function toDate(value: number | Date | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function toEmailVerified(actor: ActorContext): boolean {
  return (actor.clerkUser.emailAddresses ?? []).some(
    (email) => email.verification?.status === "verified"
  );
}

export async function syncActorToUserDocument(actor: ActorContext) {
  const db = await getMongoDb();
  const primaryEmail =
    actor.clerkUser.primaryEmailAddress?.emailAddress ??
    actor.clerkUser.emailAddresses?.[0]?.emailAddress ??
    `${actor.clerkUserId}@unknown.local`;

  const fullName =
    actor.clerkUser.fullName ||
    [actor.clerkUser.firstName, actor.clerkUser.lastName]
      .filter(Boolean)
      .join(" ") ||
    actor.clerkUser.username ||
    actor.clerkUserId;

  return upsertUserFromIdentity(db, {
    tenantId: actor.tenantId,
    clerkUserId: actor.clerkUserId,
    email: primaryEmail,
    username: actor.clerkUser.username ?? undefined,
    fullName,
    imageUrl: actor.clerkUser.imageUrl ?? undefined,
    isEmailVerified: toEmailVerified(actor),
    twoFactorEnabled: actor.clerkUser.twoFactorEnabled,
    publicMetadata:
      (actor.clerkUser.publicMetadata as Record<string, unknown>) ?? {},
    privateMetadata:
      (actor.clerkUser.privateMetadata as Record<string, unknown>) ?? {},
    unsafeMetadata:
      (actor.clerkUser.unsafeMetadata as Record<string, unknown>) ?? {},
    lastSignInAt: toDate(actor.clerkUser.lastSignInAt),
  });
}

export async function getMe(actor: ActorContext) {
  const db = await getMongoDb();
  const user = await syncActorToUserDocument(actor);

  const [enrollmentCounts, enrollments, certificateCount] = await Promise.all([
    countEnrollmentsByStatus(db, actor.tenantId, user._id),
    listEnrollmentsByUser(db, actor.tenantId, user._id),
    countIssuedCertificates(db, actor.tenantId, user._id),
  ]);

  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const [lessonTotalsByCourse, completedLessons, inProgressLessons] =
    await Promise.all([
      countPublishedLessonsByCourses(db, actor.tenantId, courseIds),
      countProgressByStateAcrossCourses(
        db,
        actor.tenantId,
        user._id,
        "completed",
        courseIds
      ),
      countProgressByStateAcrossCourses(
        db,
        actor.tenantId,
        user._id,
        "in_progress",
        courseIds
      ),
    ]);

  const totalLessons = Array.from(lessonTotalsByCourse.values()).reduce(
    (total, value) => total + value,
    0
  );

  const progressSummary = {
    totalLessons,
    completedLessons,
    inProgressLessons,
    completionPercent:
      totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
  };

  return {
    id: user._id.toString(),
    tenantId: user.tenantId,
    clerkUserId: user.clerkUserId,
    fullName: user.fullName,
    email: user.email,
    username: user.username ?? null,
    imageUrl: user.imageUrl ?? null,
    roles: user.roles,
    isEmailVerified: user.isEmailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    stats: {
      enrollments: enrollmentCounts,
      progress: progressSummary,
      certificatesIssued: certificateCount,
    },
  };
}

export function parseObjectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error("INVALID_OBJECT_ID");
  }
  return new ObjectId(value);
}
