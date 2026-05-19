"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PlaygroundTemplate = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  runtime: string;
  visibility: "public" | "tenant_members";
  isPublished: boolean;
  starterFiles: Array<{
    path: string;
    language: string;
    content: string;
  }>;
  validationRules?: Array<{
    id: string;
    label: string;
    type: "file_exists" | "file_includes" | "file_regex";
    filePath: string;
    value?: string;
    flags?: string;
    caseSensitive?: boolean;
    required?: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

type PlaygroundSession = {
  id: string;
  userId: string;
  templateId: string | null;
  forkedFromSessionId: string | null;
  title: string;
  visibility: "private" | "unlisted" | "public";
  status: "active" | "archived";
  files: Array<{
    path: string;
    language: string;
    content: string;
  }>;
  latestRunId: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewer: {
    canEdit: boolean;
  };
};

type PlaygroundRun = {
  id: string;
  sessionId: string;
  userId: string;
  mode: "run" | "test" | "check";
  status: "queued" | "running" | "succeeded" | "failed" | "timed_out";
  runtime: string;
  exitCode: number | null;
  summary: string | null;
  rawLog: string | null;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    message?: string;
  }> | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
};

type RunHistoryFilter = "all" | PlaygroundRun["mode"];

type PlaygroundRunsResponse = {
  items: PlaygroundRun[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: string;
};

type PreviewPanelMode = "preview" | "console" | "runs";

type SandboxValidationResult = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

function cloneFiles(files: PlaygroundSession["files"]): PlaygroundSession["files"] {
  return files.map((file) => ({
    path: file.path,
    language: file.language,
    content: file.content,
  }));
}

function formatTime(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "--";
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(2)}s`;
}

function getRunModeBadgeClass(mode: PlaygroundRun["mode"]): string {
  if (mode === "test") {
    return "border-[#5A89FF]/40 bg-[#5A89FF]/10 text-[#5A89FF]";
  }
  if (mode === "check") {
    return "border-[#21B8A8]/40 bg-[#21B8A8]/10 text-[#21B8A8]";
  }
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";
}

function getRunStatusClass(status: PlaygroundRun["status"]): string {
  if (status === "succeeded") return "text-[#21B8A8]";
  if (status === "failed" || status === "timed_out") return "text-[#FF7A2F]";
  if (status === "running" || status === "queued") return "text-[#5A89FF]";
  return "text-[var(--foreground)]";
}

function formatRunChecksSummary(
  checks: PlaygroundRun["checks"]
): { text: string; toneClass: string } | null {
  if (!checks || checks.length === 0) return null;
  const passed = checks.filter((check) => check.passed).length;
  const failed = checks.length - passed;
  return {
    text: `${passed}/${checks.length} checks passed`,
    toneClass: failed === 0 ? "text-[#21B8A8]" : "text-[#FF7A2F]",
  };
}

function buildShareUrl(sessionId: string): string {
  const url = new URL(`${window.location.origin}/playground/sandbox`);
  url.searchParams.set("session", sessionId);
  const currentFilter = new URL(window.location.href).searchParams.get("runFilter");
  if (currentFilter === "run" || currentFilter === "test" || currentFilter === "check") {
    url.searchParams.set("runFilter", currentFilter);
  }
  return url.toString();
}

function syncSessionQueryParam(sessionId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState(null, "", url.toString());
}

function syncRunFilterQueryParam(filter: RunHistoryFilter) {
  const url = new URL(window.location.href);
  if (filter === "all") {
    url.searchParams.delete("runFilter");
  } else {
    url.searchParams.set("runFilter", filter);
  }
  window.history.replaceState(null, "", url.toString());
}

function normalizePathInput(value: string): string | null {
  const normalized = value.trim().replaceAll("\\", "/");
  if (!normalized) return null;
  if (normalized.startsWith("/")) return null;
  if (normalized.length > 200) return null;
  if (!/^[a-zA-Z0-9._/-]+$/.test(normalized)) return null;
  return normalized;
}

function inferLanguageFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".py")) return "python";
  return "text";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPreviewDocument(files: PlaygroundSession["files"]): string {
  const htmlFile =
    files.find((file) => file.path.toLowerCase() === "index.html") ??
    files.find((file) => file.path.toLowerCase().endsWith(".html")) ??
    null;
  const cssFiles = files.filter((file) => file.path.toLowerCase().endsWith(".css"));
  const jsFiles = files.filter((file) => {
    const lower = file.path.toLowerCase();
    return lower.endsWith(".js") || lower.endsWith(".jsx");
  });

  const unsupportedTs = files.some((file) => {
    const lower = file.path.toLowerCase();
    return lower.endsWith(".ts") || lower.endsWith(".tsx");
  });

  const cssBundle = cssFiles.map((file) => `\n/* ${file.path} */\n${file.content}`).join("\n");
  const jsBundle = jsFiles.map((file) => `\n// ${file.path}\n${file.content}`).join("\n");

  const body = htmlFile
    ? htmlFile.content
    : `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Sandbox Preview</title>
  </head>
  <body>
    <main style="font-family: ui-sans-serif, system-ui; padding: 20px;">
      <h2>Sandbox Preview</h2>
      <p>No HTML file found. Create <code>index.html</code> to control the preview.</p>
      <div id="root"></div>
    </main>
  </body>
</html>`;

  const instrumentationScript = `
<script>
(() => {
  const post = (kind, message) => {
    parent.postMessage({ source: "playground-preview", kind, message }, "*");
  };

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    post("log", args.map((value) => String(value)).join(" "));
    originalLog(...args);
  };

  console.warn = (...args) => {
    post("warn", args.map((value) => String(value)).join(" "));
    originalWarn(...args);
  };

  console.error = (...args) => {
    post("error", args.map((value) => String(value)).join(" "));
    originalError(...args);
  };

  window.addEventListener("error", (event) => {
    post("error", event.message || "Unhandled runtime error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason ? String(event.reason) : "Unhandled promise rejection";
    post("error", reason);
  });

  post("info", "Preview loaded");
})();
</script>`;

  const runtimeScript = jsBundle
    ? `<script type="module">\n${jsBundle}\n<\/script>`
    : "";

  const tsNotice = unsupportedTs
    ? `<div style="position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:8px 10px;font:12px ui-monospace,monospace;border-radius:8px;opacity:0.9;">TS/TSX preview requires transpilation</div>`
    : "";

  const styleTag = `<style>\n${cssBundle}\n</style>`;
  const injection = `${styleTag}\n${instrumentationScript}\n${runtimeScript}\n${tsNotice}`;

  if (body.includes("</body>")) {
    return body.replace("</body>", `${injection}\n</body>`);
  }
  if (body.includes("</html>")) {
    return body.replace("</html>", `${injection}\n</html>`);
  }

  return `${body}\n${injection}`;
}

