"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export function LazyCodeBlock({
  code,
  language = "text",
}: {
  code: string;
  language?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "120px" }
    );

    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div ref={ref} className="w-full relative group">
      {visible ? (
        <>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="absolute right-2 top-2 z-10 rounded border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--foreground)]"
            aria-label="Copy code block"
            title={copied ? "Copied" : "Copy code"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <pre className="overflow-x-auto border border-[var(--border)] bg-[var(--code-bg)] p-4 pt-8 text-xs text-[var(--code-fg)]">
            <code data-language={language}>{code}</code>
          </pre>
        </>
      ) : (
        <div className="h-24 animate-pulse border border-[var(--border)] bg-[var(--surface-2)]" />
      )}
    </div>
  );
}
