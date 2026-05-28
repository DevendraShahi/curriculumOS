/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useLessonBuilder } from "../LessonBuilderContext";
import { Plus, Trash2 } from "lucide-react";

export function StarterFilesBlock({ id, data }: { id: string; data: any }) {
  const { updateBlock } = useLessonBuilder();

  const files = data.files || [];

  const addFile = () => {
    updateBlock(id, { files: [...files, { path: "index.js", language: "javascript", content: "" }] });
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    updateBlock(id, { files: newFiles });
  };

  const updateFile = (index: number, updates: any) => {
    const newFiles = [...files];
    newFiles[index] = { ...newFiles[index], ...updates };
    updateBlock(id, { files: newFiles });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {files.map((file: any, index: number) => (
          <div key={index} className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
            <div className="flex bg-[var(--surface)]">
              <input 
                type="text"
                value={file.path}
                onChange={(e) => updateFile(index, { path: e.target.value })}
                placeholder="Filename (e.g. index.js)"
                className="w-1/2 p-3 bg-transparent border-none rounded-none font-mono text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--accent)]"
              />
              <div className="w-px bg-[var(--border)]" />
              <input 
                type="text"
                value={file.language}
                onChange={(e) => updateFile(index, { language: e.target.value })}
                placeholder="Language (e.g. javascript)"
                className="w-1/2 p-3 bg-transparent border-none rounded-none font-mono text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--accent)]"
              />
              <div className="w-px bg-[var(--border)]" />
              <button 
                onClick={() => removeFile(index)}
                className="p-3 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-[var(--surface-2)] transition-colors shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea 
              value={file.content}
              onChange={(e) => updateFile(index, { content: e.target.value })}
              placeholder="File content..."
              className="w-full min-h-[150px] p-4 bg-[var(--background)] border-none rounded-none font-mono text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--accent)] resize-y"
              spellCheck={false}
            />
          </div>
        ))}
        {files.length === 0 && (
          <div className="p-4 border border-[var(--border)] border-dashed text-center font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] bg-[var(--surface)]">
            No starter files defined.
          </div>
        )}
      </div>

      <button 
        onClick={addFile}
        className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-[var(--border)] rounded-none font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors bg-[var(--surface)]"
      >
        <Plus size={16} /> ADD STARTER FILE
      </button>
    </div>
  );
}
