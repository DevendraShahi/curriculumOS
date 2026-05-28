/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useLessonBuilder } from "../LessonBuilderContext";
import ReactMarkdown from "react-markdown";

export function MarkdownBlock({ id, data }: { id: string; data: Record<string, any> }) {
  const { updateBlock } = useLessonBuilder();
  const [isPreview, setIsPreview] = useState(false);

  const content = data.content || "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end mb-2">
        <div className="flex bg-[var(--border)] gap-px border border-[var(--border)]">
          <button
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
              !isPreview ? "bg-[var(--surface)] text-[var(--accent)]" : "bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--surface)]"
            }`}
          >
            EDIT
          </button>
          <button
            onClick={() => setIsPreview(true)}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
              isPreview ? "bg-[var(--surface)] text-[var(--accent)]" : "bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--surface)]"
            }`}
          >
            PREVIEW
          </button>
        </div>
      </div>

      {!isPreview ? (
        <textarea
          value={content}
          onChange={(e) => updateBlock(id, { content: e.target.value })}
          className="w-full min-h-[200px] p-4 bg-[var(--background)] border border-[var(--border)] rounded-none font-mono text-sm focus:outline-none focus:border-[var(--accent)] resize-y"
          placeholder="# Lesson Heading&#10;&#10;Start writing your markdown here..."
        />
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-[var(--background)] border border-[var(--border)] rounded-none min-h-[200px]">
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">NO CONTENT TO PREVIEW</span>
          )}
        </div>
      )}
    </div>
  );
}
