/** AIHintButton — ask AI for a contextual hint about the current code */
"use client";

import { useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { validateProject } from "@/lib/playground-validation";
import { Sparkles, Loader2 } from "lucide-react";
import type { Exercise } from "./LiveExerciseIDE";

export function AIHintButton({ exercise }: { exercise: Exercise }) {
  const [hint,    setHint   ] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);
  const { sandpack } = useSandpack();

  const ask = async () => {
    setLoading(true); setError(null); setHint(null);

    const results      = validateProject(sandpack.files, exercise.validationRules);
    const failingRules = results.filter((r) => !r.passed).map((r) => r.message);
    const code         = sandpack.files[sandpack.activeFile]?.code ?? "";

    try {
      const res = await fetch("/api/v1/exercises/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, task: exercise.task, instructions: exercise.instructions, failingRules }),
      });
      if (!res.ok) throw new Error("Failed to fetch hint");
      const data = await res.json();
      setHint(data.hint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,.08)",
      background: "rgba(255,255,255,.03)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "7px",
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase",
        color: "rgba(255,255,255,.35)",
      }}>
        <Sparkles size={12} style={{ color: "#00F0FF" }} />
        AI Hint
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {!hint && !loading && !error && (
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,.4)", lineHeight: 1.6 }}>
            Stuck? Get a contextual hint based on your current code.
          </p>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#00F0FF", fontSize: "13px" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            Analyzing…
          </div>
        )}

        {error && (
          <p style={{ fontSize: "13px", color: "#f87171" }}>{error}</p>
        )}

        {hint && (
          <div style={{
            fontSize: "13px", lineHeight: 1.65, color: "rgba(255,255,255,.8)",
            borderLeft: "2px solid #00F0FF",
            paddingLeft: "10px",
          }}>
            {hint}
          </div>
        )}

        <button
          onClick={ask}
          disabled={loading}
          style={{
            height: "36px", borderRadius: "6px",
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.05)",
            color: "rgba(255,255,255,.55)",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all .2s",
            opacity: loading ? .5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "rgba(255,255,255,.09)";
              e.currentTarget.style.color = "rgba(255,255,255,.85)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,.05)";
            e.currentTarget.style.color = "rgba(255,255,255,.55)";
          }}
        >
          {hint ? "Get another hint" : "Ask for hint"}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
