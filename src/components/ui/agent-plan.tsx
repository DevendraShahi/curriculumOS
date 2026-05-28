"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

export type AgentPlanStatus =
  | "completed"
  | "in-progress"
  | "pending"
  | "need-help"
  | "failed";

export interface AgentPlanSubtask {
  id: string;
  title: string;
  description: string;
  status: AgentPlanStatus;
  priority: "high" | "medium" | "low";
  tools?: string[];
  href?: string;
}

export interface AgentPlanTask {
  id: string;
  title: string;
  description: string;
  status: AgentPlanStatus;
  priority: "high" | "medium" | "low";
  level: number;
  dependencies: string[];
  subtasks: AgentPlanSubtask[];
}

type AgentPlanProps = {
  tasks: AgentPlanTask[];
  defaultExpandedTaskIds?: string[];
};

function statusIcon(status: AgentPlanStatus, size = "h-4.5 w-4.5") {
  if (status === "completed") return <CheckCircle2 className={`${size} text-green-500`} />;
  if (status === "in-progress") return <CircleDotDashed className={`${size} text-blue-500`} />;
  if (status === "need-help") return <CircleAlert className={`${size} text-yellow-500`} />;
  if (status === "failed") return <CircleX className={`${size} text-red-500`} />;
  return <Circle className={`${size} text-muted-foreground`} />;
}

export default function Plan({ tasks, defaultExpandedTaskIds }: AgentPlanProps) {
  const baseEase: [number, number, number, number] = [0.2, 0.65, 0.3, 0.9];
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const firstTaskId = tasks[0]?.id;
  const initialExpanded = defaultExpandedTaskIds?.length
    ? defaultExpandedTaskIds
    : firstTaskId
      ? [firstTaskId]
      : [];

  const [expandedTasks, setExpandedTasks] = useState<string[]>(initialExpanded);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0.2 : 0.28,
        ease: baseEase,
      },
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -5,
      transition: { duration: 0.15 },
    },
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: {
      height: "auto",
      opacity: 1,
      overflow: "visible",
      transition: {
        duration: 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren",
        ease: baseEase,
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden",
      transition: { duration: 0.2, ease: baseEase },
    },
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: prefersReducedMotion ? 0.2 : 0.24,
        ease: baseEase,
      },
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -10,
      transition: { duration: 0.15 },
    },
  };

  const subtaskDetailsVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: {
      opacity: 1,
      height: "auto",
      overflow: "visible",
      transition: { duration: 0.25, ease: baseEase },
    },
  };

  return (
    <div className="h-full overflow-auto bg-background p-2 text-foreground">
      <motion.div
        className="overflow-hidden rounded-lg border border-border bg-card shadow"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: baseEase },
        }}
      >
        <LayoutGroup>
          <div className="overflow-hidden p-4">
            <ul className="space-y-1 overflow-hidden">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <motion.li
                    key={task.id}
                    className={`${index !== 0 ? "mt-1 pt-2" : ""}`}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    <motion.div
                      className="group flex items-center rounded-md px-3 py-1.5"
                      whileHover={{
                        backgroundColor: "rgba(0,0,0,0.03)",
                        transition: { duration: 0.2 },
                      }}
                    >
                      <div className="mr-2 flex-shrink-0">{statusIcon(task.status)}</div>

                      <motion.div
                        className="flex min-w-0 flex-grow cursor-pointer items-center justify-between"
                        onClick={() => toggleTaskExpansion(task.id)}
                      >
                        <div className="mr-2 flex-1 truncate">
                          <span className={isCompleted ? "text-muted-foreground line-through" : ""}>
                            {task.title}
                          </span>
                        </div>

                        <div className="flex flex-shrink-0 items-center space-x-2 text-xs">
                          {task.dependencies.length > 0 && (
                            <div className="mr-2 flex items-center">
                              <div className="flex flex-wrap gap-1">
                                {task.dependencies.map((dep) => (
                                  <span
                                    key={`${task.id}-${dep}`}
                                    className="rounded bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground shadow-sm"
                                  >
                                    {dep}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              task.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : task.status === "in-progress"
                                  ? "bg-blue-100 text-blue-700"
                                  : task.status === "need-help"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : task.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                      </motion.div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div
                          className="relative overflow-hidden"
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          layout
                        >
                          <div className="absolute bottom-0 left-[20px] top-0 border-l-2 border-dashed border-muted-foreground/30" />
                          <ul className="border-muted mb-1.5 ml-3 mr-2 mt-1 space-y-0.5">
                            {task.subtasks.map((subtask) => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubtaskExpanded = expandedSubtasks[subtaskKey];

                              return (
                                <motion.li
                                  key={subtask.id}
                                  className="group flex flex-col py-0.5 pl-6"
                                  onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                                  variants={subtaskVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  layout
                                >
                                  <motion.div
                                    className="flex flex-1 items-center rounded-md p-1"
                                    whileHover={{
                                      backgroundColor: "rgba(0,0,0,0.03)",
                                      transition: { duration: 0.2 },
                                    }}
                                    layout
                                  >
                                    <div className="mr-2 flex-shrink-0">{statusIcon(subtask.status, "h-3.5 w-3.5")}</div>

                                    <span
                                      className={`cursor-pointer text-sm ${subtask.status === "completed" ? "text-muted-foreground line-through" : ""}`}
                                    >
                                      {subtask.href ? (
                                        <Link href={subtask.href} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                          {subtask.title}
                                        </Link>
                                      ) : (
                                        subtask.title
                                      )}
                                    </span>
                                  </motion.div>

                                  <AnimatePresence mode="wait">
                                    {isSubtaskExpanded && (
                                      <motion.div
                                        className="text-muted-foreground mt-1 overflow-hidden border-l border-dashed border-foreground/20 pl-5 text-xs"
                                        variants={subtaskDetailsVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="hidden"
                                        layout
                                      >
                                        <p className="py-1">{subtask.description}</p>
                                        {subtask.tools && subtask.tools.length > 0 && (
                                          <div className="mb-1 mt-0.5 flex flex-wrap items-center gap-1.5">
                                            <span className="font-medium text-muted-foreground">MCP Servers:</span>
                                            <div className="flex flex-wrap gap-1">
                                              {subtask.tools.map((tool) => (
                                                <span
                                                  key={`${subtask.id}-${tool}`}
                                                  className="rounded bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground shadow-sm"
                                                >
                                                  {tool}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}
