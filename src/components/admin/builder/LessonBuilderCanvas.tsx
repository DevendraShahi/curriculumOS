/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLessonBuilder, BuilderBlockType } from "./LessonBuilderContext";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { MarkdownBlock } from "./blocks/MarkdownBlock";
import { ExerciseBlock } from "./blocks/ExerciseBlock";
import { QuizBlock } from "./blocks/QuizBlock";
import { ResourceBlock } from "./blocks/ResourceBlock";
import { VideoBlock } from "./blocks/VideoBlock";
import { ListBlock } from "./blocks/ListBlock";
import { StarterFilesBlock } from "./blocks/StarterFilesBlock";
import { useTransition } from "react";
import { saveLessonBlocksAction } from "@/app/admin/courses/actions";
import { useParams } from "next/navigation";
import { z } from "zod";

const lessonBlockSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1, "Block type is required"),
  data: z.record(z.string(), z.any()).refine(data => Object.keys(data).length > 0, "Block data cannot be empty")
});

const lessonImportSchema = z.array(lessonBlockSchema);

function SortableBlock({ id, type, data }: { id: string, type: string, data: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });
  
  const { removeBlock } = useLessonBuilder();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group mb-4 border border-[var(--border)] bg-[var(--surface)]">
      <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          {...attributes} 
          {...listeners}
          className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing rounded-none hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)]"
        >
          <GripVertical size={18} />
        </button>
      </div>
      
      <div className="flex flex-col gap-px bg-[var(--border)] focus-within:border-[var(--accent)] border border-transparent">
        <div className="bg-[var(--surface-2)] px-4 py-2 flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            {type} BLOCK
          </span>
          <button 
            onClick={() => removeBlock(id)}
            className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="bg-[var(--surface)] p-4">
          {type === "markdown" && <MarkdownBlock id={id} data={data} />}
          {type === "exercise" && <ExerciseBlock id={id} data={data} />}
          {type === "quiz" && <QuizBlock id={id} data={data} />}
          {type === "resource" && <ResourceBlock id={id} data={data} />}
          {type === "video" && <VideoBlock id={id} data={data} />}
          {type === "list" && <ListBlock id={id} data={data} />}
          {type === "starter_files" && <StarterFilesBlock id={id} data={data} />}
        </div>
      </div>
    </div>
  );
}

