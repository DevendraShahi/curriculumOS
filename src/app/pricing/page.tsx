"use client";

import { useState } from "react";
import Link from "next/link";
import { Sprout, Zap, Users, Building2 } from "lucide-react";

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="text-[var(--foreground)] shrink-0 mt-[2px]" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const features = [
  { label: "Courses Included",         free: "Free courses",    pro: "Free + Pro",           teams: "Free + Pro + Bootcamps", business: "All content" },
  { label: "Interactive Sandbox",      free: "Limited",         pro: "Unlimited",             teams: "Unlimited",              business: "Unlimited" },
  { label: "Additional Exercises",     free: false,             pro: true,                    teams: true,                     business: true },
  { label: "AI Tutor Requests",        free: false,             pro: "Unlimited",             teams: "Unlimited",              business: "Unlimited" },
  { label: "Beta Features Access",     free: false,             pro: true,                    teams: true,                     business: true },
  { label: "Focus Sessions",           free: "5 / month",       pro: "Unlimited",             teams: "Unlimited",              business: "Unlimited" },
  { label: "Certificates",             free: false,             pro: "Verifiable PDF",        teams: "Verifiable PDF",         business: "Verifiable PDF" },
  { label: "Community Access",         free: true,              pro: true,                    teams: true,                     business: true },
  { label: "Progress Analytics",       free: "Basic",           pro: "Advanced",              teams: "Team Dashboard",         business: "Institution-wide" },
  { label: "Live Course Enrollment",   free: false,             pro: false,                   teams: "Cohort sessions",        business: false },
  { label: "Team & Class Management",  free: false,             pro: false,                   teams: "Unlimited seats",        business: false },
  { label: "Library Management",       free: false,             pro: false,                   teams: false,                    business: true },
  { label: "Result Management",        free: false,             pro: false,                   teams: false,                    business: true },
  { label: "Attendance Management",    free: false,             pro: false,                   teams: false,                    business: true },
  { label: "Admin SaaS Dashboard",     free: false,             pro: false,                   teams: false,                    business: true },
  { label: "API Access",               free: false,             pro: false,                   teams: false,                    business: "Full REST API" },
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
  const [waitlistCount, setWaitlistCount] = useState(0);

  const handleWaitlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setWaitlistCount(prev => prev + 1);
    alert("Thanks for your interest! We've recorded your vote for Pro features.");
  };

  const tiers = [
    {
      id: "free",
      name: "Free",
      priceDisplay: "$0",
      tagline: "A launchpad for your tech career. 11 weeks of unrestricted foundational access — absolutely free.",
      cta: "Get Started",
      href: "/sign-up",
      highlight: false,
      featuresList: [
        "Free courses access",
        "Limited Interactive Sandbox",
        "5 Focus Sessions / month",
        "Community Access",
        "Basic Progress Analytics",
      ],
      icon: (
        <div className="w-11 h-11 border border-[var(--border)] flex items-center justify-center bg-[var(--surface-2)]">
          <Sprout size={20} className="text-[var(--muted-foreground)]" strokeWidth={1.5} />
        </div>
      )
    },
    {
      id: "pro",
      name: "Pro",
      priceDisplay: annual ? "$19" : "$29",
      tagline: "Master modern engineering. Full course library, unlimited AI sandbox, and pro-level exercises to land the job.",
      cta: waitlistCount > 0 ? `Waitlist joined (${waitlistCount} interested)` : "Join Waitlist",
      href: "#",
      onClick: handleWaitlistClick,
      highlight: true,
      monthlyPrice: 29,
      annualPrice: 19,
      featuresList: [
        "Free + Pro courses access",
        "Unlimited Interactive Sandbox",
        "Unlimited AI Tutor Requests",
        "Additional Exercises & Beta Features",
        "Verifiable PDF Certificates",
      ],
      icon: (
        <div className="w-11 h-11 border border-[var(--accent)] flex items-center justify-center bg-[var(--accent)]/10">
          <Zap size={20} className="text-[var(--accent)]" strokeWidth={1.5} />
        </div>
      )
    },
    {
      id: "teams",
      name: "Teams",
      priceDisplay: "Custom",
      tagline: "For educators running live cohorts. Enroll learners into live courses, manage classes, and track team progress in real time.",
      cta: "Contact Sales",
      href: "mailto:sales@curriculum.os",
      highlight: false,
      featuresList: [
        "Everything in Pro",
        "Live course cohort enrollment",
        "Class & session management",
        "Team Dashboard analytics",
        "Unlimited seats",
      ],
      icon: (
        <div className="w-11 h-11 border border-[var(--border)] flex items-center justify-center bg-[var(--surface-2)]">
          <Users size={20} className="text-[var(--muted-foreground)]" strokeWidth={1.5} />
        </div>
      )
    },
    {
      id: "business",
      name: "Business",
      priceDisplay: "Custom",
      tagline: "Full institution-grade SaaS. Manage your library, attendance, results, and entire academic workflow from one dashboard.",
      cta: "Contact Sales",
      href: "mailto:sales@curriculum.os",
      highlight: false,
      featuresList: [
        "Everything in Teams",
        "Library management system",
        "Result & grade management",
        "Attendance tracking",
        "Institution-wide admin SaaS dashboard",
        "Full REST API access",
      ],
      icon: (
        <div className="w-11 h-11 border border-[var(--border)] flex items-center justify-center bg-[var(--surface-2)]">
          <Building2 size={20} className="text-[var(--muted-foreground)]" strokeWidth={1.5} />
        </div>
      )
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Tier cards — 4 columns */}
        <div className="bg-[var(--border)] border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px mb-16">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`flex flex-col relative ${tier.highlight ? "bg-[var(--surface-2)]" : "bg-[var(--surface)]"}`}
            >
              {/* Top section */}
              <div className="p-7 pb-5 flex flex-col items-start border-b border-[var(--border)]">
                <div className="mb-5">
                  {tier.icon}
                </div>
                <h3 className="font-semibold text-lg text-[var(--foreground)] tracking-tight">
                  {tier.name}
                </h3>
              </div>

              {/* Bottom section */}
              <div className="p-7 pt-5 flex flex-col flex-grow">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
                    {tier.priceDisplay}
                  </span>
                  {tier.monthlyPrice && tier.monthlyPrice > 0 ? (
                    <span className="text-sm text-[var(--foreground)] font-medium">/month</span>
                  ) : tier.id === "free" ? (
                    <span className="text-sm text-[var(--foreground)] font-medium">/month</span>
                  ) : null}
                </div>

                {annual && tier.monthlyPrice && tier.monthlyPrice > 0 ? (
                  <p className="font-mono text-[9px] text-[var(--accent)] uppercase tracking-widest font-semibold mt-1 mb-2">
                    Billed annually · ${tier.annualPrice! * 12}/yr
                  </p>
                ) : (
                  <div className="h-[18px] mt-1 mb-2" />
                )}

                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-7">
                  {tier.tagline}
                </p>

                <ul className="flex flex-col gap-3 mb-8 flex-grow">
                  {tier.featuresList.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[var(--foreground)]">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {tier.onClick ? (
                    <button
                      onClick={tier.onClick}
                      className={`w-full h-11 rounded-none flex items-center justify-center font-semibold text-sm transition-all cursor-pointer ${
                        tier.highlight
                          ? "bg-[var(--accent)] text-white hover:opacity-90"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]"
                      }`}
                    >
                      {tier.cta}
                    </button>
                  ) : (
                    <Link
                      href={tier.href}
                      className={`w-full h-11 rounded-none flex items-center justify-center font-semibold text-sm transition-all cursor-pointer ${
                        tier.highlight
                          ? "bg-[var(--accent)] text-white hover:opacity-90"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]"
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Section labels */}
        <div className="mb-5 flex items-center gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Full Feature Comparison</h2>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Feature comparison table — 5 columns */}
        <div className="border border-[var(--border)] bg-[var(--border)] flex flex-col gap-px overflow-x-auto">
          {/* Header Row */}
          <div className="bg-[var(--surface)] grid grid-cols-[1fr_repeat(4,110px)] gap-px bg-[var(--border)]">
            <div className="bg-[var(--surface)] px-5 py-3" />
            {tiers.map((t) => (
              <div key={t.id} className="bg-[var(--surface)] px-3 py-3 text-center">
                <span className={`font-mono text-[9px] uppercase tracking-widest ${t.highlight ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>{t.name}</span>
              </div>
            ))}
          </div>

          {features.map((feat) => (
            <div key={feat.label} className="grid grid-cols-[1fr_repeat(4,110px)] gap-px bg-[var(--border)]">
              <div className="bg-[var(--surface)] px-5 py-3.5">
                <span className="text-sm text-[var(--foreground)]">{feat.label}</span>
              </div>
              {([feat.free, feat.pro, feat.teams, feat.business] as Array<boolean | string>).map((val, i) => (
                <div key={i} className="bg-[var(--surface)] px-3 py-3.5 flex items-center justify-center">
                  <Check ok={val} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Divider between learner and institution features */}
        <div className="mt-10 mb-5 flex items-center gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] whitespace-nowrap">Teams — Live Learning</h2>
          <div className="flex-1 h-px bg-[var(--border)]" />
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] whitespace-nowrap">Business — Institution SaaS</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)] mb-12">
          {/* Teams callout */}
          <div className="bg-[var(--surface)] p-8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Teams Plan</p>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-3 tracking-tight">Live Cohort Learning</h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6">
              Designed for educators and bootcamp instructors. Enroll students into live course sessions, manage class schedules, and monitor team-wide progress dashboards.
            </p>
            <ul className="flex flex-col gap-2.5 text-sm text-[var(--foreground)]">
              {["Live course cohort enrollment", "Session & class management", "Real-time team dashboard", "Unlimited learner seats"].map(f => (
                <li key={f} className="flex items-start gap-3"><CheckIcon /><span>{f}</span></li>
              ))}
            </ul>
          </div>

          {/* Business callout */}
          <div className="bg-[var(--surface)] p-8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Business Plan</p>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-3 tracking-tight">Institution SaaS Platform</h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6">
              A complete academic management layer on top of the curriculum platform. Run your institution end-to-end — from library and attendance to results and reporting.
            </p>
            <ul className="flex flex-col gap-2.5 text-sm text-[var(--foreground)]">
              {["Library management system", "Attendance tracking & reports", "Result & grade management", "Full admin SaaS dashboard", "REST API access"].map(f => (
                <li key={f} className="flex items-start gap-3"><CheckIcon /><span>{f}</span></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
          MVP Trial: All members get 11 weeks of access free. No credit card required.{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--foreground)] transition-colors">Terms & conditions apply.</Link>
        </p>
      </div>
    </div>
  );
}
