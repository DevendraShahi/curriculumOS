import { ObjectId, type Db } from "mongodb";
import { userPreferencesCollection } from "@/lib/db/collections";
import type { UserPreferencesDocument } from "@/lib/db/models";

export type UserPreferencesPatch = {
  profileVisibility?: "public" | "private";
  emailDigestEnabled?: boolean;
  inAppNotificationsEnabled?: boolean;
  preferredEditorTheme?: "system" | "light" | "dark";
  weeklyLearningGoalMinutes?: number | null;
};

export async function getUserPreferences(
  db: Db,
  tenantId: string,
  userId: ObjectId
): Promise<UserPreferencesDocument | null> {
  return userPreferencesCollection(db).findOne({
    tenantId,
    userId,
  });
}

export async function upsertUserPreferences(
  db: Db,
  params: {
    tenantId: string;
    userId: ObjectId;
    patch: UserPreferencesPatch;
  }
): Promise<UserPreferencesDocument> {
  const now = new Date();
  const setFields: Record<string, unknown> = {
    updatedAt: now,
  };
  const setOnInsertFields: Record<string, unknown> = {
    _id: new ObjectId(),
    tenantId: params.tenantId,
    userId: params.userId,
    createdAt: now,
  };
  const unsetFields: Record<string, "" | 1> = {};

  if (params.patch.profileVisibility !== undefined) {
    setFields.profileVisibility = params.patch.profileVisibility;
  } else {
    setOnInsertFields.profileVisibility = "public";
  }
  if (params.patch.emailDigestEnabled !== undefined) {
    setFields.emailDigestEnabled = params.patch.emailDigestEnabled;
  } else {
    setOnInsertFields.emailDigestEnabled = true;
  }
  if (params.patch.inAppNotificationsEnabled !== undefined) {
    setFields.inAppNotificationsEnabled = params.patch.inAppNotificationsEnabled;
  } else {
    setOnInsertFields.inAppNotificationsEnabled = true;
  }
  if (params.patch.preferredEditorTheme !== undefined) {
    setFields.preferredEditorTheme = params.patch.preferredEditorTheme;
  } else {
    setOnInsertFields.preferredEditorTheme = "system";
  }
  if (params.patch.weeklyLearningGoalMinutes !== undefined) {
    if (params.patch.weeklyLearningGoalMinutes === null) {
      unsetFields.weeklyLearningGoalMinutes = "";
    } else {
      setFields.weeklyLearningGoalMinutes = params.patch.weeklyLearningGoalMinutes;
    }
  }

  const document = await userPreferencesCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      userId: params.userId,
    },
    {
      $set: setFields,
      $setOnInsert: setOnInsertFields,
      ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!document) {
    const fallback = await userPreferencesCollection(db).findOne({
      tenantId: params.tenantId,
      userId: params.userId,
    });
    if (!fallback) {
      throw new Error("INTERNAL_ERROR");
    }
    return fallback;
  }

  return document;
}
