/** ActivityRail — icon-only vertical nav strip */
"use client";

import { CheckSquare, Files, ListChecks } from "lucide-react";

export type SidebarTab = "task" | "files" | "checks" | null;

interface ActivityRailProps {
  active: SidebarTab;
  onToggle: (tab: SidebarTab) => void;
}

const TABS = [
  { id: "task"   as SidebarTab, Icon: CheckSquare,  label: "Task"    },
  { id: "files"  as SidebarTab, Icon: Files,        label: "Files"   },
  { id: "checks" as SidebarTab, Icon: ListChecks,   label: "Checks"  },
] as const;

export function ActivityRail({ active, onToggle }: ActivityRailProps) {
  return (
    <nav className="ide-rail">
      {TABS.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={`ide-rail-btn ${active === id ? "on" : ""}`}
          onClick={() => onToggle(id)}
          title={label}
        >
          <Icon strokeWidth={1.5} />
        </button>
      ))}
    </nav>
  );
}
