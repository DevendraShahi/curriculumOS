/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { Trash, AlertTriangle } from "lucide-react";
import { deleteCourseAction } from "./actions";

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await deleteCourseAction(courseId);
        setShowModal(false);
      } catch (err: any) {
        alert("Failed to delete: " + err.message);
      }
    });
  };

  return (
    <>
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
        disabled={isPending}
        className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors disabled:opacity-50"
        title="Delete Course"
      >
        <Trash size={18} />
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(false);
          }}
        >
          <div 
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
          >
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 bg-red-500/10 p-3 rounded-none border border-red-500/20">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Delete Course</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-500 mt-1">
                  IRREVERSIBLE ACTION
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="mb-8">
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                Are you sure you want to delete this course? This will permanently delete the course and 
                <strong className="text-[var(--foreground)]"> all its associated modules and lessons</strong>. 
                <br /><br />
                This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowModal(false);
                }}
                disabled={isPending}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfirm();
                }}
                disabled={isPending}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
