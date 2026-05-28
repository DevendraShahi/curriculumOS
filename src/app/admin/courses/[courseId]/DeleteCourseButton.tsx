"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCourseAction } from "../actions";
import { Trash } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function DeleteCourseButton({ courseId, title }: { courseId: string; title: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCourseAction(courseId);
      setIsModalOpen(false);
      router.push("/admin/courses");
    } catch {
      alert("Failed to delete course. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={isDeleting}
        className="flex items-center gap-2 px-4 py-2 border border-[#FF3333] text-[#FF3333] bg-[#FF3333]/10 hover:bg-[#FF3333]/20 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash size={14} />
        {isDeleting ? "DELETING..." : "DELETE COURSE"}
      </button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !isDeleting && setIsModalOpen(false)}
        title="Confirm Deletion"
      >
        <p className="text-sm text-[var(--foreground)] mb-6 leading-relaxed">
          Are you absolutely sure you want to delete the course <strong>&quot;{title}&quot;</strong>? 
          This will permanently delete all associated modules, lessons, and quizzes. 
          <br /><br />
          <span className="text-[#FF3333] font-mono text-[10px] uppercase tracking-widest">
            THIS ACTION CANNOT BE UNDONE.
          </span>
        </p>

        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4 mt-2">
          <button
            onClick={() => setIsModalOpen(false)}
            disabled={isDeleting}
            className="px-4 py-2 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] font-mono text-[10px] uppercase tracking-widest transition-colors rounded-none disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 border border-[#FF3333] bg-[#FF3333] text-white font-mono text-[10px] uppercase tracking-widest hover:bg-[#FF3333]/90 transition-colors rounded-none disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? "DELETING..." : "YES, DELETE COURSE"}
          </button>
        </div>
      </Modal>
    </>
  );
}
