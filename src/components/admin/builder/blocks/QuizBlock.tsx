/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { useLessonBuilder } from "../LessonBuilderContext";
import { Plus, Trash2 } from "lucide-react";

export function QuizBlock({ id, data }: { id: string; data: any }) {
  const { updateBlock } = useLessonBuilder();

  const questions = data.questions || [];

  const addQuestion = () => {
    updateBlock(id, {
      questions: [
        ...questions,
        { id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctOption: 0, explanation: "" }
      ]
    });
  };

  const removeQuestion = (index: number) => {
    const newQ = [...questions];
    newQ.splice(index, 1);
    updateBlock(id, { questions: newQ });
  };

  const updateQuestion = (index: number, qData: any) => {
    const newQ = [...questions];
    newQ[index] = { ...newQ[index], ...qData };
    updateBlock(id, { questions: newQ });
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const newQ = [...questions];
    newQ[qIndex].options[optIndex] = value;
    updateBlock(id, { questions: newQ });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-px bg-[var(--border)]">
        {questions.map((q: any, qIndex: number) => (
          <div key={q.id} className="bg-[var(--surface)] p-4 relative group">
            <button 
              onClick={() => removeQuestion(qIndex)}
              className="absolute top-2 right-2 text-[var(--muted-foreground)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={16} />
            </button>
            
            <div className="mb-4">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
                Question {qIndex + 1}
              </label>
              <input 
                type="text"
                value={q.question}
                onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                placeholder="What is the output of..."
                className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-px bg-[var(--border)] mb-4 border border-[var(--border)]">
              <div className="bg-[var(--surface-2)] p-2">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  Options (Select the correct one)
                </label>
              </div>
              {q.options.map((opt: string, optIndex: number) => (
                <div key={optIndex} className="flex items-center gap-3 bg-[var(--surface)] p-2">
                  <input 
                    type="radio" 
                    name={`correct-${q.id}`}
                    checked={q.correctOption === optIndex}
                    onChange={() => updateQuestion(qIndex, { correctOption: optIndex })}
                    className="accent-[var(--accent)] w-4 h-4 cursor-pointer rounded-none"
                  />
                  <input 
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                    placeholder={`Option ${optIndex + 1}`}
                    className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              ))}
            </div>
            
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">
                Explanation
              </label>
              <textarea 
                value={q.explanation}
                onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                placeholder="Explain why this answer is correct..."
                className="w-full min-h-[60px] p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] resize-y"
              />
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={addQuestion}
        className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-[var(--border)] rounded-none font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors bg-[var(--surface)]"
      >
        <Plus size={16} /> ADD QUESTION
      </button>
    </div>
  );
}
