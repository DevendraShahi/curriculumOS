"use client";

import { useState } from "react";
import Link from "next/link";

const JOBS = [
  {
    id: "fe-engineer-vercel",
    title: "Frontend Engineer",
    company: "Vercel",
    location: "Remote · USA",
    type: "Full-time",
    level: "Mid",
    salary: "$140k – $180k",
    posted: "2d ago",
    tags: ["React", "Next.js", "TypeScript"],
    credentials: ["React Mastery", "TypeScript Fundamentals"],
    featured: true,
  },
  {
    id: "swe-stripe",
    title: "Software Engineer, Payments",
    company: "Stripe",
    location: "San Francisco, CA",
    type: "Full-time",
    level: "Senior",
    salary: "$200k – $250k",
    posted: "3d ago",
    tags: ["Node.js", "TypeScript", "Distributed Systems"],
    credentials: ["Backend Architecture"],
    featured: true,
  },
  {
    id: "react-native-shopify",
    title: "React Native Developer",
    company: "Shopify",
    location: "Remote · Canada",
    type: "Full-time",
    level: "Mid",
    salary: "$120k – $160k",
    posted: "5d ago",
    tags: ["React Native", "TypeScript", "Mobile"],
    credentials: ["React Mastery"],
    featured: false,
  },
  {
    id: "fe-intern-linear",
    title: "Frontend Engineer Intern",
    company: "Linear",
    location: "San Francisco, CA",
    type: "Internship",
    level: "Entry",
    salary: "$50 / hr",
    posted: "1w ago",
    tags: ["React", "CSS", "TypeScript"],
    credentials: ["React Fundamentals", "TypeScript Fundamentals"],
    featured: false,
  },
  {
    id: "fullstack-notion",
    title: "Fullstack Engineer",
    company: "Notion",
    location: "Remote · Global",
    type: "Full-time",
    level: "Senior",
    salary: "$160k – $210k",
    posted: "1w ago",
    tags: ["React", "Node.js", "PostgreSQL"],
    credentials: ["React Mastery", "Backend Architecture"],
    featured: false,
  },
  {
    id: "swe-junior-figma",
    title: "Software Engineer (New Grad)",
    company: "Figma",
    location: "New York, NY",
    type: "Full-time",
    level: "Entry",
    salary: "$130k – $150k",
    posted: "2w ago",
    tags: ["TypeScript", "WebGL", "React"],
    credentials: ["TypeScript Fundamentals"],
    featured: false,
  },
];

const LEVELS = ["All Levels", "Entry", "Mid", "Senior"];
const TYPES = ["All Types", "Full-time", "Internship"];

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All Levels");
  const [type, setType] = useState("All Types");

  const filtered = JOBS.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase());
    const matchLevel = level === "All Levels" || j.level === level;
    const matchType = type === "All Types" || j.type === type;
    return matchSearch && matchLevel && matchType;
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <h1 className="text-3xl font-medium tracking-tight text-[var(--foreground)] mb-2">Job Board</h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-8 max-w-lg">
            Roles matched to your Curriculum.OS credentials. Companies trust verified graduates from this platform.
          </p>
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles or companies..."
                className="w-full h-10 border border-[var(--border)] bg-[var(--background)] pl-9 pr-4 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            {/* Level filter */}
            <div className="flex gap-px bg-[var(--border)] border border-[var(--border)]">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`h-10 px-4 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${level === l ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                >
                  {l === "All Levels" ? "All" : l}
                </button>
              ))}
            </div>
            {/* Type filter */}
            <div className="flex gap-px bg-[var(--border)] border border-[var(--border)]">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`h-10 px-4 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${type === t ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                >
                  {t === "All Types" ? "All" : t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Job List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] mb-5">{filtered.length} positions found</div>

        {filtered.length === 0 ? (
          <div className="border border-[var(--border)] bg-[var(--surface)] p-16 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">No jobs match your filters.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
            {filtered.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className={`flex flex-col sm:flex-row gap-4 sm:items-center p-6 hover:bg-[var(--surface-2)] transition-colors group ${job.featured ? "bg-white" : "bg-[var(--surface)]"}`}
              >
                {/* Company placeholder */}
                <div className="w-10 h-10 border border-[var(--border)] bg-[var(--background)] flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] shrink-0">
                  {job.company.slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 flex-wrap mb-2">
                    <h2 className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{job.title}</h2>
                    {job.featured && <span className="border border-[var(--accent)] text-[var(--accent)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest shrink-0">Featured</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 items-center mb-3">
                    <span className="text-sm text-[var(--muted-foreground)]">{job.company}</span>
                    <span className="text-[var(--border)]">·</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{job.location}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((t) => (
                      <span key={t} className="border border-[var(--border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="sm:text-right shrink-0 flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-end flex-wrap">
                  <span className="font-mono text-[10px] text-[var(--foreground)] font-medium">{job.salary}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{job.type} · {job.level}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{job.posted}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
