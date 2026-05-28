"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SandboxFile, SandboxSaveStatus } from "./types";

type UseSandboxAutosaveInput = {
  enabled?: boolean;
  lessonId: string;
  exerciseId: string;
  files: SandboxFile[];
  openFileIds: string[];
  activeFileId: string | null;
  delayMs?: number;
};

export function useSandboxAutosave({
  enabled = true,
  lessonId,
  exerciseId,
  files,
  openFileIds,
  activeFileId,
  delayMs = 1200,
}: UseSandboxAutosaveInput) {
  const [status, setStatus] = useState<SandboxSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hasMountedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  const clearPendingSave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const persistNow = useCallback(async (): Promise<boolean> => {
    if (!enabled || !files.length) return false;
    if (isSavingRef.current) return false;

    clearPendingSave();
    isSavingRef.current = true;

    try {
      setStatus("saving");

      const response = await fetch("/api/sandbox/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonId,
          exerciseId,
          files,
          openFileIds,
          activeFileId,
        }),
      });

      if (!response.ok) {
        throw new Error("Autosave failed");
      }

      const data = await response.json();

      setLastSavedAt(data.savedAt ?? new Date().toISOString());
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [
    activeFileId,
    clearPendingSave,
    enabled,
    exerciseId,
    files,
    lessonId,
    openFileIds,
  ]);

  useEffect(() => {
    if (!enabled || !files.length) return;

    // Avoid saving immediately on first render.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    setStatus("dirty");

    clearPendingSave();
    timeoutRef.current = window.setTimeout(() => {
      void persistNow();
    }, delayMs);

    return clearPendingSave;
  }, [clearPendingSave, delayMs, enabled, files, persistNow]);

  useEffect(() => clearPendingSave, [clearPendingSave]);

  return {
    status,
    lastSavedAt,
    saveNow: persistNow,
  };
}
