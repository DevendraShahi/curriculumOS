import Link from "next/link";
import { LayoutDashboard, BookOpen, Users, LogOut } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export const metadata = {
  title: "Admin Portal | Curriculum",
  description: "Curriculum platform administration",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[var(--background)]">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 flex flex-col shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="h-16 flex items-center px-6 border-b border-[var(--border)]">
          <Link href="/admin" className="text-sm font-semibold tracking-widest uppercase">
            Platform <span className="text-[var(--accent)]">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link 
            href="/admin" 
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <LayoutDashboard size={18} />
            Overview
          </Link>
          <Link 
            href="/admin/courses" 
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <BookOpen size={18} />
            Courses
          </Link>
          <Link 
            href="/admin/users" 
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Users size={18} />
            Users
          </Link>
        </nav>

        <div className="p-4 border-t border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserButton />
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Admin</span>
          </div>
          <Link href="/" title="Exit Admin" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <LogOut size={16} />
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[var(--background)]">
        {children}
      </main>
    </div>
  );
}
