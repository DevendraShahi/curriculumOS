import { requireAdmin } from "@/lib/auth-admin";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Manage Users</h1>
        <p className="text-[var(--muted-foreground)] mt-1 text-sm">
          View and manage platform users and their roles.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-sm">
        <Users className="mx-auto h-12 w-12 text-[var(--muted-foreground)] opacity-50 mb-4" />
        <h3 className="text-lg font-medium text-[var(--foreground)]">User Management Coming Soon</h3>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
          In the future, you will be able to search for users, view their progress, and assign roles directly from this interface.
        </p>
      </div>
    </div>
  );
}
