/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useLessonBuilder } from "../LessonBuilderContext";
import { Plus, Trash2 } from "lucide-react";

export function ListBlock({ id, data }: { id: string; data: any }) {
  const { updateBlock } = useLessonBuilder();

  const listType = data.listType || "learningObjectives";
  const items = data.items || [];

  const addItem = () => {
    updateBlock(id, { items: [...items, ""] });
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    updateBlock(id, { items: newItems });
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    updateBlock(id, { items: newItems });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] p-3">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
          List Type
        </label>
        <select 
          value={listType}
          onChange={(e) => updateBlock(id, { listType: e.target.value })}
          className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] font-mono uppercase"
        >
          <option value="learningObjectives">Learning Objectives</option>
          <option value="prerequisites">Prerequisites</option>
          <option value="outcomes">Outcomes</option>
          <option value="instructions">Instructions</option>
          <option value="expectedOutput">Expected Output</option>
        </select>
      </div>

      <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
        {items.map((item: string, index: number) => (
          <div key={index} className="flex bg-[var(--surface)]">
            <input 
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={`Item ${index + 1}...`}
              className="w-full p-3 bg-transparent border-none rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--accent)]"
            />
            <button 
              onClick={() => removeItem(index)}
              className="p-3 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-[var(--surface-2)] transition-colors border-l border-[var(--border)] shrink-0"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="p-4 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] bg-[var(--surface)]">
            No items added yet.
          </div>
        )}
      </div>

      <button 
        onClick={addItem}
        className="flex items-center justify-center gap-2 w-full py-2 border border-[var(--border)] rounded-none font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors bg-[var(--surface)]"
      >
        <Plus size={16} /> ADD ITEM
      </button>
    </div>
  );
}
