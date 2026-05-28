/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useLessonBuilder } from "../LessonBuilderContext";

export function VideoBlock({ id, data }: { id: string; data: any }) {
  const { updateBlock } = useLessonBuilder();

  const videoUrl = data.videoUrl || "";
  const videoProvider = data.videoProvider || "youtube";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-px bg-[var(--border)] border border-[var(--border)]">
        <div className="bg-[var(--surface)] p-3">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
            Video URL
          </label>
          <input 
            type="url"
            value={videoUrl}
            onChange={(e) => updateBlock(id, { videoUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="bg-[var(--surface)] p-3">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
            Provider
          </label>
          <select 
            value={videoProvider}
            onChange={(e) => updateBlock(id, { videoProvider: e.target.value })}
            className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] font-mono uppercase"
          >
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="loom">Loom</option>
            <option value="wistia">Wistia</option>
            <option value="mux">Mux</option>
          </select>
        </div>
      </div>
    </div>
  );
}