function inferSandboxRuntime(files: PlaygroundSession["files"]): "web" | "node" | "python" | "text" {
  if (files.some((file) => file.path.toLowerCase().endsWith(".html"))) return "web";
  if (files.some((file) => file.path.toLowerCase().endsWith(".py"))) return "python";
  if (
    files.some((file) => {
      const lower = file.path.toLowerCase();
      return (
        lower.endsWith(".js") ||
        lower.endsWith(".jsx") ||
        lower.endsWith(".ts") ||
        lower.endsWith(".tsx")
      );
    })
  ) {
    return "node";
  }
  return "text";
}

function findLatestPreviewError(previewLogs: string[]): string | null {
  for (let index = previewLogs.length - 1; index >= 0; index -= 1) {
    const line = previewLogs[index];
    if (line.toLowerCase().includes("[error]")) {
      return line;
    }
  }
  return null;
}

function buildValidationResults(params: {
  files: PlaygroundSession["files"];
  runHistory: PlaygroundRun[];
  previewLogs: string[];
  dirty: boolean;
}): SandboxValidationResult[] {
  const runtime = inferSandboxRuntime(params.files);
  const hasSourceFiles = params.files.some((file) => file.content.trim().length > 0);
  const hasRuntimeEntry =
    runtime === "web"
      ? params.files.some((file) => file.path.toLowerCase().endsWith(".html"))
      : runtime === "python"
      ? params.files.some((file) => file.path.toLowerCase().endsWith(".py"))
      : runtime === "node"
      ? params.files.some((file) => {
          const lower = file.path.toLowerCase();
          return (
            lower.endsWith(".js") ||
            lower.endsWith(".jsx") ||
            lower.endsWith(".ts") ||
            lower.endsWith(".tsx")
          );
        })
      : params.files.length > 0;

  const hasBlockedMarkers = params.files.some((file) =>
    /\b(TODO|FIXME|coming next)\b/i.test(file.content)
  );
  const latestRun = params.runHistory[0] ?? null;
  const previewError = findLatestPreviewError(params.previewLogs);

  return [
    {
      id: "source",
      label: "Source files contain implementation",
      passed: hasSourceFiles,
      detail: hasSourceFiles
        ? "At least one file has non-empty code/content."
        : "No implementation detected yet.",
    },
    {
      id: "entry",
      label: "Runtime entry file is present",
      passed: hasRuntimeEntry,
      detail: hasRuntimeEntry
        ? `Detected ${runtime} entry files.`
        : `Missing a valid entry file for ${runtime} runtime.`,
    },
    {
      id: "execute",
      label: "Code has been executed",
      passed: Boolean(latestRun),
      detail: latestRun
        ? `Last run status: ${latestRun.status}.`
        : "Run the session at least once to validate behavior.",
    },
    {
      id: "runtime-error",
      label: "No preview runtime error detected",
      passed: !previewError,
      detail: previewError ?? "No preview errors reported.",
    },
    {
      id: "quality",
      label: "No unresolved TODO/FIXME markers",
      passed: !hasBlockedMarkers,
      detail: hasBlockedMarkers
        ? "Found TODO/FIXME marker(s) in current files."
        : "No unresolved implementation markers found.",
    },
    {
      id: "save",
      label: "Current changes are saved",
      passed: !params.dirty,
      detail: params.dirty ? "There are unsaved file edits." : "Session is saved.",
    },
  ];
}

function mapRunChecksToValidationResults(
  checks: PlaygroundRun["checks"]
): SandboxValidationResult[] {
  if (!checks || checks.length === 0) return [];
  return checks.map((check) => ({
    id: check.id,
    label: check.label,
    passed: check.passed,
    detail: check.message ?? (check.passed ? "Check passed." : "Check failed."),
  }));
}

async function tryCopyToClipboard(value: string): Promise<boolean> {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeErrorMessage(code: string): string {
  if (code === "UNAUTHORIZED") {
    return "Sign in to create, save, and run playground sessions.";
  }
  if (code === "FORBIDDEN") {
    return "You do not have access to this playground session.";
  }
  if (code === "PLAYGROUND_SESSION_NOT_FOUND") {
    return "Playground session not found.";
  }
  if (code === "PLAYGROUND_SESSION_ARCHIVED") {
    return "This session is archived and cannot be edited.";
  }
  if (code.startsWith("INVALID_PLAYGROUND")) {
    return "The playground request payload is invalid.";
  }
  return "Unexpected playground error. Try again.";
}

async function fetchApiData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  let payload: ApiSuccess<T> | ApiFailure | null = null;
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    throw new Error("INTERNAL_ERROR");
  }

  if (!response.ok || !payload || !payload.ok) {
    const code = payload && !payload.ok ? payload.error : "INTERNAL_ERROR";
    throw new Error(code || "INTERNAL_ERROR");
  }

  return payload.data;
}

