/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useLessonBuilder } from "../LessonBuilderContext";

export function ResourceBlock({ id, data }: { id: string; data: any }) {
  const { updateBlock } = useLessonBuilder();

  const title = data.title || "";
  const url = data.url || "";
  const description = data.description || "";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)]">
        <div className="bg-[var(--surface)] p-3">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
            Resource Title
          </label>
          <input 
            type="text"
            value={title}
            onChange={(e) => updateBlock(id, { title: e.target.value })}
            placeholder="e.g., MDN Web Docs: Flexbox"
            className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="bg-[var(--surface)] p-3">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
            URL
          </label>
          <input 
            type="url"
            value={url}
            onChange={(e) => updateBlock(id, { url: e.target.value })}
            placeholder="https://..."
            className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>
      <div className="border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
          Description (Optional)
        </label>
        <input 
          type="text"
          value={description}
          onChange={(e) => updateBlock(id, { description: e.target.value })}
          placeholder="Brief description of the resource..."
          className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}
