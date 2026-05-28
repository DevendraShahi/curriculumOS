/** ExplorerPanel — file tree for the sandpack virtual FS */
"use client";

import { useSandpack } from "@codesandbox/sandpack-react";
import { Files, FileCode, FileJson, FileText, Lock } from "lucide-react";

function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html") return <FileCode size={13} style={{ color: "#fb923c", flexShrink: 0 }} />;
  if (ext === "css")  return <FileCode size={13} style={{ color: "#60a5fa", flexShrink: 0 }} />;
  if (ext === "js" || ext === "ts") return <FileCode size={13} style={{ color: "#fbbf24", flexShrink: 0 }} />;
  if (ext === "json") return <FileJson size={13} style={{ color: "#4ade80", flexShrink: 0 }} />;
  return <FileText size={13} style={{ color: "rgba(255,255,255,.3)", flexShrink: 0 }} />;
}

export function ExplorerPanel() {
  const { sandpack } = useSandpack();
  const { files, activeFile, setActiveFile } = sandpack;

  const paths = Object.keys(files).filter((p) => !p.startsWith("/node_modules"));

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
      <div className="ide-panel-hdr">
        <Files />
        Explorer
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
        {paths.map((path) => {
          const isActive   = path === activeFile;
          const isReadOnly = !!files[path]?.readOnly;
          const name       = path.replace(/^\//, "");

          return (
            <button
              key={path}
              onClick={() => setActiveFile(path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "6px 10px",
                borderRadius: "5px",
                border: isActive ? "1px solid rgba(0,240,255,.15)" : "1px solid transparent",
                background: isActive ? "rgba(0,240,255,.07)" : "transparent",
                color: isActive ? "#00F0FF" : "rgba(255,255,255,.45)",
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: "12px",
                letterSpacing: "0.02em",
                cursor: "pointer",
                transition: "all .15s",
                textAlign: "left",
                marginBottom: "2px",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,.04)";
                  e.currentTarget.style.color = "rgba(255,255,255,.75)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255,255,255,.45)";
                }
              }}
            >
              <FileIcon path={path} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </span>
              {isReadOnly && <Lock size={11} style={{ opacity: .35, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
