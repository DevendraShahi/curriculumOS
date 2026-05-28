/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { 
  Lesson, 
  LessonExercises, 
  LessonQuiz, 
  LessonResources 
} from "@/lib/schemas/course-contracts";

export type BuilderBlockType = 
  | "markdown" 
  | "exercise" 
  | "quiz" 
  | "resource"
  | "video"
  | "list"
  | "starter_files";

export interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  data: any; // Will be casted based on type
}

interface BuilderState {
  blocks: BuilderBlock[];
}

interface BuilderContextValue {
  state: BuilderState;
  addBlock: (type: BuilderBlockType) => void;
  updateBlock: (id: string, data: any) => void;
  removeBlock: (id: string) => void;
  reorderBlocks: (startIndex: number, endIndex: number) => void;
  setBlocks: (blocks: BuilderBlock[]) => void;
}

const LessonBuilderContext = createContext<BuilderContextValue | null>(null);

export function LessonBuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BuilderState>({
    blocks: [],
  });

  const setBlocks = useCallback((blocks: BuilderBlock[]) => {
    setState({ blocks });
  }, []);

  const addBlock = useCallback((type: BuilderBlockType) => {
    const newBlock: BuilderBlock = {
      id: crypto.randomUUID(),
      type,
      data: {}, // Initialize with defaults based on type later
    };
    setState((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
  }, []);

  const updateBlock = useCallback((id: string, data: any) => {
    setState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
    }));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
  }, []);

  const reorderBlocks = useCallback((startIndex: number, endIndex: number) => {
    setState((prev) => {
      const result = Array.from(prev.blocks);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { ...prev, blocks: result };
    });
  }, []);

  return (
    <LessonBuilderContext.Provider 
      value={{ 
        state, 
        addBlock, 
        updateBlock, 
        removeBlock, 
        reorderBlocks,
        setBlocks
      }}
    >
      {children}
    </LessonBuilderContext.Provider>
  );
}

export function useLessonBuilder() {
  const context = useContext(LessonBuilderContext);
  if (!context) {
    throw new Error("useLessonBuilder must be used within a LessonBuilderProvider");
  }
  return context;
}
