"use client";

import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type NavChild = {
  label: string;
  href: string;
  disabled?: boolean;
};

type NavItem = {
  label: string;
  href?: string;
  children?: NavChild[];
  disabled?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "Learning",
    children: [
      { label: "Dashboard", href: "/" },
      { label: "Curriculum", href: "/curriculum" },
      { label: "Tracks", href: "/tracks" },
      { label: "Projects", href: "/projects" },
    ],
  },
  {
    label: "Practice",
    children: [
      { label: "Playground", href: "/playground" },
      { label: "Sandbox", href: "/playground/sandbox" },
      { label: "Focus Timer", href: "/focus" },
    ],
  },
  {
    label: "Community",
    children: [
      { label: "All Discussions", href: "/community" },
      { label: "New Thread", href: "/community/new" },
      { label: "Tags", href: "/community/tags" },
      { label: "Guidelines", href: "/community/guidelines" },
      { label: "Leaderboard", href: "/leaderboard" },
    ],
  },
  {
    label: "Pricing",
    href: "/pricing",
  },
  {
    label: "Account",
    children: [
      { label: "Profile", href: "/profile" },
      { label: "Settings", href: "/settings/billing" },
      { label: "Jobs", href: "/jobs", disabled: true },
    ],
  },
];

function isActivePath(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { userId } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      body: string;
      actionUrl: string | null;
      readAt: string | null;
      createdAt: string;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(
    null
  );

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const response = await fetch("/api/v1/notifications?limit=8", {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | {
            ok: true;
            data: {
              items: Array<{
                id: string;
                title: string;
                body: string;
                actionUrl: string | null;
                readAt: string | null;
                createdAt: string;
              }>;
              unreadCount: number;
            };
          }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        setNotificationsError("Unable to load notifications.");
        return;
      }
      setNotifications(payload.data.items);
      setUnreadCount(payload.data.unreadCount);
    } catch {
      setNotificationsError("Unable to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }, [userId]);

  async function markNotificationRead(notificationId: string) {
    if (!userId) return;
    setMarkingNotificationId(notificationId);
    try {
      const response = await fetch(
        `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
        }
      );
      const payload = (await response.json()) as
        | {
            ok: true;
            data: {
              id: string;
              readAt: string | null;
            };
          }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                readAt: payload.data.readAt,
              }
            : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } finally {
      setMarkingNotificationId(null);
    }
  }

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Logo */}
        <Link href="/" className="text-xl font-bold tracking-tight text-[var(--foreground)] w-48">
          CURRICULUM.OS
        </Link>

        {/* Center: Desktop Navigation */}
        <nav aria-label="Primary" className="hidden md:flex flex-1 justify-center">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isOpen = openDropdown === item.label;
              const active = item.href ? isActivePath(pathname, item.href) : 
                item.children?.some(child => isActivePath(pathname, child.href));

              return (
                <li key={item.label} className="relative">
                  {hasChildren ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(isOpen ? null : item.label)}
                        className={`relative inline-flex items-center gap-1 px-3 py-2 text-[13px] font-medium transition-colors ${
                          active ? "text-[var(--accent)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {item.label}
                        <svg 
                          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                          <ul className="py-1">
                            {item.children!.map((child) => (
                              <li key={child.href}>
                                {child.disabled ? (
                                  <span className="flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed">
                                    {child.label}
                                    <span className="font-mono text-[9px] uppercase bg-[var(--surface-2)] px-1.5 py-0.5 rounded">Soon</span>
                                  </span>
                                ) : (
                                  <Link
                                    href={child.href}
                                    onClick={() => setOpenDropdown(null)}
                                    className={`block px-3 py-2 text-[12px] transition-colors ${
                                      isActivePath(pathname, child.href) 
                                        ? "text-[var(--accent)] bg-[var(--accent)]/5" 
                                        : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                                    }`}
                                  >
                                    {child.label}
                                  </Link>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href!}
                      className={`relative inline-flex items-center px-3 py-2 text-[13px] font-medium transition-colors ${
                        active ? "text-[var(--accent)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: Actions & Auth */}
        <div className="hidden items-center gap-4 md:flex justify-end w-72">
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              disabled={!userId}
              onClick={() => {
                if (!userId) return;
                const nextOpen = !notificationsOpen;
                setNotificationsOpen(nextOpen);
                if (nextOpen) {
                  void loadNotifications();
                }
              }}
              className="relative text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
              {userId && unreadCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen && userId ? (
              <div className="absolute right-0 top-8 z-50 w-80 border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Notifications
                  </p>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    Close
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notificationsLoading ? (
                    <p className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      Loading...
                    </p>
                  ) : notificationsError ? (
                    <p className="px-3 py-3 text-xs text-red-600">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      No notifications
                    </p>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="border-b border-[var(--border)] px-3 py-2 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--foreground)]">
                              {notification.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                              {notification.body}
                            </p>
                          </div>
                          {notification.readAt ? null : (
                            <button
                              type="button"
                              disabled={markingNotificationId === notification.id}
                              onClick={() => void markNotificationRead(notification.id)}
                              className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)] disabled:opacity-60"
                            >
                              Read
                            </button>
                          )}
                        </div>
                        {notification.actionUrl ? (
                          <Link
                            href={notification.actionUrl}
                            className="mt-2 inline-flex font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Command Palette"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" x2="20" y1="19" y2="19"/>
            </svg>
          </button>

          <Show when="signed-out">
            <SignInButton mode="redirect">
              <button
                type="button"
                className="inline-flex h-9 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button
                type="button"
                className="inline-flex h-9 items-center bg-[var(--accent)] px-4 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Sign Up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label="Toggle mobile menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-gray-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:hidden"
        >
          <span className="font-mono text-lg">{mobileOpen ? "×" : "≡"}</span>
        </button>
      </div>

      {/* Mobile navigation */}
      {mobileOpen ? (
        <nav aria-label="Mobile" className="border-t border-[var(--border)] bg-[var(--surface)] md:hidden max-h-[calc(100vh-80px)] overflow-y-auto overflow-x-hidden">
          <ul className="px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const active = item.href ? isActivePath(pathname, item.href) : 
                item.children?.some(child => isActivePath(pathname, child.href));
              
              if (hasChildren) {
                return (
                  <li key={item.label}>
                    <div className="px-3 py-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                        {item.label}
                      </span>
                    </div>
                    <ul className="pl-4 space-y-1">
                      {item.children!.map((child) => (
                        <li key={child.label}>
                          {child.disabled ? (
                            <span className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted-foreground)] opacity-50">
                              {child.label}
                              <span className="font-mono text-[9px] uppercase bg-[var(--surface-2)] px-1.5 py-0.5 rounded">Soon</span>
                            </span>
                          ) : (
                            <Link
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={`block px-3 py-2 text-sm ${
                                isActivePath(pathname, child.href) 
                                  ? "text-[var(--accent)]" 
                                  : "text-[var(--foreground)]"
                              }`}
                            >
                              {child.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              }
              
              return (
                <li key={item.label}>
                  <Link
                    href={item.href!}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center px-3 py-3 text-sm font-medium ${
                      active ? "text-[var(--accent)] bg-[var(--accent)]/10" : "text-[var(--muted-foreground)] hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--border)] px-4 py-4">
            <div className="flex items-center gap-2">
              <Show when="signed-out">
                <SignInButton mode="redirect">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center border border-[var(--border)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center bg-[var(--accent)] px-4 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-blue-700"
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
