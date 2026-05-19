"use client";

import { useState } from "react";
import Link from "next/link";

const features = [
  { label: "Courses Included", free: "3 Intro Courses", pro: "All 40+ Courses", teams: "All 40+ Courses" },
  { label: "Interactive Sandbox", free: "Limited", pro: "Unlimited", teams: "Unlimited" },
  { label: "Focus Sessions", free: "5 / month", pro: "Unlimited", teams: "Unlimited" },
  { label: "AI Tutor Requests", free: "10 / month", pro: "Unlimited", teams: "Unlimited" },
  { label: "Certificates", free: false, pro: "Verifiable PDF", teams: "Verifiable PDF" },
  { label: "Community Access", free: true, pro: true, teams: true },
  { label: "Progress Analytics", free: "Basic", pro: "Advanced", teams: "Team Dashboard" },
  { label: "Human Mentorship", free: false, pro: false, teams: "2 sessions/mo" },
  { label: "Seat Management", free: false, pro: false, teams: "Up to 25 seats" },
  { label: "Priority Support", free: false, pro: true, teams: "Dedicated CSM" },
];

function Check({ ok }: { ok: boolean | string }) {
  if (ok === false) return <span className="font-mono text-[9px] text-[var(--muted-foreground)]">—</span>;
  if (ok === true) return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className="text-[var(--accent)]" aria-label="Included"><polyline points="20 6 9 17 4 12"/></svg>
  );
  return <span className="font-mono text-[10px] text-[var(--foreground)]">{ok}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      id: "free",
      name: "Free",
      price: { monthly: 0, annual: 0 },
      tagline: "Start learning with no commitment.",
      cta: "Get Started",
      href: "/sign-up",
      highlight: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: { monthly: 29, annual: 19 },
      tagline: "Everything you need to go from beginner to professional.",
      cta: "Upgrade to Pro",
      href: "/settings/billing",
      highlight: true,
    },
    {
      id: "teams",
      name: "Teams",
      price: { monthly: 49, annual: 35 },
      tagline: "Upskill your whole engineering team.",
      cta: "Contact Sales",
      href: "mailto:sales@curriculum.os",
      highlight: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
          <h1 className="text-4xl font-medium tracking-tight text-[var(--foreground)] mb-4">Simple, Transparent Pricing</h1>
          <p className="text-[var(--muted-foreground)] text-sm max-w-md mx-auto leading-relaxed mb-10">
            Start free. Upgrade when you need more. No hidden fees, no lock-in.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-px bg-[var(--border)] border border-[var(--border)] p-px">
            <button
              onClick={() => setAnnual(false)}
              className={`h-8 px-5 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${!annual ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`h-8 px-5 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2 ${annual ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              Annual
              <span className={`font-mono text-[8px] px-1.5 py-0.5 tracking-widest ${annual ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-[var(--muted-foreground)]"}`}>
                SAVE 35%
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Tier cards */}
        <div className="bg-[var(--border)] border border-[var(--border)] grid grid-cols-1 md:grid-cols-3 gap-px mb-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`p-8 flex flex-col gap-6 relative ${tier.highlight ? "bg-white" : "bg-[var(--surface)]"}`}
            >
              {tier.highlight && (
                <div className="absolute top-0 left-0 w-full h-1 bg-[var(--accent)]" />
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${tier.highlight ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>
                    {tier.name}
                  </span>
                  {tier.highlight && (
                    <span className="border border-[var(--accent)] text-[var(--accent)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest">Most Popular</span>
                  )}
                </div>
                <div className="flex items-end gap-1 mt-4">
                  <span className={`text-4xl font-medium tracking-tight ${tier.highlight ? "text-[#111]" : "text-[var(--foreground)]"}`}>
                    ${annual ? tier.price.annual : tier.price.monthly}
                  </span>
                  {tier.price.monthly > 0 && (
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)] pb-1.5 uppercase tracking-widest">/mo</span>
                  )}
                </div>
                {annual && tier.price.monthly > 0 && (
                  <p className="font-mono text-[9px] text-[var(--muted-foreground)] uppercase tracking-widest mt-1">
                    Billed annually · ${tier.price.annual * 12}/yr
                  </p>
                )}
                <p className="mt-4 text-sm text-[var(--muted-foreground)] leading-relaxed">{tier.tagline}</p>
              </div>

              <Link
                href={tier.href}
                className={`h-10 flex items-center justify-center font-mono text-[10px] uppercase tracking-widest transition-opacity cursor-pointer mt-auto ${
                  tier.highlight
                    ? "bg-[var(--accent)] text-white hover:opacity-90"
                    : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--foreground)]"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Full Feature Comparison</h2>
        <div className="border border-[var(--border)] bg-[var(--border)] flex flex-col gap-px overflow-x-auto">
          {/* Header Row */}
          <div className="bg-[var(--surface)] grid grid-cols-[1fr_repeat(3,120px)] gap-px bg-[var(--border)]">
            <div className="bg-[var(--surface)] px-5 py-3" />
            {tiers.map((t) => (
              <div key={t.id} className="bg-[var(--surface)] px-4 py-3 text-center">
                <span className={`font-mono text-[10px] uppercase tracking-widest ${t.highlight ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>{t.name}</span>
              </div>
            ))}
          </div>

          {features.map((feat) => (
            <div key={feat.label} className="grid grid-cols-[1fr_repeat(3,120px)] gap-px bg-[var(--border)]">
              <div className="bg-[var(--surface)] px-5 py-3.5">
                <span className="text-sm text-[var(--foreground)]">{feat.label}</span>
              </div>
              {([feat.free, feat.pro, feat.teams] as Array<boolean | string>).map((val, i) => (
                <div key={i} className="bg-[var(--surface)] px-4 py-3.5 flex items-center justify-center">
                  <Check ok={val} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
          All plans include a 14-day free trial of Pro. No credit card required.
        </p>
      </div>
    </div>
  );
}
