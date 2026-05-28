"use client";

import { CheckSquare, FolderGit2, TestTube2, Settings2 } from "lucide-react";

type SidebarPanel = "task" | "files" | "tests" | "settings";

type ActivityRailProps = {
  activePanel: SidebarPanel | null;
  onTogglePanel: (panel: SidebarPanel) => void;
};

const items: {
  id: SidebarPanel;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "task", label: "Task", icon: <CheckSquare size={20} /> },
  { id: "files", label: "Files", icon: <FolderGit2 size={20} /> },
  { id: "tests", label: "Tests", icon: <TestTube2 size={20} /> },
  { id: "settings", label: "Settings", icon: <Settings2 size={20} /> },
];

export function ActivityRail({ activePanel, onTogglePanel }: ActivityRailProps) {
  return (
    <aside className="flex flex-row lg:flex-col lg:min-h-0 items-center justify-start lg:justify-start overflow-x-auto lg:overflow-x-hidden border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--surface-2)] py-2 lg:py-2 px-2 lg:px-0 w-full lg:w-[48px] shrink-0 gap-2 lg:gap-0">
      {items.map((item) => {
        const active = activePanel === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onTogglePanel(item.id)}
            title={item.label}
            aria-label={`Toggle ${item.label} panel`}
            aria-expanded={active}
            className={[
              "mb-0 lg:mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
              active
                ? "bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--border)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {item.icon}
          </button>
        );
      })}
    </aside>
  );
}