export function LessonBuilderCanvas() {
  const [isImporting, setIsImporting] = React.useState(false);
  const [importJson, setImportJson] = React.useState("");
  const { state, addBlock, reorderBlocks, setBlocks } = useLessonBuilder();
  const [isPending, startTransition] = useTransition();
  const params = useParams();
  const lessonId = params.lessonId as string;

  const handleSave = () => {
    if (!lessonId) {
      alert("Lesson ID is missing.");
      return;
    }
    
    startTransition(async () => {
      try {
        const result = await saveLessonBlocksAction(lessonId, state.blocks);
        alert(result.message);
      } catch (err) {
        if (err instanceof Error) {
          alert("Failed to save: " + err.message);
        }
      }
    });
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      
      const result = lessonImportSchema.safeParse(parsed);
      if (!result.success) {
        const errorMsg = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation Error: ${errorMsg}`);
      }

      const validatedBlocks = result.data.map((block: any) => ({
        id: block.id || crypto.randomUUID(),
        type: block.type,
        data: block.data
      }));

      setBlocks(validatedBlocks);
      setIsImporting(false);
      setImportJson("");
    } catch (err: any) {
      alert(err.message || "Invalid JSON format");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = state.blocks.findIndex((b) => b.id === active.id);
      const newIndex = state.blocks.findIndex((b) => b.id === over.id);
      reorderBlocks(oldIndex, newIndex);
    }
  }

  const blockTypes: { type: BuilderBlockType; label: string }[] = [
    { type: "markdown", label: "MARKDOWN" },
    { type: "exercise", label: "EXERCISE" },
    { type: "quiz", label: "QUIZ" },
    { type: "resource", label: "RESOURCE" },
    { type: "video", label: "VIDEO" },
    { type: "list", label: "LIST" },
    { type: "starter_files", label: "STARTER FILES" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-12">
      <div className="mb-8 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Lesson Builder</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-2">VISUALLY CONSTRUCT JSON LESSON CONTRACTS</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsImporting(!isImporting)}
            className="px-6 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--surface-2)] transition-colors"
          >
            {isImporting ? "CANCEL IMPORT" : "IMPORT JSON"}
          </button>
          <button 
            onClick={handleSave}
            disabled={isPending}
            className="px-6 py-2 bg-[var(--accent)] text-white rounded-none font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "SAVING..." : "SAVE TO DB"}
          </button>
        </div>
      </div>

      {isImporting && (
        <div className="mb-8 p-6 bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h3 className="font-mono text-[12px] uppercase tracking-widest text-[var(--foreground)] mb-2">Import Lesson Blocks</h3>
              <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                Select a template below to see the exact format required for specific lesson parts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setImportJson(JSON.stringify([
                  { "type": "markdown", "data": { "content": "# Lesson Title\n\nLesson content goes here." } },
                  { "type": "video", "data": { "videoUrl": "https://youtube.com/watch?v=...", "videoProvider": "youtube" } },
                  { "type": "list", "data": { "listType": "learningObjectives", "items": ["Understand X", "Build Y"] } },
                  { "type": "starter_files", "data": { "files": [{ "path": "index.js", "language": "javascript", "content": "console.log('hello');" }] } }
                ], null, 2))}
                className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                CONTENT TEMPLATE
              </button>
              <button 
                onClick={() => setImportJson(JSON.stringify([
                  { "type": "exercise", "data": { "type": "live-editor", "task": "Create a function that returns true.", "instructions": "1. Open index.js\n2. Write code." } }
                ], null, 2))}
                className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                EXERCISE TEMPLATE
              </button>
              <button 
                onClick={() => setImportJson(JSON.stringify([
                  { "type": "quiz", "data": { "questions": [{ "id": "q1", "question": "What is 2+2?", "options": ["3", "4", "5"], "correctOption": 1, "explanation": "Math is exact." }] } }
                ], null, 2))}
                className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                QUIZ TEMPLATE
              </button>
              <button 
                onClick={() => setImportJson(JSON.stringify([
                  { "type": "resource", "data": { "title": "MDN Web Docs", "url": "https://developer.mozilla.org", "description": "Reference documentation." } }
                ], null, 2))}
                className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                RESOURCE TEMPLATE
              </button>
            </div>
          </div>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            className="w-full min-h-[300px] p-4 bg-[var(--background)] border border-[var(--border)] rounded-none font-mono text-sm focus:outline-none focus:border-[var(--accent)] resize-y mb-4"
            placeholder="Paste your JSON array here..."
            spellCheck={false}
          />
          <button 
            onClick={handleImport}
            className="w-full py-3 bg-[var(--foreground)] text-[var(--background)] rounded-none font-mono text-[12px] uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            VALIDATE & IMPORT
          </button>
        </div>
      )}

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={state.blocks.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {state.blocks.map((block) => (
            <SortableBlock key={block.id} id={block.id} type={block.type} data={block.data} />
          ))}
        </SortableContext>
      </DndContext>

      {state.blocks.length === 0 && (
        <div className="border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-12 text-center text-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-widest mb-8">
          START BY ADDING A BLOCK BELOW
        </div>
      )}

      <div className="mt-8 border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-wrap gap-px bg-[var(--border)] items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mr-4 bg-[var(--surface)] px-2 py-1">
          ADD BLOCK:
        </span>
        {blockTypes.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className="flex items-center gap-2 px-4 py-2 border-none bg-[var(--surface)] font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all"
          >
            <Plus size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
