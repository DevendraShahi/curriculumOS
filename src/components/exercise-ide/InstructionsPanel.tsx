/** InstructionsPanel — task + instructions + AI hint */
"use client";

import { CheckSquare } from "lucide-react";
import type { Exercise } from "./LiveExerciseIDE";
import { AIHintButton } from "./AIHintButton";

export function InstructionsPanel({ exercise }: { exercise: Exercise }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
      <div className="ide-panel-hdr">
        <CheckSquare />
        Task
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px 32px" }}>
        <h2 style={{
          fontSize: "20px",
          fontWeight: 500,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
          color: "#fff",
          marginBottom: "12px",
        }}>
          {exercise.task}
        </h2>
        <p style={{
          fontSize: "14px",
          lineHeight: 1.7,
          color: "rgba(255,255,255,.55)",
          fontWeight: 300,
          marginBottom: "32px",
        }}>
          {exercise.instructions}
        </p>
        <AIHintButton exercise={exercise} />
      </div>
    </div>
  );
}
