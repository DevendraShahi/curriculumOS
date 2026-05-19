"use client";

import Link from "next/link";

const JOB = {
  id: "fe-engineer-vercel",
  title: "Frontend Engineer",
  company: "Vercel",
  location: "Remote · USA",
  type: "Full-time",
  level: "Mid",
  salary: "$140k – $180k",
  posted: "2d ago",
  tags: ["React", "Next.js", "TypeScript", "Performance", "CSS"],
  credentials: ["React Mastery", "TypeScript Fundamentals"],
  about: "Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration. We enable teams from around the world to ship the best web experiences. Our suite of products—Next.js, Vercel deployments, analytics, and edge functions—power billions of requests each month.",
  responsibilities: [
    "Build and maintain core product UI features using React and Next.js App Router.",
    "Collaborate with design to implement pixel-perfect, accessible, and highly performant interfaces.",
    "Own the performance of your features — profiling, optimizing, and measuring Core Web Vitals.",
    "Write well-tested, well-documented, production-ready code that ships every sprint.",
    "Participate in technical design discussions and code reviews.",
  ],
  requirements: [
    "3+ years of experience building production React applications.",
    "Deep knowledge of TypeScript — not just as a type layer, but as a design tool.",
    "Strong understanding of web performance: rendering, bundling, lazy loading, caching.",
    "Familiarity with Next.js App Router, RSC, and streaming patterns.",
    "Experience writing tests (Jest, Playwright, Vitest).",
  ],
  niceToHave: [
    "Experience contributing to open-source projects.",
    "Familiarity with edge runtimes (Cloudflare Workers, Vercel Edge Functions).",
    "Prior work in design systems or component library development.",
  ],
};

export default function JobDetailPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/jobs" className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer">Jobs</Link>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] truncate">{JOB.title}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
            <div className="flex gap-5 items-start">
              <div className="w-14 h-14 border border-[var(--border)] bg-[var(--background)] flex items-center justify-center font-mono text-[11px] uppercase tracking-widest text-[var(--foreground)] shrink-0">
                {JOB.company.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-3xl font-medium tracking-tight text-[var(--foreground)] mb-1">{JOB.title}</h1>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="text-sm text-[var(--muted-foreground)]">{JOB.company}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{JOB.location}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{JOB.type}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">{JOB.salary}</span>
                </div>
              </div>
            </div>
            <button className="shrink-0 h-11 px-8 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity cursor-pointer">
              Apply Now
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 lg:gap-10">

        {/* Main JD */}
        <article className="space-y-10">

          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">About {JOB.company}</h2>
            <p className="text-sm text-[var(--foreground)] leading-relaxed">{JOB.about}</p>
          </section>

          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Responsibilities</h2>
            <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
              {JOB.responsibilities.map((item, i) => (
                <div key={i} className="flex gap-5 items-start px-6 py-4 bg-[var(--surface)]">
                  <span className="font-mono text-[9px] text-[var(--muted-foreground)] pt-0.5 shrink-0 w-4">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Requirements</h2>
            <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
              {JOB.requirements.map((item, i) => (
                <div key={i} className="flex gap-5 items-start px-6 py-4 bg-[var(--surface)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className="text-[var(--accent)] mt-0.5 shrink-0" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">Nice to Have</h2>
            <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
              {JOB.niceToHave.map((item, i) => (
                <div key={i} className="flex gap-5 items-start px-6 py-4 bg-[var(--surface)]">
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)] mt-0.5 shrink-0">+</span>
                  <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Apply CTA */}
          <div className="border border-[var(--accent)] bg-[var(--accent)]/5 p-8 flex flex-col sm:flex-row gap-6 items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-1">Ready to apply?</p>
              <p className="text-xs text-[var(--muted-foreground)]">Your Curriculum.OS credentials will be attached automatically.</p>
            </div>
            <button className="shrink-0 h-11 px-10 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity cursor-pointer">
              Apply Now
            </button>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="space-y-6 shrink-0">
          {/* Credential match */}
          <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Credential Match</h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4 leading-relaxed">This role requires these Curriculum.OS certificates:</p>
            <div className="flex flex-col gap-2">
              {JOB.credentials.map((c) => (
                <div key={c} className="flex items-center gap-3 p-3 border border-[var(--border)] bg-[var(--background)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="text-[var(--accent)] shrink-0" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Tech Stack</h2>
            <div className="flex flex-wrap gap-1.5">
              {JOB.tags.map((t) => (
                <span key={t} className="border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)]">{t}</span>
              ))}
            </div>
          </div>

          {/* Quick facts */}
          <div className="border border-[var(--border)] bg-[var(--border)] flex flex-col gap-px">
            {[["Posted", JOB.posted], ["Level", JOB.level], ["Type", JOB.type], ["Salary", JOB.salary]].map(([label, val]) => (
              <div key={label} className="flex justify-between items-center px-5 py-3 bg-[var(--surface)]">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{label}</span>
                <span className="font-mono text-[10px] text-[var(--foreground)]">{val}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