export default function SandboxPage() {
  const [templates, setTemplates] = useState<PlaygroundTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [draftFiles, setDraftFiles] = useState<PlaygroundSession["files"]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [newFilePath, setNewFilePath] = useState<string>("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [runHistory, setRunHistory] = useState<PlaygroundRun[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<SandboxValidationResult[] | null>(
    null
  );
  const [previewLogs, setPreviewLogs] = useState<string[]>([]);
  const [mentorMessage, setMentorMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewPanelMode>("preview");
  const [runHistoryFilter, setRunHistoryFilter] = useState<RunHistoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [runAction, setRunAction] = useState<"idle" | "run" | "test" | "check">(
    "idle"
  );
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );

  const fallbackFiles = useMemo(() => {
    if (selectedTemplate) {
      return cloneFiles(selectedTemplate.starterFiles);
    }
    return [
      {
        path: "main.ts",
        language: "typescript",
        content: 'console.log("Hello Playground");',
      },
    ];
  }, [selectedTemplate]);

  const files = session ? draftFiles : fallbackFiles;
  const resolvedActiveFilePath =
    files.find((file) => file.path === activeFilePath)?.path ?? files[0]?.path ?? "";
  const activeFile = files.find((file) => file.path === resolvedActiveFilePath) ?? null;

  const missionSteps = useMemo(() => {
    const runtimeLabel = selectedTemplate?.runtime ?? "node";
    return [
      `Inspect starter files and map the objective (${runtimeLabel}).`,
      "Implement the required behavior in the primary module.",
      "Run preview and verify visible behavior + console output.",
      "Run sandbox execution and validate logs before submitting.",
    ];
  }, [selectedTemplate]);

  const missionCheckpoints = useMemo(() => {
    const hasMarkup = files.some((file) => file.path.toLowerCase().endsWith(".html"));
    const hasStyles = files.some((file) => file.path.toLowerCase().endsWith(".css"));
    const hasScript = files.some((file) => {
      const lower = file.path.toLowerCase();
      return (
        lower.endsWith(".js") ||
        lower.endsWith(".jsx") ||
        lower.endsWith(".ts") ||
        lower.endsWith(".tsx") ||
        lower.endsWith(".py")
      );
    });

    return [
      {
        label: "Files mapped to mission",
        done: files.length > 0,
      },
      {
        label: "Core runtime files present",
        done: hasMarkup || hasStyles || hasScript,
      },
      {
        label: "Code executed at least once",
        done: runHistory.length > 0,
      },
      {
        label: "Changes saved",
        done: Boolean(session && !dirty),
      },
    ];
  }, [dirty, files, runHistory.length, session]);

  const previewSource = useMemo(() => buildPreviewDocument(files), [files]);
  const latestPreviewError = useMemo(
    () => findLatestPreviewError(previewLogs),
    [previewLogs]
  );
  const filteredRunHistory = useMemo(() => {
    if (runHistoryFilter === "all") return runHistory;
    return runHistory.filter((run) => run.mode === runHistoryFilter);
  }, [runHistory, runHistoryFilter]);
  const runHistoryCounts = useMemo(
    () => ({
      all: runHistory.length,
      run: runHistory.filter((item) => item.mode === "run").length,
      test: runHistory.filter((item) => item.mode === "test").length,
      check: runHistory.filter((item) => item.mode === "check").length,
    }),
    [runHistory]
  );

  useEffect(() => {
    function onPreviewMessage(event: MessageEvent) {
      const payload = event.data as
        | { source?: string; kind?: string; message?: string }
        | undefined;

      if (!payload || payload.source !== "playground-preview") return;
      const kind = payload.kind ?? "log";
      const message = payload.message ?? "";
      const line = `[${kind}] ${message}`;

      setPreviewLogs((previous) => [...previous, line].slice(-120));
    }

    window.addEventListener("message", onPreviewMessage);
    return () => window.removeEventListener("message", onPreviewMessage);
  }, []);

  async function loadRunHistory(sessionId: string) {
    const data = await fetchApiData<PlaygroundRunsResponse>(
      `/api/v1/playground/sessions/${encodeURIComponent(sessionId)}/runs?limit=10`
    );
    setRunHistory(data.items);
    setExpandedRunId((previous) =>
      previous && data.items.some((item) => item.id === previous)
        ? previous
        : data.items[0]?.id ?? null
    );
  }

  async function createSession(options?: {
    templateId?: string;
    forkFromSessionId?: string;
    visibility?: "private" | "unlisted" | "public";
  }): Promise<PlaygroundSession> {
    const payload: Record<string, unknown> = {};
    if (options?.templateId) payload.templateId = options.templateId;
    if (options?.forkFromSessionId) payload.forkFromSessionId = options.forkFromSessionId;
    if (options?.visibility) payload.visibility = options.visibility;

    return fetchApiData<PlaygroundSession>("/api/v1/playground/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  function hydrateSessionState(target: PlaygroundSession) {
    const sessionFiles = cloneFiles(target.files);
    const firstFile = sessionFiles[0]?.path ?? "";

    setSession(target);
    setDraftFiles(sessionFiles);
    setActiveFilePath(firstFile);
    setOpenTabs(firstFile ? [firstFile] : []);
    setDirty(false);
    setShareUrl(buildShareUrl(target.id));
    setExpandedRunId(null);
    setValidationResults(null);
    setMentorMessage(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeSandbox() {
      const params = new URLSearchParams(window.location.search);
      const sessionQuery = params.get("session");
      const templateQuery = params.get("template");
      const runFilterQuery = params.get("runFilter");

      if (
        runFilterQuery === "run" ||
        runFilterQuery === "test" ||
        runFilterQuery === "check"
      ) {
        setRunHistoryFilter(runFilterQuery);
      } else {
        setRunHistoryFilter("all");
      }

      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        const templatesPayload = await fetchApiData<{ items: PlaygroundTemplate[] }>(
          "/api/v1/playground/templates?limit=20"
        );
        if (cancelled) return;
        const templateItems = templatesPayload.items;
        setTemplates(templateItems);

        const initialTemplate =
          templateItems.find(
            (template) => template.id === templateQuery || template.slug === templateQuery
          ) ?? templateItems[0] ?? null;

        if (initialTemplate) {
          setSelectedTemplateId(initialTemplate.id);
        }

        if (sessionQuery) {
          const loadedSession = await fetchApiData<PlaygroundSession>(
            `/api/v1/playground/sessions/${encodeURIComponent(sessionQuery)}`
          );
          if (cancelled) return;
          hydrateSessionState(loadedSession);
          await loadRunHistory(loadedSession.id);
          return;
        }

        const createdSession = await createSession({
          templateId: initialTemplate?.id,
        });
        if (cancelled) return;
        hydrateSessionState(createdSession);
        syncSessionQueryParam(createdSession.id);
        await loadRunHistory(createdSession.id);
      } catch (bootstrapError) {
        if (cancelled) return;
        if (bootstrapError instanceof Error) {
          setError(normalizeErrorMessage(bootstrapError.message));
        } else {
          setError("Failed to initialize playground.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initializeSandbox();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveFiles(): Promise<PlaygroundSession | null> {
    if (!session || !session.viewer.canEdit) return null;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const updated = await fetchApiData<PlaygroundSession>(
        `/api/v1/playground/sessions/${encodeURIComponent(session.id)}/files`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            mode: "replace",
            files: draftFiles,
          }),
        }
      );

      setSession(updated);
      setDraftFiles(cloneFiles(updated.files));
      setDirty(false);
      setInfo(`Saved at ${formatTime(updated.updatedAt)}`);
      return updated;
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(normalizeErrorMessage(saveError.message));
      } else {
        setError("Failed to save files.");
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  function mergeRunIntoHistory(run: PlaygroundRun) {
    setRunHistory((previous) => {
      const dedup = new Map<string, PlaygroundRun>();
      dedup.set(run.id, run);
      for (const row of previous) {
        if (!dedup.has(row.id)) dedup.set(row.id, row);
      }
      return Array.from(dedup.values()).slice(0, 10);
    });
    setExpandedRunId(run.id);
  }

  async function executeSessionRun(mode: "run" | "test" | "check") {
    if (!session || !session.viewer.canEdit || runAction !== "idle") return null;

    setRunAction(mode);
    setError(null);
    setInfo(null);

    try {
      let workingSession = session;
      if (dirty) {
        const saved = await saveFiles();
        if (!saved) return null;
        workingSession = saved;
      }

      const run = await fetchApiData<PlaygroundRun>(
        `/api/v1/playground/sessions/${encodeURIComponent(workingSession.id)}/run`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            mode,
          }),
        }
      );

      mergeRunIntoHistory(run);

      const refreshedSession = await fetchApiData<PlaygroundSession>(
        `/api/v1/playground/sessions/${encodeURIComponent(workingSession.id)}`
      );
      setSession(refreshedSession);
      setPreviewMode("runs");

      const backendChecks = mapRunChecksToValidationResults(run.checks);
      if (backendChecks.length > 0) {
        setValidationResults(backendChecks);
      } else if (mode !== "run") {
        setValidationResults(
          buildValidationResults({
            files,
            runHistory,
            previewLogs,
            dirty,
          })
        );
      }

      return run;
    } catch (runError) {
      if (runError instanceof Error) {
        setError(normalizeErrorMessage(runError.message));
      } else {
        setError("Failed to run playground session.");
      }
      return null;
    } finally {
      setRunAction("idle");
    }
  }

  async function runSession() {
    const run = await executeSessionRun("run");
    if (!run) return;
    setInfo(`Run completed at ${formatTime(run.finishedAt ?? run.createdAt)}`);
  }

  async function runMissionTests() {
    const run = await executeSessionRun("test");
    if (!run) return;
    const checks = mapRunChecksToValidationResults(run.checks);
    if (checks.length > 0) {
      const passed = checks.filter((result) => result.passed).length;
      setInfo(`Tests complete: ${passed}/${checks.length} checks passed.`);
      return;
    }
    const fallback = buildValidationResults({
      files,
      runHistory,
      previewLogs,
      dirty,
    });
    setValidationResults(fallback);
    const passed = fallback.filter((result) => result.passed).length;
    setInfo(`Tests complete: ${passed}/${fallback.length} checks passed.`);
  }

  async function checkSolution() {
    const run = await executeSessionRun("check");
    if (!run) return;

    const checks = mapRunChecksToValidationResults(run.checks);
    const results =
      checks.length > 0
        ? checks
        : buildValidationResults({
            files,
            runHistory,
            previewLogs,
            dirty,
          });
    setValidationResults(results);

    const failed = results.filter((result) => !result.passed);
    if (failed.length === 0) {
      setError(null);
      setInfo("Solution check passed. Mission is ready to submit.");
      setMentorMessage(
        "Mission complete. Save one final time and fork/share this sandbox as your submission artifact."
      );
      return;
    }

    const firstFailure = failed[0];
    setError(null);
    setInfo(
      `Solution check: ${results.length - failed.length}/${results.length} checks passed.`
    );
    setMentorMessage(`Focus next on "${firstFailure.label}". ${firstFailure.detail}`);
  }

  function explainCurrentError() {
    if (latestPreviewError) {
      setMentorMessage(
        `Preview error detected: ${latestPreviewError}. Fix this first, then run tests again.`
      );
      return;
    }

    const failedRun = runHistory.find((run) => run.status !== "succeeded");
    if (failedRun) {
      setMentorMessage(
        `Last failed ${failedRun.mode}: ${failedRun.status}. Review logs in the Runs panel and resolve the failing entrypoint or validation check.`
      );
      return;
    }

    setMentorMessage(
      "No runtime errors detected right now. Use \"Run Tests\" to identify missing requirements and \"Check Solution\" before submission."
    );
  }

  function giveNextHint() {
    if (latestPreviewError) {
      setMentorMessage(
        "Hint: start with the latest preview error. Resolve the first error line before changing broader logic."
      );
      return;
    }

    const pendingCheckpoint = missionCheckpoints.find((checkpoint) => !checkpoint.done);
    if (!pendingCheckpoint) {
      setMentorMessage(
        "Hint: all checkpoints are done. Run \"Check Solution\" and share your sandbox link."
      );
      return;
    }

    if (pendingCheckpoint.label === "Files mapped to mission") {
      setMentorMessage(
        "Hint: map your mission into concrete files first (entry, helper module, and style file if needed)."
      );
      return;
    }
    if (pendingCheckpoint.label === "Core runtime files present") {
      setMentorMessage(
        "Hint: ensure the runtime entry exists for your stack (index.html for web preview, or main .ts/.js/.py for script runtime)."
      );
      return;
    }
    if (pendingCheckpoint.label === "Code executed at least once") {
      setMentorMessage(
        "Hint: run the session now. Use output/logs to validate behavior before continuing."
      );
      return;
    }
    if (pendingCheckpoint.label === "Changes saved") {
      setMentorMessage(
        "Hint: save your edits so this run state is persisted to the current session."
      );
      return;
    }

    setMentorMessage(
      `Hint: complete the next mission checkpoint: ${pendingCheckpoint.label}.`
    );
  }

  async function createNewSessionFromTemplate() {
    if (!selectedTemplateId) return;

    setCreating(true);
    setError(null);
    setInfo(null);

    try {
      const createdSession = await createSession({
        templateId: selectedTemplateId,
      });

      hydrateSessionState(createdSession);
      setRunHistory([]);
      syncSessionQueryParam(createdSession.id);
      await loadRunHistory(createdSession.id);
      setInfo("Started a fresh playground session.");
    } catch (createError) {
      if (createError instanceof Error) {
        setError(normalizeErrorMessage(createError.message));
      } else {
        setError("Failed to create playground session.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function forkAndShareSession() {
    if (!session) return;

    setCreating(true);
    setError(null);
    setInfo(null);

    try {
      let sourceSession = session;
      if (dirty && session.viewer.canEdit) {
        const saved = await saveFiles();
        if (!saved) return;
        sourceSession = saved;
      }

      const forked = await createSession({
        forkFromSessionId: sourceSession.id,
        visibility: "unlisted",
      });

      hydrateSessionState(forked);
      setRunHistory([]);
      await loadRunHistory(forked.id);
      syncSessionQueryParam(forked.id);

      const nextShareUrl = buildShareUrl(forked.id);
      const copied = await tryCopyToClipboard(nextShareUrl);
      setInfo(
        copied
          ? "Forked and copied unlisted share link."
          : "Forked unlisted session. Share link is ready below."
      );
    } catch (forkError) {
      if (forkError instanceof Error) {
        setError(normalizeErrorMessage(forkError.message));
      } else {
        setError("Failed to fork and share session.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    setError(null);
    const copied = await tryCopyToClipboard(shareUrl);
    if (copied) {
      setInfo("Share link copied.");
      return;
    }
    setError("Clipboard access is unavailable. Copy the URL manually.");
  }

  function openFile(path: string) {
    setActiveFilePath(path);
    setOpenTabs((previous) => (previous.includes(path) ? previous : [...previous, path]));
  }

  function closeTab(path: string) {
    setOpenTabs((previous) => {
      if (previous.length <= 1) return previous;
      const next = previous.filter((item) => item !== path);
      if (path === resolvedActiveFilePath) {
        setActiveFilePath(next[next.length - 1] ?? files[0]?.path ?? "");
      }
      return next;
    });
  }

  function onEditorChange(nextContent: string) {
    if (!activeFile) return;
    setDraftFiles((previous) =>
      previous.map((file) =>
        file.path === activeFile.path ? { ...file, content: nextContent } : file
      )
    );
    setDirty(true);
  }

  function addFile() {
    if (!canEdit) return;
    const normalizedPath = normalizePathInput(newFilePath);
    if (!normalizedPath) {
      setError("Invalid file path. Use letters, numbers, dots, dashes, slashes.");
      return;
    }
    if (files.some((file) => file.path === normalizedPath)) {
      setError("File already exists.");
      return;
    }

    const language = inferLanguageFromPath(normalizedPath);
    const starter =
      language === "html"
        ? "<!doctype html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />\n    <title>Sandbox</title>\n  </head>\n  <body>\n    <h1>Hello Sandbox</h1>\n  </body>\n</html>"
        : language === "css"
        ? "body {\n  font-family: ui-sans-serif, system-ui;\n}\n"
        : language === "javascript"
        ? 'console.log("new file ready");\n'
        : "";

    const nextFile = {
      path: normalizedPath,
      language,
      content: starter,
    };

    setDraftFiles((previous) => [...previous, nextFile]);
    setOpenTabs((previous) =>
      previous.includes(normalizedPath) ? previous : [...previous, normalizedPath]
    );
    setActiveFilePath(normalizedPath);
    setNewFilePath("");
    setDirty(true);
    setError(null);
    setInfo(`Added ${normalizedPath}`);
  }

  function renameActiveFile() {
    if (!canEdit || !activeFile) return;

    const normalizedPath = normalizePathInput(renameInputRef.current?.value ?? "");
    if (!normalizedPath) {
      setError("Invalid rename path.");
      return;
    }

    if (
      normalizedPath !== activeFile.path &&
      files.some((file) => file.path === normalizedPath)
    ) {
      setError("Another file already uses that path.");
      return;
    }

    if (normalizedPath === activeFile.path) {
      setInfo("File path unchanged.");
      return;
    }

    setDraftFiles((previous) =>
      previous.map((file) =>
        file.path === activeFile.path
          ? {
              ...file,
              path: normalizedPath,
              language: inferLanguageFromPath(normalizedPath),
            }
          : file
      )
    );
    setOpenTabs((previous) =>
      previous.map((path) => (path === activeFile.path ? normalizedPath : path))
    );
    setActiveFilePath(normalizedPath);
    setDirty(true);
    setError(null);
    setInfo(`Renamed to ${normalizedPath}`);
  }

  function deleteActiveFile() {
    if (!canEdit || !activeFile) return;
    if (files.length <= 1) {
      setError("At least one file is required in session.");
      return;
    }

    const remaining = files.filter((file) => file.path !== activeFile.path);
    const nextActive = remaining[0]?.path ?? "";

    setDraftFiles(remaining);
    setOpenTabs((previous) => {
      const next = previous.filter((path) => path !== activeFile.path);
      if (next.length === 0 && nextActive) {
        return [nextActive];
      }
      return next;
    });
    setActiveFilePath(nextActive);
    setDirty(true);
    setError(null);
    setInfo(`Deleted ${activeFile.path}`);
  }

  const canEdit = Boolean(session?.viewer.canEdit && session?.status === "active");
  const canShare = Boolean(session && session.status === "active");
  const latestRun = runHistory[0] ?? null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24 sm:pb-0">
      <div className="border-b border-[var(--border)] px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Playground Sandbox
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Learner-first coding lab with mission guidance, execution, and feedback history.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              onClick={forkAndShareSession}
              disabled={!canShare || creating}
              className="inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:border-[var(--foreground)] sm:h-9 sm:px-4 sm:text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Share
            </button>
            <button
              onClick={saveFiles}
              disabled={!canEdit || saving || !dirty}
              className="inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:border-[var(--foreground)] sm:h-9 sm:px-4 sm:text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={createNewSessionFromTemplate}
              disabled={creating || !selectedTemplateId}
              className="inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center gap-2 bg-[var(--accent)] px-3 font-mono text-[9px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 sm:h-9 sm:px-5 sm:text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "New Session"}
            </button>
            <button
              onClick={runSession}
              disabled={!canEdit || runAction !== "idle"}
              className="inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center gap-2 bg-[var(--foreground)] px-3 font-mono text-[9px] uppercase tracking-widest text-[var(--surface)] transition-opacity hover:opacity-90 sm:h-9 sm:px-5 sm:text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runAction === "run" ? "Running..." : "Run"}
            </button>
            <button
              onClick={runMissionTests}
              disabled={loading || runAction !== "idle"}
              className="inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:border-[var(--foreground)] sm:h-9 sm:px-4 sm:text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runAction === "test" ? "Testing..." : "Run Tests"}
            </button>
            <button
              onClick={checkSolution}
              disabled={loading || runAction !== "idle"}
              className="inline-flex h-11 touch-manipulation cursor-pointer items-center justify-center gap-2 border border-[#21B8A8]/50 bg-[#21B8A8]/10 px-3 font-mono text-[9px] uppercase tracking-widest text-[#21B8A8] transition-colors hover:border-[#21B8A8] sm:h-9 sm:px-4 sm:text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runAction === "check" ? "Checking..." : "Check Solution"}
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="h-10 w-full min-w-0 border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs text-[var(--foreground)] sm:h-8 sm:min-w-[220px]"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Session
            </span>
            <p className="font-mono text-xs text-[var(--foreground)]">
              {session ? session.id.slice(0, 8) : "preview"}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Visibility
            </span>
            <p className="font-mono text-xs text-[var(--foreground)]">
              {session?.visibility ?? "public templates"}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Latest Run
            </span>
            <p className="font-mono text-xs text-[var(--foreground)]">
              {latestRun ? formatTime(latestRun.finishedAt ?? latestRun.createdAt) : "--"}
            </p>
          </div>

          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <input
              value={newFilePath}
              onChange={(event) => setNewFilePath(event.target.value)}
              placeholder="src/new-file.ts"
              className="h-10 min-w-0 flex-1 border border-[var(--border)] bg-[var(--background)] px-2 font-mono text-[11px] text-[var(--foreground)] sm:h-8 sm:w-56 sm:flex-none"
            />
            <button
              onClick={addFile}
              disabled={!canEdit}
              className="inline-flex h-10 touch-manipulation items-center justify-center border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] sm:h-8 disabled:opacity-50"
            >
              Add File
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
        {loading ? (
          <div className="border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-xs uppercase tracking-widest text-[var(--muted-foreground)]">
            Initializing playground...
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 border border-[#FF7A2F] bg-[#FF7A2F]/10 p-3 font-mono text-[10px] uppercase tracking-widest text-[#FF7A2F]">
            {error}
          </div>
        ) : null}

        {info ? (
          <div className="mb-4 border border-[#21B8A8] bg-[#21B8A8]/10 p-3 font-mono text-[10px] uppercase tracking-widest text-[#21B8A8]">
            {info}
          </div>
        ) : null}

        {shareUrl ? (
          <div className="mb-4 border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Share URL
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={shareUrl}
                className="h-9 flex-1 border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs text-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={() => void copyShareLink()}
                className="inline-flex h-9 items-center justify-center border border-[var(--border)] bg-[var(--surface)] px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]"
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_420px]">
          <section className="order-2 border border-[var(--border)] bg-[var(--surface)] p-4 lg:order-1">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Practice Mission
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {selectedTemplate ? `Build: ${selectedTemplate.title}` : "Build from Starter"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {selectedTemplate?.description ??
                "Practice by implementing, running, and debugging your solution with iterative feedback."}
            </p>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Steps
              </p>
              <ol className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
                {missionSteps.map((step) => (
                  <li key={step} className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Checkpoints
              </p>
              <ul className="mt-2 space-y-2">
                {missionCheckpoints.map((checkpoint) => (
                  <li
                    key={checkpoint.label}
                    className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  >
                    <span className="text-sm text-[var(--foreground)]">{checkpoint.label}</span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-widest ${
                        checkpoint.done ? "text-[#21B8A8]" : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {checkpoint.done ? "Done" : "Pending"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Hint-First Mentor
              </p>
              <div className="mt-2 space-y-2">
                <button
                  onClick={explainCurrentError}
                  className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]"
                >
                  Explain Current Error
                </button>
                <button
                  onClick={giveNextHint}
                  className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]"
                >
                  Give Me The Next Hint
                </button>
                <div className="rounded border border-[var(--border)] bg-[var(--background)] p-3">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Mentor Response
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                    {mentorMessage ?? "Ask for a targeted hint or error explanation."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Validation Snapshot
              </p>
              <ul className="mt-2 space-y-2">
                {(validationResults ?? []).length === 0 ? (
                  <li className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                    Run tests to generate validation feedback.
                  </li>
                ) : (
                  (validationResults ?? []).map((result) => (
                    <li
                      key={result.id}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[var(--foreground)]">{result.label}</span>
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest ${
                            result.passed ? "text-[#21B8A8]" : "text-[#FF7A2F]"
                          }`}
                        >
                          {result.passed ? "Pass" : "Fail"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {result.detail}
                      </p>
                    </li>
                  ))
                )}
              </ul>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                {validationResults
                  ? `${validationResults.filter((result) => result.passed).length}/${validationResults.length} checks passed`
                  : "No checks run yet"}
              </p>
              {latestPreviewError ? (
                <p className="mt-2 text-xs text-[#FF7A2F]">
                  Latest preview error: {latestPreviewError}
                </p>
              ) : null}
            </div>
          </section>

          <section className="order-1 border border-[var(--border)] bg-[var(--surface)] lg:order-2">
            <div className="border-b border-[var(--border)] px-3 py-2">
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-2">
                {openTabs.map((path) => {
                  const active = path === resolvedActiveFilePath;
                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => openFile(path)}
                      className={`inline-flex h-9 touch-manipulation items-center gap-2 border px-3 font-mono text-[9px] uppercase tracking-widest sm:h-7 sm:text-[10px] ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
                      }`}
                    >
                      <span className="max-w-[160px] truncate">{path}</span>
                      {openTabs.length > 1 ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            closeTab(path);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              closeTab(path);
                            }
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-sm"
                          aria-label={`Close tab ${path}`}
                        >
                          ×
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                </div>
              </div>
            </div>

            <div className="grid min-h-[520px] grid-cols-1 lg:min-h-[600px] lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Files
                  </p>
                </div>
                <ul className="max-h-56 overflow-auto py-2 sm:max-h-[340px] lg:max-h-[560px]">
                  {files.map((file) => {
                    const isActive = resolvedActiveFilePath === file.path;
                    return (
                      <li key={file.path}>
                        <button
                          onClick={() => openFile(file.path)}
                          className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] transition-colors ${
                            isActive
                              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "text-[var(--foreground)] hover:bg-[var(--border)]/40"
                          }`}
                        >
                          <span className="truncate">{file.path}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-[var(--border)] p-3">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Rename Active
                  </label>
                  <input
                    key={resolvedActiveFilePath}
                    ref={renameInputRef}
                    defaultValue={resolvedActiveFilePath}
                    className="mt-2 h-8 w-full border border-[var(--border)] bg-[var(--background)] px-2 font-mono text-[11px] text-[var(--foreground)]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={renameActiveFile}
                      disabled={!canEdit || !activeFile}
                      className="inline-flex h-8 items-center border border-[var(--border)] bg-[var(--background)] px-2 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={deleteActiveFile}
                      disabled={!canEdit || !activeFile || files.length <= 1}
                      className="inline-flex h-8 items-center border border-[#FF7A2F]/40 bg-[#FF7A2F]/10 px-2 font-mono text-[9px] uppercase tracking-widest text-[#FF7A2F] disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[360px] flex-col sm:min-h-[420px]">
                <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2">
                  <span className="min-w-0 truncate font-mono text-xs text-[var(--foreground)]">
                    {activeFile?.path ?? "No file selected"}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {dirty ? "Unsaved" : "Saved"}
                  </span>
                </div>
                <textarea
                  value={activeFile?.content ?? ""}
                  onChange={(event) => onEditorChange(event.target.value)}
                  readOnly={!canEdit || !activeFile}
                  spellCheck={false}
                  className="min-h-[360px] flex-1 resize-none bg-[var(--surface)] p-3 font-mono text-[11px] leading-6 text-[var(--foreground)] outline-none sm:min-h-[520px] sm:p-4 sm:text-xs"
                />
              </div>
            </div>
          </section>

          <section className="order-3 border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex border-b border-[var(--border)]">
              {(["preview", "console", "runs"] as PreviewPanelMode[]).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => setPreviewMode(panel)}
                  className={`inline-flex h-9 flex-1 items-center justify-center font-mono text-[9px] uppercase tracking-widest sm:text-[10px] ${
                    previewMode === panel
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {panel}
                </button>
              ))}
            </div>

            {previewMode === "preview" ? (
              <div className="p-3">
                <iframe
                  title="Sandbox preview"
                  sandbox="allow-scripts"
                  srcDoc={previewSource}
                  className="h-[360px] w-full border border-[var(--border)] bg-white sm:h-[560px]"
                />
                <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  HTML/CSS/JS preview is live. TS/TSX preview needs transpilation step.
                </p>
              </div>
            ) : null}

            {previewMode === "console" ? (
              <div className="h-[420px] overflow-auto p-3 sm:h-[592px]">
                <div className="flex items-center justify-between pb-2">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Preview Console
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreviewLogs([])}
                    className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]"
                  >
                    Clear
                  </button>
                </div>
                <pre className="h-[360px] overflow-auto border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[10px] leading-5 text-[var(--foreground)] sm:h-[540px] sm:text-[11px]">
                  {previewLogs.length > 0
                    ? escapeHtml(previewLogs.join("\n"))
                    : "Console output will appear here from preview runtime."}
                </pre>
              </div>
            ) : null}

            {previewMode === "runs" ? (
              <div className="h-[420px] overflow-auto p-3 sm:h-[592px]">
                <div className="pb-2">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    Run History
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["all", "run", "test", "check"] as RunHistoryFilter[]).map((filter) => {
                      const isActive = runHistoryFilter === filter;
                      const count = runHistoryCounts[filter];
                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => {
                            setRunHistoryFilter(filter);
                            syncRunFilterQueryParam(filter);
                          }}
                          className={`inline-flex h-7 items-center gap-1 border px-2 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                            isActive
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          <span>{filter}</span>
                          <span>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <ul className="space-y-2">
                  {filteredRunHistory.length === 0 ? (
                    <li className="border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                      No {runHistoryFilter === "all" ? "" : `${runHistoryFilter} `}runs yet.
                    </li>
                  ) : (
                    filteredRunHistory.map((run) => {
                      const checksSummary = formatRunChecksSummary(run.checks);
                      const isExpanded = expandedRunId === run.id;
                      return (
                        <li
                          key={run.id}
                          className="border border-[var(--border)] bg-[var(--background)] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-mono text-[10px] uppercase tracking-widest ${getRunStatusClass(
                                run.status
                              )}`}
                            >
                              {run.status}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                              {formatTime(run.finishedAt ?? run.createdAt)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex h-6 items-center border px-2 font-mono text-[9px] uppercase tracking-widest ${getRunModeBadgeClass(
                                run.mode
                              )}`}
                            >
                              {run.mode}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                              Runtime: {run.runtime}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                              Duration: {formatDuration(run.durationMs)}
                            </span>
                            {checksSummary ? (
                              <span
                                className={`font-mono text-[10px] uppercase tracking-widest ${checksSummary.toneClass}`}
                              >
                                {checksSummary.text}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRunId((current) =>
                                  current === run.id ? null : run.id
                                )
                              }
                              className="ml-auto font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            >
                              {isExpanded ? "Collapse" : "Expand"}
                            </button>
                          </div>
                          {isExpanded ? (
                            <>
                              <pre className="mt-2 max-h-52 overflow-auto border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-[11px] leading-5 text-[var(--foreground)]">
                                {run.rawLog ?? "No log"}
                              </pre>
                              {run.checks && run.checks.length > 0 ? (
                                <ul className="mt-2 space-y-1">
                                  {run.checks.map((check) => (
                                    <li
                                      key={`${run.id}-${check.id}`}
                                      className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-[var(--foreground)]">{check.label}</span>
                                        <span
                                          className={`font-mono text-[9px] uppercase tracking-widest ${
                                            check.passed ? "text-[#21B8A8]" : "text-[#FF7A2F]"
                                          }`}
                                        >
                                          {check.passed ? "pass" : "fail"}
                                        </span>
                                      </div>
                                      {check.message ? (
                                        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                                          {check.message}
                                        </p>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-3 pt-2 backdrop-blur sm:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      >
        <div className="mx-auto grid max-w-[1600px] grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => void saveFiles()}
            disabled={!canEdit || saving || !dirty}
            className="inline-flex h-11 touch-manipulation items-center justify-center border border-[var(--border)] bg-[var(--background)] px-2 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] disabled:opacity-50"
          >
            {saving ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => void runSession()}
            disabled={!canEdit || runAction !== "idle"}
            className="inline-flex h-11 touch-manipulation items-center justify-center bg-[var(--foreground)] px-2 font-mono text-[9px] uppercase tracking-widest text-[var(--surface)] disabled:opacity-50"
          >
            {runAction === "run" ? "Running" : "Run"}
          </button>
          <button
            type="button"
            onClick={() => void runMissionTests()}
            disabled={loading || runAction !== "idle"}
            className="inline-flex h-11 touch-manipulation items-center justify-center border border-[var(--border)] bg-[var(--background)] px-2 font-mono text-[9px] uppercase tracking-widest text-[var(--foreground)] disabled:opacity-50"
          >
            {runAction === "test" ? "Testing" : "Tests"}
          </button>
          <button
            type="button"
            onClick={() => void checkSolution()}
            disabled={loading || runAction !== "idle"}
            className="inline-flex h-11 touch-manipulation items-center justify-center border border-[#21B8A8]/50 bg-[#21B8A8]/10 px-2 font-mono text-[9px] uppercase tracking-widest text-[#21B8A8] disabled:opacity-50"
          >
            {runAction === "check" ? "Checking" : "Check"}
          </button>
        </div>
      </div>
    </div>
  );
}
