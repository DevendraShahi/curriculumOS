/** ValidationPanel — test check results + Next Exercise CTA */
"use client";

import { useSandpack } from "@codesandbox/sandpack-react";
import { validateProject } from "@/lib/playground-validation";
import { ListChecks, CheckCircle2, Circle } from "lucide-react";
import type { Exercise } from "./LiveExerciseIDE";

export function ValidationPanel({
  exercise,
  onComplete,
}: {
  exercise: Exercise;
  onComplete: () => void;
}) {
  const { sandpack } = useSandpack();
  const results  = validateProject(sandpack.files, exercise.validationRules);
  const total    = results.length;
  const passed   = results.filter((r) => r.passed).length;
  const allPassed = total > 0 && passed === total;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
      <div className="ide-panel-hdr">
        <ListChecks />
        Checks
        {total > 0 && (
          <span
            className="hdr-count"
            style={{ color: allPassed ? "#00F0FF" : "rgba(255,255,255,.3)" }}
          >
            {passed}/{total}
          </span>
        )}
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {total === 0 ? (
          <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: "11px", color: "rgba(255,255,255,.3)", padding: "8px 4px" }}>
            No tests configured.
          </p>
        ) : (
          results.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "7px",
                border: r.passed ? "1px solid rgba(0,240,255,.18)" : "1px solid rgba(255,255,255,.08)",
                background: r.passed ? "rgba(0,240,255,.05)" : "rgba(255,255,255,.02)",
                marginBottom: "6px",
                transition: "all .3s",
              }}
            >
              {r.passed ? (
                <CheckCircle2
                  size={15}
                  style={{ color: "#00F0FF", flexShrink: 0, marginTop: "1px", filter: "drop-shadow(0 0 5px rgba(0,240,255,.7))" }}
                />
              ) : (
                <Circle size={15} style={{ color: "rgba(255,255,255,.2)", flexShrink: 0, marginTop: "1px" }} />
              )}
              <span style={{
                fontSize: "13px",
                lineHeight: 1.5,
                color: r.passed ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.8)",
                textDecoration: r.passed ? "line-through" : "none",
                textDecorationColor: "rgba(0,240,255,.4)",
              }}>
                {r.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
        <button
          onClick={onComplete}
          disabled={!allPassed}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "44px",
            borderRadius: "8px",
            border: "none",
            cursor: allPassed ? "pointer" : "not-allowed",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "11px",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            fontWeight: 500,
            transition: "all .4s",
            background: allPassed ? "#00F0FF" : "rgba(255,255,255,.05)",
            color: allPassed ? "#000" : "rgba(255,255,255,.2)",
            boxShadow: allPassed ? "0 0 24px rgba(0,240,255,.4)" : "none",
          }}
          onMouseEnter={(e) => {
            if (allPassed) e.currentTarget.style.boxShadow = "0 0 36px rgba(0,240,255,.7)";
          }}
          onMouseLeave={(e) => {
            if (allPassed) e.currentTarget.style.boxShadow = "0 0 24px rgba(0,240,255,.4)";
          }}
        >
          {allPassed ? "Next Exercise →" : "Complete tasks to continue"}
        </button>
      </div>
    </div>
  );
}
