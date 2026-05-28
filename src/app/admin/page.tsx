import { requireAdmin } from "@/lib/auth-admin";
import { BookOpen, Users, Activity } from "lucide-react";
import Link from "next/link";

export default async function AdminOverviewPage() {
  // Ensure user is admin (though middleware also protects, this is best practice)
  await requireAdmin();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Admin Overview</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          Welcome to the platform administration portal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">Total Courses</h2>
            <BookOpen size={20} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-semibold text-[var(--foreground)]">--</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">Total Users</h2>
            <Users size={20} className="text-blue-500" />
          </div>
          <p className="text-3xl font-semibold text-[var(--foreground)]">--</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium tracking-wide text-[var(--muted-foreground)] uppercase">Active Sessions</h2>
            <Activity size={20} className="text-amber-500" />
          </div>
          <p className="text-3xl font-semibold text-[var(--foreground)]">--</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4 bg-[var(--surface-2)]">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--foreground)] uppercase">Quick Actions</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/admin/courses"
            className="flex flex-col items-start p-4 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
          >
            <span className="font-medium text-[var(--foreground)] mb-1">Manage Courses</span>
            <span className="text-xs text-[var(--muted-foreground)]">Import and sync course seed data.</span>
          </Link>
          
          <Link 
            href="/admin/users"
            className="flex flex-col items-start p-4 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
          >
            <span className="font-medium text-[var(--foreground)] mb-1">Manage Users</span>
            <span className="text-xs text-[var(--muted-foreground)]">View registered users and roles.</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
