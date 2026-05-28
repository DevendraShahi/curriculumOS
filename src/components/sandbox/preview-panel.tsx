"use client";

import { ArrowLeft, ArrowRight, RotateCw, MonitorSmartphone } from "lucide-react";

type PreviewPanelProps = {
  srcDoc: string;
  isDirty: boolean;
};

export function PreviewPanel({ srcDoc, isDirty }: PreviewPanelProps) {
  return (
    <section className="flex w-full lg:w-[400px] xl:w-[500px] shrink-0 min-h-[400px] lg:min-h-0 flex-col border-b lg:border-b-0 lg:border-l border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex h-10 items-center justify-between border-b border-[var(--border)] px-4 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[var(--muted-foreground)]">
          <span className={`h-2 w-2 rounded-full ${isDirty ? "bg-amber-500" : "bg-emerald-500"}`} />
          {isDirty ? "Preview Stale" : "Preview Ready"}
        </div>

        <div className="flex items-center gap-2 text-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-widest">
          <button className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 hover:bg-[var(--faint)] hover:text-[var(--foreground)] transition-colors">
            <MonitorSmartphone size={12} />
            100%
          </button>
        </div>
      </div>

      <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 shrink-0">
        <div className="flex items-center gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--faint)] hover:text-[var(--foreground)] transition-colors">
            <ArrowLeft size={14} />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--faint)] hover:text-[var(--foreground)] transition-colors opacity-50 cursor-not-allowed">
            <ArrowRight size={14} />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--faint)] hover:text-[var(--foreground)] transition-colors">
            <RotateCw size={14} />
          </button>
        </div>

        <div className="flex h-7 flex-1 items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3">
          <span className="text-[11px] font-mono text-[var(--muted-foreground)]">/index.html</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-2)] p-4">
        <iframe
          title="Sandbox Preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-forms allow-modals"
          className="h-full min-h-[420px] w-full rounded-lg border border-[var(--border)] bg-white shadow-sm"
        />
      </div>
    </section>
  );
}
