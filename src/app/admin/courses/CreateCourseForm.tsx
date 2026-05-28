/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useTransition } from "react";
import { createDraftCourseAction, importCourseJsonAction } from "./actions";
import { Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateCourseForm() {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"manual" | "json">("manual");
  const [importJson, setImportJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const router = useRouter();

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createDraftCourseAction(formData);
        (e.target as HTMLFormElement).reset();
      } catch (err: any) {
        alert("Failed to create course: " + err.message);
      }
    });
  };

  const validateAndImportJson = () => {
    setJsonError(null);
    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch (e) {
      setJsonError("Invalid JSON syntax.");
      return;
    }

    if (!parsed.title || !parsed.slug) {
      setJsonError("JSON must include at least 'title' and 'slug' at the root.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await importCourseJsonAction(importJson);
        if (res.success && res.courseId) {
          router.push(`/admin/courses/${res.courseId}`);
        }
      } catch (err: any) {
        setJsonError(err.message);
      }
    });
  };

  const loadTemplate = () => {
    setJsonError(null);
    setImportJson(JSON.stringify({
      title: "Advanced Next.js Architecture",
      slug: "advanced-nextjs-architecture",
      description: "Master Next.js App Router.",
      summary: "A deep dive into Next.js 15.",
      category: "Engineering",
      level: "advanced",
      tags: ["nextjs", "react", "architecture"],
      status: "draft"
    }, null, 2));
  };

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] mb-8 flex flex-col gap-px bg-[var(--border)]">
      <div className="bg-[var(--surface-2)] p-0 flex border-b border-[var(--border)]">
        <button 
          onClick={() => setMode("manual")}
          className={`flex-1 p-4 text-left font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === "manual" ? "bg-[var(--surface)] text-[var(--foreground)] border-b-2 border-[var(--accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface)]"}`}
        >
          Manual Creation
        </button>
        <button 
          onClick={() => setMode("json")}
          className={`flex-1 p-4 text-left font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === "json" ? "bg-[var(--surface)] text-[var(--foreground)] border-b-2 border-[var(--accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface)]"}`}
        >
          JSON Import
        </button>
      </div>

      {mode === "manual" ? (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-px bg-[var(--border)]">
          <div className="bg-[var(--surface)] p-4 flex gap-4">
            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Title</label>
              <input 
                name="title" 
                required 
                placeholder="e.g., Advanced Next.js"
                className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]" 
              />
            </div>
            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Slug</label>
              <input 
                name="slug" 
                required 
                placeholder="e.g., advanced-nextjs"
                className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]" 
              />
            </div>
          </div>
          <div className="bg-[var(--surface)] p-4">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Description</label>
            <textarea 
              name="description" 
              className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] resize-y min-h-[60px]" 
            />
          </div>
          <div className="bg-[var(--surface-2)] p-4 flex justify-end">
            <button 
              type="submit" 
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 rounded-none"
            >
              <Plus size={14} />
              {isPending ? "CREATING..." : "CREATE COURSE"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-px bg-[var(--border)]">
          <div className="bg-[var(--surface)] p-4">
            <div className="flex justify-between items-center mb-4">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Paste Course JSON</label>
              <button 
                onClick={loadTemplate}
                className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                LOAD COURSE TEMPLATE
              </button>
            </div>
            <textarea
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value);
                setJsonError(null);
              }}
              className="w-full h-64 p-4 bg-[#0a0a0a] text-[#00ff00] font-mono text-sm border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] resize-y rounded-none"
              placeholder="Paste JSON here..."
              spellCheck={false}
            />
            {jsonError && (
              <div className="mt-2 text-red-500 font-mono text-[10px] uppercase tracking-widest">
                ERROR: {jsonError}
              </div>
            )}
          </div>
          <div className="bg-[var(--surface-2)] p-4 flex justify-end">
            <button 
              onClick={validateAndImportJson}
              disabled={isPending || !importJson.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 rounded-none"
            >
              <Upload size={14} />
              {isPending ? "IMPORTING..." : "VALIDATE & IMPORT COURSE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
