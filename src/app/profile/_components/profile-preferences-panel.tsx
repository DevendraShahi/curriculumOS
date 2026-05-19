"use client";

import { useState } from "react";

type ProfilePreferences = {
  profileVisibility: "public" | "private";
  emailDigestEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  preferredEditorTheme: "system" | "light" | "dark";
  weeklyLearningGoalMinutes: number | null;
};

type StaticConfig = {
  label: string;
  desc: string;
  enabled: boolean;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: string;
};

function messageForPreferencesError(code: string): string {
  if (code === "UNAUTHORIZED") {
    return "Sign in again to update preferences.";
  }
  if (code === "INVALID_PROFILE_PREFERENCES") {
    return "Invalid preference value. Please review your input.";
  }
  return "Unable to save preferences right now. Please retry.";
}

async function patchPreferences(
  patch: Partial<ProfilePreferences>
): Promise<ProfilePreferences> {
  const response = await fetch("/api/v1/profile/preferences", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  const payload = (await response.json()) as
    | ApiSuccess<ProfilePreferences>
    | ApiFailure;

  if (!response.ok || !payload.ok) {
    const code = "error" in payload ? payload.error : "INTERNAL_ERROR";
    throw new Error(code || "INTERNAL_ERROR");
  }

  return payload.data;
}

export function ProfilePreferencesPanel(props: {
  initialPreferences: ProfilePreferences;
  staticConfigs: StaticConfig[];
}) {
  const [preferences, setPreferences] = useState(props.initialPreferences);
  const [weeklyGoalInput, setWeeklyGoalInput] = useState(
    props.initialPreferences.weeklyLearningGoalMinutes?.toString() ?? ""
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function applyPatch(
    patch: Partial<ProfilePreferences>,
    key: string,
    options?: { syncWeeklyGoalInput?: boolean }
  ) {
    setBusyKey(key);
    setError(null);
    setNotice(null);

    try {
      const updated = await patchPreferences(patch);
      setPreferences(updated);
      if (options?.syncWeeklyGoalInput) {
        setWeeklyGoalInput(updated.weeklyLearningGoalMinutes?.toString() ?? "");
      }
      setNotice("Preferences saved.");
    } catch (patchError) {
      const code = patchError instanceof Error ? patchError.message : "INTERNAL_ERROR";
      setError(messageForPreferencesError(code));
    } finally {
      setBusyKey(null);
    }
  }

  function parseWeeklyGoalInput(): number | null {
    const normalized = weeklyGoalInput.trim();
    if (!normalized) return null;
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error("INVALID_PROFILE_PREFERENCES");
    }
    return parsed;
  }

  async function saveWeeklyGoal() {
    try {
      const weeklyLearningGoalMinutes = parseWeeklyGoalInput();
      await applyPatch(
        {
          weeklyLearningGoalMinutes,
        },
        "weeklyLearningGoalMinutes",
        { syncWeeklyGoalInput: true }
      );
    } catch {
      setError("Weekly goal must be a whole number between 0 and 10080.");
    }
  }

  return (
    <section className="mt-10" aria-label="System Configurations">
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
        System Configurations
      </h2>

      <div className="space-y-3">
        {error ? (
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="mt-3 divide-y divide-[var(--border)] border border-[var(--border)]">
        {props.staticConfigs.map((config) => (
          <div
            key={config.label}
            className="flex items-center justify-between gap-6 bg-[var(--surface)] px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {config.label}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {config.desc}
              </p>
            </div>
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                config.enabled ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"
              }`}
            >
              {config.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between gap-6 bg-[var(--surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Public Profile</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Controls visibility of your profile data.
            </p>
          </div>
          <button
            role="switch"
            type="button"
            aria-checked={preferences.profileVisibility === "public"}
            aria-label="Toggle public profile visibility"
            disabled={busyKey !== null}
            onClick={() =>
              void applyPatch(
                {
                  profileVisibility:
                    preferences.profileVisibility === "public" ? "private" : "public",
                },
                "profileVisibility"
              )
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-sm transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60 ${
              preferences.profileVisibility === "public"
                ? "bg-[var(--accent)]"
                : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-sm bg-white shadow-sm transition-transform duration-200 ${
                preferences.profileVisibility === "public"
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-6 bg-[var(--surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Email Digest</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Receive periodic learning summaries by email.
            </p>
          </div>
          <button
            role="switch"
            type="button"
            aria-checked={preferences.emailDigestEnabled}
            aria-label="Toggle email digest"
            disabled={busyKey !== null}
            onClick={() =>
              void applyPatch(
                {
                  emailDigestEnabled: !preferences.emailDigestEnabled,
                },
                "emailDigestEnabled"
              )
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-sm transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60 ${
              preferences.emailDigestEnabled
                ? "bg-[var(--accent)]"
                : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-sm bg-white shadow-sm transition-transform duration-200 ${
                preferences.emailDigestEnabled ? "translate-x-6" : "translate-x-1"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-6 bg-[var(--surface)] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              In-App Notifications
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Show in-app notification updates and alerts.
            </p>
          </div>
          <button
            role="switch"
            type="button"
            aria-checked={preferences.inAppNotificationsEnabled}
            aria-label="Toggle in-app notifications"
            disabled={busyKey !== null}
            onClick={() =>
              void applyPatch(
                {
                  inAppNotificationsEnabled: !preferences.inAppNotificationsEnabled,
                },
                "inAppNotificationsEnabled"
              )
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-sm transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60 ${
              preferences.inAppNotificationsEnabled
                ? "bg-[var(--accent)]"
                : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-sm bg-white shadow-sm transition-transform duration-200 ${
                preferences.inAppNotificationsEnabled
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="flex flex-col gap-3 bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Editor Theme</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Choose preferred editor theme mode.
            </p>
          </div>
          <div className="inline-flex gap-2">
            {(["system", "light", "dark"] as const).map((theme) => {
              const active = preferences.preferredEditorTheme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() =>
                    void applyPatch({ preferredEditorTheme: theme }, "preferredEditorTheme")
                  }
                  className={`h-8 border px-3 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-60 ${
                    active
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]"
                      : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--foreground)]"
                  }`}
                >
                  {theme}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Weekly Goal (minutes)
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Set a weekly learning target from 0 to 10080 minutes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={10080}
              step={1}
              inputMode="numeric"
              value={weeklyGoalInput}
              onChange={(event) => setWeeklyGoalInput(event.target.value)}
              className="h-9 w-28 border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs text-[var(--foreground)]"
            />
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() => void saveWeeklyGoal()}
              className="h-9 border border-[var(--border)] px-3 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:border-[var(--foreground)] disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
