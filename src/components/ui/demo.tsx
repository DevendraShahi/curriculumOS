"use client";

import Plan, { type AgentPlanTask } from "@/components/ui/agent-plan";

const demoTasks: AgentPlanTask[] = [
  {
    id: "1",
    title: "Demo Task",
    description: "Example task for agent plan UI",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "1.1",
        title: "Demo Subtask",
        description: "Example subtask details",
        status: "pending",
        priority: "medium",
      },
    ],
  },
];

export function Demo() {
  return (
    <div className="flex h-full w-full flex-col p-4">
      <Plan tasks={demoTasks} />
    </div>
  );
}
