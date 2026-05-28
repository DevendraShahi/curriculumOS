import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className = "max-w-lg" }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className={`bg-[var(--surface)] border border-[var(--border)] w-full flex flex-col max-h-[90vh] ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <h3 className="font-mono text-sm uppercase tracking-widest text-[var(--foreground)]">{title}</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-[var(--background)]">
          {children}
        </div>
      </div>
    </div>
  );
}
