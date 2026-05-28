/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import React, { useTransition, useState } from "react";
import { createModuleAction, createLessonAction, importModuleJsonAction, importLessonJsonAction, deleteModuleAction, deleteLessonAction, moveLessonAction } from "../actions";
import { Plus, ChevronDown, ChevronRight, FileEdit, Upload, X, Trash, MoveRight } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { ModuleStatusToggle } from "./ModuleStatusToggle";
import { LessonStatusToggle } from "./LessonStatusToggle";

export function CurriculumManager({ courseId, modules, lessons }: { courseId: string, modules: any[], lessons: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"manual" | "json">("manual");
  const [importJson, setImportJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: "module" | "lesson" | null;
    id: string | null;
    parentId?: string | null;
    title: string;
  }>({ isOpen: false, type: null, id: null, title: "" });

  const [moveLessonModalState, setMoveLessonModalState] = useState<{
    isOpen: boolean;
    lessonId: string | null;
    currentModuleId: string | null;
    lessonTitle: string;
  }>({ isOpen: false, lessonId: null, currentModuleId: null, lessonTitle: "" });

  // Lesson Import Modal State
  const [importLessonModalModuleId, setImportLessonModalModuleId] = useState<string | null>(null);
  const [importLessonModalLessonId, setImportLessonModalLessonId] = useState<string | null>(null);
  const [lessonJson, setLessonJson] = useState("");
  const [quizJson, setQuizJson] = useState("");
  const [exercisesJson, setExercisesJson] = useState("");
  const [resourcesJson, setResourcesJson] = useState("");
  const [importLessonTab, setImportLessonTab] = useState<"lesson" | "quiz" | "exercises" | "resources">("lesson");
  const [importLessonError, setImportLessonError] = useState<string | null>(null);

  const handleImportLessonJson = () => {
    setImportLessonError(null);
    if (!importLessonModalLessonId && !lessonJson.trim()) {
      setImportLessonError("Lesson JSON is required for new lessons.");
      return;
    }
    if (!importLessonModalModuleId) return;

    startTransition(async () => {
      try {
        await importLessonJsonAction(courseId, importLessonModalModuleId, {
          lessonId: importLessonModalLessonId || undefined,
          lessonJson: lessonJson.trim() || undefined,
          quizJson: quizJson.trim() || undefined,
          exercisesJson: exercisesJson.trim() || undefined,
          resourcesJson: resourcesJson.trim() || undefined
        });
        setImportLessonModalModuleId(null);
        setImportLessonModalLessonId(null);
        setLessonJson("");
        setQuizJson("");
        setExercisesJson("");
        setResourcesJson("");
        setExpandedModules(prev => ({ ...prev, [importLessonModalModuleId]: true }));
      } catch (err: any) {
        setImportLessonError(err.message);
      }
    });
  };

  const loadImportLessonTemplate = () => {
    setImportLessonError(null);
    if (importLessonTab === "lesson") {
      setLessonJson(JSON.stringify({
        title: "Introduction to Next.js",
        slug: "intro-to-nextjs",
        bodyMarkdown: "## Welcome\nThis lesson covers the basics of Next.js...",
        videoUrl: "https://youtube.com/watch?v=example",
        videoProvider: "youtube",
        durationMinutes: 15,
        isPublished: false,
        expectedOutput: [
          "A working Next.js page that displays 'Hello World'",
          "Understanding of the App Router"
        ],
        instructions: [
          "Watch the video lesson",
          "Complete the interactive exercise",
          "Pass the quiz"
        ],
        learningObjectives: [
          "Understand the core concepts of Next.js"
        ],
        prerequisites: [],
        outcomes: []
      }, null, 2));
    } else if (importLessonTab === "quiz") {
      setQuizJson(JSON.stringify({
        questions: [
          {
            id: "q1",
            prompt: "What is Next.js?",
            options: ["A React framework", "A database", "A CSS library"],
            answerIndex: 0,
            explanation: "Next.js is a React framework for production."
          }
        ]
      }, null, 2));
    } else if (importLessonTab === "exercises") {
      setExercisesJson(JSON.stringify([
        {
          id: "ex1",
          type: "live-editor",
          task: "Create a Page",
          instructions: "Create a new page in the app directory.",
          starterCode: "export default function Page() { return null; }",
          solutionCode: "export default function Page() { return <h1>Hello</h1>; }",
          hints: ["Use the app/page.tsx convention."],
          validationRules: [
            {
              type: "hasTag",
              tag: "h1",
              message: "The page must contain an h1 tag"
            }
          ]
        }
      ], null, 2));
    } else if (importLessonTab === "resources") {
      setResourcesJson(JSON.stringify({
        externalResources: [
          {
            id: "res1",
            title: "Next.js Documentation",
            url: "https://nextjs.org/docs",
            kind: "link"
          }
        ]
      }, null, 2));
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const handleAddModule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createModuleAction(courseId, formData);
        (e.target as HTMLFormElement).reset();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  const handleAddLesson = (e: React.FormEvent<HTMLFormElement>, moduleId: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createLessonAction(courseId, moduleId, formData);
        (e.target as HTMLFormElement).reset();
        setExpandedModules(prev => ({ ...prev, [moduleId]: true })); // ensure it's open
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  const validateAndImportModuleJson = () => {
    setJsonError(null);
    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch (e) {
      setJsonError("Invalid JSON syntax.");
      return;
    }

    // check if it's an array or single object
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const mod of arr) {
      if (!mod.title || !mod.slug) {
        setJsonError("Each module must include at least 'title' and 'slug'.");
        return;
      }
    }

    startTransition(async () => {
      try {
        await importModuleJsonAction(courseId, importJson);
        setImportJson("");
        setMode("manual");
      } catch (err: any) {
        setJsonError(err.message);
      }
    });
  };

  const loadModuleTemplate = () => {
    setJsonError(null);
    setImportJson(JSON.stringify([
      {
        title: "Module 1: Getting Started",
        slug: "module-1-getting-started",
        description: "An overview of the entire curriculum.",
        order: 1,
        durationMinutes: 30,
        isPublished: true
      },
      {
        title: "Module 2: Advanced Topics",
        slug: "module-2-advanced-topics",
        description: "Deep dive into the material.",
        order: 2,
        durationMinutes: 45,
        isPublished: false
      }
    ], null, 2));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ADD MODULE SECTION */}
      <div className="border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-px bg-[var(--border)]">
        <div className="bg-[var(--surface-2)] p-0 flex border-b border-[var(--border)]">
          <button 
            onClick={() => setMode("manual")}
            className={`flex-1 p-3 text-left font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === "manual" ? "bg-[var(--surface)] text-[var(--foreground)] border-b-2 border-[var(--accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface)]"}`}
          >
            Manual Creation
          </button>
          <button 
            onClick={() => setMode("json")}
            className={`flex-1 p-3 text-left font-mono text-[10px] uppercase tracking-widest transition-colors ${mode === "json" ? "bg-[var(--surface)] text-[var(--foreground)] border-b-2 border-[var(--accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface)]"}`}
          >
            JSON Import
          </button>
        </div>

        {mode === "manual" ? (
          <form onSubmit={handleAddModule} className="bg-[var(--surface)] flex gap-4 p-4 items-end">
            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Module Title</label>
              <input name="title" required placeholder="e.g., Getting Started" className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex-1">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5">Module Slug</label>
              <input name="slug" required placeholder="e.g., getting-started" className="w-full p-2 bg-[var(--background)] border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-widest rounded-none h-[38px] hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              <Plus size={14} /> ADD MODULE
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-px bg-[var(--border)]">
            <div className="bg-[var(--surface)] p-4">
              <div className="flex justify-between items-center mb-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Paste Module JSON</label>
                <button 
                  onClick={loadModuleTemplate}
                  className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  LOAD MODULE TEMPLATE
                </button>
              </div>
              <textarea
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  setJsonError(null);
                }}
                className="w-full h-48 p-4 bg-[#0a0a0a] text-[#00ff00] font-mono text-sm border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] resize-y rounded-none"
                placeholder="Paste JSON here... (Object or Array of Objects)"
                spellCheck={false}
              />
              {jsonError && (
                <div className="mt-2 text-red-500 font-mono text-[10px] uppercase tracking-widest">
                  ERROR: {jsonError}
                </div>
              )}
            </div>
            <div className="bg-[var(--surface-2)] p-4 flex justify-end">
              <button 
                onClick={validateAndImportModuleJson}
                disabled={isPending || !importJson.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 rounded-none"
              >
                <Upload size={14} />
                {isPending ? "IMPORTING..." : "VALIDATE & IMPORT MODULE(S)"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODULE LIST */}
      <div className="flex flex-col gap-px bg-[var(--border)] border border-[var(--border)]">
        {modules.length === 0 ? (
          <div className="bg-[var(--surface)] p-12 text-center text-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-widest">
            NO MODULES YET. ADD ONE ABOVE.
          </div>
        ) : (
          modules.map(mod => {
            const modIdStr = mod._id.toString();
            const isExpanded = expandedModules[modIdStr];
            const moduleLessons = lessons.filter(l => l.moduleId.toString() === modIdStr);

            return (
              <div key={modIdStr} className="flex flex-col gap-px bg-[var(--border)]">
                {/* MODULE HEADER */}
                <div 
                  className="bg-[var(--surface-2)] p-4 flex justify-between items-center cursor-pointer hover:bg-[var(--surface)] transition-colors"
                  onClick={() => toggleModule(modIdStr)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <span className="font-semibold text-[var(--foreground)]">{mod.title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <ModuleStatusToggle moduleId={modIdStr} isPublished={mod.isPublished} courseId={courseId} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      {moduleLessons.length} LESSON{moduleLessons.length !== 1 ? 'S' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModalState({
                          isOpen: true,
                          type: "module",
                          id: modIdStr,
                          title: mod.title
                        });
                      }}
                      disabled={isPending}
                      className="text-[var(--muted-foreground)] hover:text-[#FF3333] transition-colors disabled:opacity-50"
                      title="Delete Module"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>

                {/* LESSONS LIST */}
                {isExpanded && (
                  <div className="bg-[var(--surface)] pl-8 flex flex-col gap-px bg-[var(--border)]">
                    {moduleLessons.map(lesson => (
                      <div key={lesson._id.toString()} className="bg-[var(--background)] p-3 flex justify-between items-center border-l-2 border-transparent hover:border-[var(--accent)]">
                        <div>
                          <span className="text-sm font-medium">{lesson.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <LessonStatusToggle lessonId={lesson._id.toString()} isPublished={lesson.isPublished} courseId={courseId} />
                          <button
                            type="button"
                            onClick={() => {
                              setImportLessonModalModuleId(modIdStr);
                              setImportLessonModalLessonId(lesson._id.toString());
                              setImportLessonError(null);
                              setImportLessonTab("lesson");
                            }}
                            className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--accent)] font-mono text-[10px] uppercase tracking-widest transition-colors"
                          >
                            <Upload size={12} /> IMPORT JSON
                          </button>
                          <Link 
                            href={`/admin/courses/${courseId}/lesson/${lesson._id.toString()}`}
                            className="flex items-center gap-2 text-[var(--accent)] hover:underline font-mono text-[10px] uppercase tracking-widest"
                          >
                            <FileEdit size={14} /> BUILD CONTENT
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setMoveLessonModalState({
                                isOpen: true,
                                lessonId: lesson._id.toString(),
                                currentModuleId: modIdStr,
                                lessonTitle: lesson.title
                              });
                            }}
                            disabled={isPending}
                            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 ml-2"
                            title="Move Lesson"
                          >
                            <MoveRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteModalState({
                                isOpen: true,
                                type: "lesson",
                                id: lesson._id.toString(),
                                parentId: modIdStr,
                                title: lesson.title
                              });
                            }}
                            disabled={isPending}
                            className="text-[var(--muted-foreground)] hover:text-[#FF3333] transition-colors disabled:opacity-50 ml-2"
                            title="Delete Lesson"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* ADD LESSON FORM */}
                    <form onSubmit={(e) => handleAddLesson(e, modIdStr)} className="bg-[var(--surface)] p-3 flex gap-2 items-center">
                      <button 
                        type="button"
                        className="flex items-center text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors"
                        onClick={() => {
                          setImportLessonModalModuleId(modIdStr);
                          setImportLessonModalLessonId(null);
                          setImportLessonError(null);
                          setImportLessonTab("lesson");
                        }}
                        title="Import Lesson JSON"
                      >
                        <Plus size={14} className="mr-2" />
                      </button>
                      <input name="title" required placeholder="Lesson Title" className="p-1.5 bg-[var(--background)] border border-[var(--border)] rounded-none text-xs focus:outline-none focus:border-[var(--accent)] flex-1" />
                      <input name="slug" required placeholder="lesson-slug" className="p-1.5 bg-[var(--background)] border border-[var(--border)] rounded-none text-xs focus:outline-none focus:border-[var(--accent)] flex-1" />
                      <button type="submit" disabled={isPending} className="px-3 py-1.5 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-widest rounded-none hover:opacity-90 disabled:opacity-50">
                        ADD LESSON
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {importLessonModalModuleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => { setImportLessonModalModuleId(null); setImportLessonModalLessonId(null); }}>
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div>
                <h3 className="font-bold text-[var(--foreground)]">{importLessonModalLessonId ? "Update Lesson & Assets" : "Import Lesson JSON"}</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
                  ATTACH RESOURCES TO THIS LESSON
                </p>
              </div>
              <button onClick={() => { setImportLessonModalModuleId(null); setImportLessonModalLessonId(null); }} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
              {(["lesson", "quiz", "exercises", "resources"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setImportLessonTab(tab)}
                  className={`flex-1 p-3 text-center font-mono text-[10px] uppercase tracking-widest transition-colors ${importLessonTab === tab ? "bg-[var(--surface)] text-[var(--foreground)] border-b-2 border-[var(--accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] bg-[var(--surface-2)]"}`}
                >
                  {tab} JSON
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="p-4 bg-[var(--surface)] flex-1">
              <div className="flex justify-between items-center mb-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Paste {importLessonTab} JSON</label>
                <button 
                  onClick={loadImportLessonTemplate}
                  className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] rounded-none font-mono text-[10px] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  LOAD TEMPLATE
                </button>
              </div>
              <textarea
                value={
                  importLessonTab === "lesson" ? lessonJson :
                  importLessonTab === "quiz" ? quizJson :
                  importLessonTab === "exercises" ? exercisesJson :
                  resourcesJson
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (importLessonTab === "lesson") setLessonJson(val);
                  else if (importLessonTab === "quiz") setQuizJson(val);
                  else if (importLessonTab === "exercises") setExercisesJson(val);
                  else setResourcesJson(val);
                }}
                className="w-full h-64 p-4 bg-[#0a0a0a] text-[#00ff00] font-mono text-sm border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] resize-y rounded-none"
                placeholder={`Paste ${importLessonTab} JSON here...`}
                spellCheck={false}
              />
              {importLessonError && (
                <div className="mt-2 text-red-500 font-mono text-[10px] uppercase tracking-widest">
                  ERROR: {importLessonError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-2)] flex justify-end gap-3">
              <button
                onClick={() => setImportLessonModalModuleId(null)}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                disabled={isPending}
              >
                CANCEL
              </button>
              <button
                onClick={handleImportLessonJson}
                disabled={isPending}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                <Upload size={14} />
                {isPending ? "IMPORTING..." : "IMPORT ALL"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={deleteModalState.isOpen}
        onClose={() => !isPending && setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        title="Confirm Deletion"
      >
        <p className="text-sm text-[var(--foreground)] mb-6 leading-relaxed">
          Are you absolutely sure you want to delete the {deleteModalState.type} <strong>&quot;{deleteModalState.title}&quot;</strong>? 
          {deleteModalState.type === "module" ? " This will permanently delete all its lessons and quizzes." : " This will permanently delete the lesson and its associated quiz."}
          <br /><br />
          <span className="text-[#FF3333] font-mono text-[10px] uppercase tracking-widest">
            THIS ACTION CANNOT BE UNDONE.
          </span>
        </p>

        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4 mt-2">
          <button
            onClick={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
            disabled={isPending}
            className="px-4 py-2 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] font-mono text-[10px] uppercase tracking-widest transition-colors rounded-none disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={() => {
              if (deleteModalState.type === "module" && deleteModalState.id) {
                startTransition(async () => {
                  try {
                    await deleteModuleAction(courseId, deleteModalState.id!);
                    setDeleteModalState(prev => ({ ...prev, isOpen: false }));
                  } catch (err: any) {
                    alert(err.message);
                  }
                });
              } else if (deleteModalState.type === "lesson" && deleteModalState.id && deleteModalState.parentId) {
                startTransition(async () => {
                  try {
                    await deleteLessonAction(courseId, deleteModalState.parentId!, deleteModalState.id!);
                    setDeleteModalState(prev => ({ ...prev, isOpen: false }));
                  } catch (err: any) {
                    alert(err.message);
                  }
                });
              }
            }}
            disabled={isPending}
            className="px-4 py-2 border border-[#FF3333] bg-[#FF3333] text-white font-mono text-[10px] uppercase tracking-widest hover:bg-[#FF3333]/90 transition-colors rounded-none disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? "DELETING..." : `YES, DELETE ${deleteModalState.type?.toUpperCase()}`}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={moveLessonModalState.isOpen}
        onClose={() => !isPending && setMoveLessonModalState(prev => ({ ...prev, isOpen: false }))}
        title="Move Lesson"
      >
        <p className="text-sm text-[var(--foreground)] mb-6 leading-relaxed">
          Move <strong>&quot;{moveLessonModalState.lessonTitle}&quot;</strong> to a different module:
        </p>

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-6">
          {modules.map(m => {
            const mIdStr = m._id.toString();
            if (mIdStr === moveLessonModalState.currentModuleId) return null;
            return (
              <button
                key={mIdStr}
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await moveLessonAction(moveLessonModalState.lessonId!, mIdStr, courseId);
                      setMoveLessonModalState(prev => ({ ...prev, isOpen: false }));
                    } catch (err: any) {
                      alert(err.message);
                    }
                  });
                }}
                className="text-left px-4 py-3 border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50 flex items-center justify-between group"
              >
                <span className="font-semibold text-sm text-[var(--foreground)]">{m.title}</span>
                <MoveRight size={14} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
              </button>
            );
          })}
          {modules.length <= 1 && (
            <div className="text-[var(--muted-foreground)] font-mono text-[10px] uppercase tracking-widest text-center py-4">
              NO OTHER MODULES TO MOVE TO
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4 mt-2">
          <button
            onClick={() => setMoveLessonModalState(prev => ({ ...prev, isOpen: false }))}
            disabled={isPending}
            className="px-4 py-2 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] font-mono text-[10px] uppercase tracking-widest transition-colors rounded-none disabled:opacity-50"
          >
            CANCEL
          </button>
        </div>
      </Modal>
    </div>
  );
}
