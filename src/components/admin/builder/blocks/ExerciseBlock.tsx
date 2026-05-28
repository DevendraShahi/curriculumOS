/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useLessonBuilder } from "../LessonBuilderContext";

export function ExerciseBlock({ id, data }: { id: string; data: any }) {
  const { updateBlock } = useLessonBuilder();

  const type = data.type || "live-editor";
  const task = data.task || "";
  const instructions = data.instructions || "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
          Exercise Type
        </label>
        <select 
          value={type}
          onChange={(e) => updateBlock(id, { type: e.target.value })}
          className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] font-mono"
        >
          <option value="live-editor">LIVE EDITOR</option>
          <option value="sandbox">SANDBOX</option>
          <option value="live-exercise">LIVE EXERCISE</option>
        </select>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
          Task Description
        </label>
        <input 
          type="text"
          value={task}
          onChange={(e) => updateBlock(id, { task: e.target.value })}
          placeholder="e.g., Create a responsive navigation bar"
          className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
          Instructions (Markdown)
        </label>
        <textarea 
          value={instructions}
          onChange={(e) => updateBlock(id, { instructions: e.target.value })}
          placeholder="Step-by-step instructions..."
          className="w-full min-h-[100px] p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] font-mono resize-y"
        />
      </div>
      
      <div className="border border-[var(--border)] border-dashed rounded-none p-4 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
        + ADD STARTER FILES CONFIGURATION
      </div>
      <div className="border border-[var(--border)] border-dashed rounded-none p-4 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
        + ADD VALIDATION RULES
      </div>
    </div>
  );
}
