"use client";

import { useEffect, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export function Toast({
  message,
  tone = "info",
  onDone,
  durationMs = 2400,
}: {
  message: string;
  tone?: ToastTone;
  onDone?: () => void;
  durationMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onDone]);

  if (!visible) return null;

  const toneClasses =
    tone === "success"
      ? "border-[#21B8A8]/50 bg-[#21B8A8]/10 text-[#0f766e]"
      : tone === "error"
        ? "border-[#FF7A2F]/50 bg-[#FF7A2F]/10 text-[#9a3412]"
        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[40]">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto border px-4 py-3 font-mono text-[10px] uppercase tracking-widest shadow-sm ${toneClasses}`}
      >
        {message}
      </div>
    </div>
  );
}
