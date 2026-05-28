/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import React, { useEffect } from "react";
import { LessonBuilderProvider, useLessonBuilder, BuilderBlockType } from "@/components/admin/builder/LessonBuilderContext";
import { LessonBuilderCanvas } from "@/components/admin/builder/LessonBuilderCanvas";

function HydrateBuilder({ initialBlocks }: { initialBlocks: any[] }) {
  const { setBlocks } = useLessonBuilder();
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    if (!hydrated) {
      if (initialBlocks && initialBlocks.length > 0) {
        const blocksWithIds = initialBlocks.map(b => ({
          id: crypto.randomUUID(),
          type: b.type,
          data: b.data
        }));
        setBlocks(blocksWithIds);
      }
      setTimeout(() => setHydrated(true), 0); // push to next tick to avoid cascading render error
    }
  }, [initialBlocks, setBlocks, hydrated]);

  if (!hydrated) return null;

  return <LessonBuilderCanvas />;
}

export function LessonBuilderWrapper({ lessonId, initialData }: { lessonId: string, initialData: any }) {
  // Translate DB document into UI blocks
  const initialBlocks = [];
  
  if (initialData.bodyMarkdown) {
    initialBlocks.push({ type: "markdown", data: { content: initialData.bodyMarkdown } });
  }
  
  if (initialData.videoUrl || initialData.videoProvider) {
    initialBlocks.push({ type: "video", data: { videoUrl: initialData.videoUrl, videoProvider: initialData.videoProvider } });
  }

  if (initialData.starterFiles && Array.isArray(initialData.starterFiles)) {
    initialBlocks.push({ type: "starter_files", data: { files: initialData.starterFiles } });
  }

  const listKeys = ["learningObjectives", "prerequisites", "outcomes", "instructions", "expectedOutput"];
  listKeys.forEach(key => {
    if (initialData[key] && Array.isArray(initialData[key]) && initialData[key].length > 0) {
      initialBlocks.push({ type: "list", data: { listType: key, items: initialData[key] } });
    }
  });

  if (initialData.exercises && Array.isArray(initialData.exercises)) {
    initialData.exercises.forEach((ex: any) => {
      initialBlocks.push({ type: "exercise", data: ex });
    });
  }

  // Quiz usually comes from a separate document, but if we pass it in:
  if (initialData.quiz) {
    initialBlocks.push({ type: "quiz", data: initialData.quiz });
  }

  if (initialData.resources && initialData.resources.externalResources) {
    initialData.resources.externalResources.forEach((res: any) => {
      initialBlocks.push({ type: "resource", data: res });
    });
  }

  return (
    <LessonBuilderProvider>
      <HydrateBuilder initialBlocks={initialBlocks} />
    </LessonBuilderProvider>
  );
}
