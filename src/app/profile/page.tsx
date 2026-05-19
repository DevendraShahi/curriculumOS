import Image from "next/image";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
import { getProfileOverview } from "@/lib/services/profile-service";
import type { WeeklyMetricCell } from "@/lib/services/progress-metrics-service";
import { ProfilePreferencesPanel } from "@/app/profile/_components/profile-preferences-panel";

function formatDateShort(value: Date | number | string | null | undefined): string {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function daysSince(value: Date | number | string | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "U";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getHeatmapCellClass(intensity: WeeklyMetricCell["intensity"]): string {
  switch (intensity) {
    case 4:
      return "bg-gradient-to-br from-[var(--accent)] to-blue-800";
    case 3:
      return "bg-gradient-to-br from-blue-500 to-[var(--accent)]";
    case 2:
      return "bg-gradient-to-br from-blue-400 to-blue-600";
    case 1:
      return "bg-gradient-to-br from-blue-200 to-blue-400";
    default:
      return "border border-blue-200 bg-transparent";
  }
}

export default async function ProfilePage() {
  const authState = await auth();
  const { isAuthenticated, redirectToSignIn } = authState;
  if (!isAuthenticated) return redirectToSignIn();

  const user = await currentUser();
  if (!user) return redirectToSignIn();

  const actor: ActorContext = {
    clerkUserId: user.id,
    orgId: authState.orgId ?? null,
    tenantId: resolveTenantId(authState.orgId),
    clerkUser: user,
  };
  const overview = await getProfileOverview(actor);

  const displayName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    "Learner";

  const primaryEmail =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress ||
    "No email";

  const isEmailVerified = (user.emailAddresses ?? []).some(
    (email) => email.verification?.status === "verified"
  );

  const statusText = isEmailVerified
    ? "Identity Verified"
    : "Verification Pending";

  const telemetry = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
      value: `${daysSince(overview.createdAt)}d`,
      label: "Account Age",
      locked: false,
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      ),
      value: String(overview.activity.totalUpdates),
      label: "13W Updates",
      locked: false,
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.56 2.9A7 7 0 0 1 19 9l.5 2"/><path d="M20 13a10.003 10.003 0 0 1-9.895 10A10 10 0 0 1 3 13a7 7 0 0 1 7-7"/><path d="M12 12v.01"/></svg>
      ),
      value: String(overview.stats.quizAttempts),
      label: "Quiz Attempts",
      locked: false,
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><path d="M10 14 21 3"/><path d="M21 16v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
      ),
      value: String(overview.stats.projectSubmissions),
      label: "Project Submits",
      locked: false,
    },
  ];

  const staticConfigs = [
    {
      label: "Email Verified",
      desc: `Primary email: ${primaryEmail}`,
      enabled: isEmailVerified,
    },
    {
      label: "Two-Factor Authentication",
      desc: "Multi-factor protection for your account.",
      enabled: user.twoFactorEnabled,
    },
    {
      label: "Profile Image Set",
      desc: `Last sign in: ${formatDateShort(user.lastSignInAt)}`,
      enabled: user.hasImage,
    },
  ];

  // Runtime heatmap — 13 weeks, 7 rows × 13 columns
  const heatmapCols = 13;
  const heatmapRows = 7;
  const maxHeatmapCells = heatmapCols * heatmapRows;
  const latestCells = overview.activity.cells.slice(-maxHeatmapCells);
  const heatmapByRow = Array.from({ length: heatmapRows }, () =>
    Array.from(
      { length: heatmapCols },
      () => 0 as WeeklyMetricCell["intensity"]
    )
  );

  for (let index = 0; index < latestCells.length; index += 1) {
    const cell = latestCells[index];
    const col = Math.floor(index / heatmapRows);
    const row = index % heatmapRows;
    if (col >= heatmapCols) break;
    heatmapByRow[row][col] = cell.intensity;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-12 sm:px-6">
      {/* Profile Header */}
      <section
        aria-label="Profile header"
        className="flex items-center gap-6 border-b border-[var(--border)] pb-8"
      >
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
          {user.hasImage ? (
            <Image
              src={user.imageUrl}
              alt={displayName}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-mono text-base uppercase tracking-widest text-[var(--muted-foreground)]">
              {getInitials(displayName)}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">
            {displayName.toUpperCase()}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isEmailVerified ? "bg-[var(--accent)]" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
              {statusText}
            </p>
          </div>
        </div>
      </section>

      {/* Telemetry Data */}
      <section className="mt-10" aria-label="Telemetry Data">
        <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Telemetry Data
        </h2>
        <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
          {telemetry.map((t, i) => (
            <div
              key={i}
              className={`relative flex min-h-[180px] flex-col justify-between bg-[var(--surface)] p-6 ${t.locked ? "select-none" : ""}`}
            >
              {/* Icon top */}
              <div
                className={
                  t.locked ? "text-[var(--border)]" : "text-[var(--muted-foreground)]"
                }
              >
                {t.icon}
              </div>
              {/* Value bottom */}
              <div className={t.locked ? "pointer-events-none blur-sm" : ""}>
                <p className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                  {t.value}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  {t.label}
                </p>
              </div>
              {/* Lock overlay */}
              {t.locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--border)]" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <ProfilePreferencesPanel
        initialPreferences={overview.preferences}
        staticConfigs={staticConfigs}
      />

      {/* Commit Matrix */}
      <section className="mt-10" aria-label="Commit Matrix">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Commit Matrix (Last 13 Weeks)
          </h2>
          <span
            className={`font-mono text-[10px] uppercase tracking-widest ${
              overview.activity.streakDays >= 3
                ? "text-[var(--accent)]"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            {overview.activity.streakDays >= 3 ? "System Optimal" : "Needs Momentum"}
          </span>
        </div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-[3px]">
            {heatmapByRow.map((cells, row) => (
              <div key={row} className="flex gap-[3px]">
                {cells.map((intensity, col) => (
                  <span
                    key={col}
                    className={`block h-[14px] w-[14px] box-border ${getHeatmapCellClass(
                      intensity
                    )}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              {formatDateShort(latestCells[0]?.dayStartMs)}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              {formatDateShort(overview.activity.generatedAt)}
            </p>
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {overview.activity.totalUpdates} updates · {overview.activity.activeDays} active days
            · {overview.activity.completedEvents} completions
          </p>
        </div>
      </section>
    </main>
  );
}
