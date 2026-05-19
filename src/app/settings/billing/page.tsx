"use client";

import { useState } from "react";
import Link from "next/link";

const invoices = [
  { id: "INV-2026-005", date: "May 1, 2026", amount: "$19.00", status: "Paid" },
  { id: "INV-2026-004", date: "Apr 1, 2026", amount: "$19.00", status: "Paid" },
  { id: "INV-2026-003", date: "Mar 1, 2026", amount: "$19.00", status: "Paid" },
  { id: "INV-2026-002", date: "Feb 1, 2026", amount: "$19.00", status: "Paid" },
  { id: "INV-2026-001", date: "Jan 1, 2026", amount: "$19.00", status: "Paid" },
];

export default function BillingPage() {
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Page Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/profile" className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer">Settings</Link>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">Billing</span>
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-[var(--foreground)]">Billing & Subscription</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">

        {/* Current Plan */}
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Current Plan</h2>
          <div className="border border-[var(--accent)] bg-[var(--surface)] p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--accent)]" />
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] font-bold">Curriculum Pro</span>
                  <span className="border border-[#21B8A8] text-[#21B8A8] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest">Active</span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">Annual plan · $19.00 / month · Renews <span className="text-[var(--foreground)]">June 1, 2026</span></p>
              </div>
              <div className="flex gap-3 shrink-0">
                <Link href="/pricing" className="h-9 px-5 flex items-center border border-[var(--border)] bg-[var(--background)] font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-pointer">
                  Change Plan
                </Link>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="h-9 px-5 border border-[var(--border)] font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:border-red-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Method */}
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Payment Method</h2>
          <div className="border border-[var(--border)] bg-[var(--surface)] p-6 flex items-center gap-5 justify-between">
            <div className="flex items-center gap-4">
              {/* Card icon */}
              <div className="w-12 h-8 border border-[var(--border)] bg-[var(--background)] flex items-center justify-center font-mono text-[9px] text-[var(--muted-foreground)] uppercase tracking-widest">
                VISA
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">•••• •••• •••• 4242</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] mt-0.5">Expires 08 / 2028</p>
              </div>
            </div>
            <button className="h-9 px-5 border border-[var(--border)] font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-pointer">
              Update
            </button>
          </div>
        </section>

        {/* Invoice History */}
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Invoice History</h2>
          <div className="border border-[var(--border)] bg-[var(--border)] flex flex-col gap-px">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_100px_80px] gap-px bg-[var(--border)]">
              {["Invoice", "Date", "Amount", ""].map((h, i) => (
                <div key={i} className="bg-[var(--surface-2)] px-5 py-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{h}</span>
                </div>
              ))}
            </div>

            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[1fr_120px_100px_80px] gap-px bg-[var(--border)]">
                <div className="bg-[var(--surface)] px-5 py-4">
                  <span className="font-mono text-[11px] text-[var(--foreground)]">{inv.id}</span>
                </div>
                <div className="bg-[var(--surface)] px-5 py-4">
                  <span className="font-mono text-[11px] text-[var(--muted-foreground)]">{inv.date}</span>
                </div>
                <div className="bg-[var(--surface)] px-5 py-4">
                  <span className="font-mono text-[11px] text-[var(--foreground)]">{inv.amount}</span>
                </div>
                <div className="bg-[var(--surface)] px-5 py-4 flex items-center">
                  <button className="font-mono text-[9px] uppercase tracking-widest text-[var(--accent)] hover:opacity-70 transition-opacity cursor-pointer">
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1">Danger Zone</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Delete Account</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">This permanently removes all your data, progress, and certificates. This cannot be undone.</p>
            </div>
            <button className="h-9 px-5 shrink-0 border border-red-300 font-mono text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50 hover:border-red-500 transition-colors cursor-pointer">
              Delete Account
            </button>
          </div>
        </section>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--border)] p-8 w-full max-w-md mx-4">
            <h3 className="text-xl font-medium text-[var(--foreground)] tracking-tight mb-3">Cancel Subscription?</h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-8">
              Your Pro access will continue until <strong className="text-[var(--foreground)]">June 1, 2026</strong>, then your account will revert to the Free plan. All your progress and certificates will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="h-10 px-6 border border-[var(--border)] font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-pointer"
              >
                Keep Plan
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="h-10 px-6 border border-red-300 font-mono text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50 hover:border-red-500 transition-colors cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
