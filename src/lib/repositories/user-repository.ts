import { ObjectId, type Db, type Filter } from "mongodb";
import { usersCollection } from "@/lib/db/collections";
import type { UserDocument, UserRole } from "@/lib/db/models";

type UpsertUserInput = {
  tenantId: string;
  clerkUserId: string;
  email: string;
  username?: string;
  fullName: string;
  imageUrl?: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
  unsafeMetadata?: Record<string, unknown>;
  lastSignInAt?: Date;
};

function normalizeRoles(roles?: UserRole[]): UserRole[] {
  if (!roles || roles.length === 0) return ["learner"];
  return Array.from(new Set(roles));
}

export async function upsertUserFromIdentity(
  db: Db,
  input: UpsertUserInput
): Promise<UserDocument> {
  const now = new Date();

  const filter: Filter<UserDocument> = {
    tenantId: input.tenantId,
    clerkUserId: input.clerkUserId,
  };

  const document = await usersCollection(db).findOneAndUpdate(
    filter,
    {
      $set: {
        email: input.email,
        emailLower: input.email.toLowerCase(),
        username: input.username,
        usernameLower: input.username?.toLowerCase(),
        fullName: input.fullName,
        imageUrl: input.imageUrl,
        isEmailVerified: input.isEmailVerified,
        twoFactorEnabled: input.twoFactorEnabled,
        publicMetadata: input.publicMetadata,
        privateMetadata: input.privateMetadata,
        unsafeMetadata: input.unsafeMetadata,
        lastSignInAt: input.lastSignInAt,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: input.tenantId,
        clerkUserId: input.clerkUserId,
        roles: normalizeRoles(),
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!document) {
    throw new Error("Failed to upsert user");
  }

  return document;
}

export async function getUserByClerkId(
  db: Db,
  tenantId: string,
  clerkUserId: string
): Promise<UserDocument | null> {
  return usersCollection(db).findOne({
    tenantId,
    clerkUserId,
  });
}

export async function countUsersByTenant(
  db: Db,
  tenantId: string
): Promise<number> {
  return usersCollection(db).countDocuments({ tenantId });
}
