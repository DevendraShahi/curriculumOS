import { ObjectId } from "mongodb";
import { Script, createContext } from "node:vm";
import {
  listPlaygroundRunsBySession,
  createPlaygroundRun,
  type PlaygroundRunsCursor,
} from "@/lib/repositories/playground-run-repository";
import {
  createPlaygroundSession,
  getPlaygroundSessionById,
  listPlaygroundSessionsByUser,
  setPlaygroundSessionLatestRun,
  updatePlaygroundSessionFiles,
} from "@/lib/repositories/playground-session-repository";
import {
  getPlaygroundTemplateByIdOrSlug,
  listPlaygroundTemplates,
} from "@/lib/repositories/playground-template-repository";
import { getMongoDb } from "@/lib/mongodb";
import { syncActorToUserDocument } from "@/lib/services/user-service";
import type { ActorContext } from "@/lib/services/auth-context";
import type {
  PlaygroundRunDocument,
  PlaygroundSessionDocument,
  PlaygroundTemplateValidationRule,
  PlaygroundTemplateDocument,
} from "@/lib/db/models";

const DEFAULT_TEMPLATE_LIMIT = 20;
const MAX_TEMPLATE_LIMIT = 100;
const DEFAULT_SESSION_LIMIT = 10;
const MAX_SESSION_LIMIT = 50;
const DEFAULT_RUN_LIMIT = 20;
const MAX_RUN_LIMIT = 100;
const MAX_FILE_COUNT = 200;
const MAX_FILE_PATH_LENGTH = 200;
const MAX_FILE_LANGUAGE_LENGTH = 40;
const MAX_FILE_CONTENT_LENGTH = 200_000;
const MAX_VALIDATION_RULES = 100;
const MAX_VALIDATION_FIELD_LENGTH = 300;
const EXECUTION_TIMEOUT_MS = 2_000;

type PlaygroundTemplateDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  runtime: string;
  visibility: PlaygroundTemplateDocument["visibility"];
  isPublished: boolean;
  starterFiles: PlaygroundTemplateDocument["starterFiles"];
  validationRules: PlaygroundTemplateDocument["validationRules"];
  createdAt: string;
  updatedAt: string;
};

type PlaygroundSessionDto = {
  id: string;
  userId: string;
  templateId: string | null;
  forkedFromSessionId: string | null;
  title: string;
  visibility: PlaygroundSessionDocument["visibility"];
  status: PlaygroundSessionDocument["status"];
  files: PlaygroundSessionDocument["files"];
  latestRunId: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewer: {
    canEdit: boolean;
  };
};

type PlaygroundRunDto = {
  id: string;
  sessionId: string;
  userId: string;
  mode: PlaygroundRunDocument["mode"];
  status: PlaygroundRunDocument["status"];
  runtime: string;
  exitCode: number | null;
  summary: string | null;
  rawLog: string | null;
  checks: PlaygroundRunDocument["checks"] | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
};

type CreatePlaygroundSessionInput = {
  templateId?: unknown;
  forkFromSessionId?: unknown;
  title?: unknown;
  visibility?: unknown;
  files?: unknown;
};

type UpdateSessionFilesInput = {
  mode?: unknown;
  files?: unknown;
};

type RunPlaygroundSessionInput = {
  runtime?: unknown;
  entryFile?: unknown;
  command?: unknown;
  summary?: unknown;
  mode?: unknown;
};

type NormalizedPlaygroundValidationRule = {
  id: string;
  label: string;
  type: PlaygroundTemplateValidationRule["type"];
  filePath: string;
  value?: string;
  flags?: string;
  caseSensitive: boolean;
  required: boolean;
};

function cloneSessionFiles(
  files: PlaygroundSessionDocument["files"]
): PlaygroundSessionDocument["files"] {
  return files.map((file) => ({
    path: file.path,
    language: file.language,
    content: file.content,
  }));
}

function parseLimit(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function normalizeOptionalStringField(
  value: unknown,
  options: { min: number; max: number },
  errorCode: string
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(errorCode);
  }
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length < options.min || normalized.length > options.max) {
    throw new Error(errorCode);
  }
  return normalized;
}

function normalizeSessionVisibility(
  value: unknown
): PlaygroundSessionDocument["visibility"] {
  if (value === undefined || value === null || value === "") {
    return "private";
  }
  if (value === "private" || value === "unlisted" || value === "public") {
    return value;
  }
  throw new Error("INVALID_PLAYGROUND_SESSION");
}

function normalizeRunOptionalString(
  value: unknown,
  options: { min: number; max: number }
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error("INVALID_PLAYGROUND_RUN");
  }
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length < options.min || normalized.length > options.max) {
    throw new Error("INVALID_PLAYGROUND_RUN");
  }
  return normalized;
}

function normalizeRunMode(value: unknown): "run" | "test" | "check" {
  if (value === undefined || value === null || value === "") {
    return "run";
  }
  if (value === "run" || value === "test" || value === "check") {
    return value;
  }
  throw new Error("INVALID_PLAYGROUND_RUN");
}

function normalizeTemplateFilterQuery(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 120) {
    throw new Error("INVALID_PLAYGROUND_TEMPLATE");
  }
  return normalized;
}

function normalizeTemplateFilterTag(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 50) {
    throw new Error("INVALID_PLAYGROUND_TEMPLATE");
  }
  return normalized;
}

function normalizeSessionFile(
  value: unknown
): PlaygroundSessionDocument["files"][number] {
  if (!value || typeof value !== "object") {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  const payload = value as {
    path?: unknown;
    language?: unknown;
    content?: unknown;
  };

  if (typeof payload.path !== "string" || payload.path.trim().length === 0) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }
  const path = payload.path.trim();
  if (path.length > MAX_FILE_PATH_LENGTH) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  if (
    typeof payload.language !== "string" ||
    payload.language.trim().length === 0
  ) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }
  const language = payload.language.trim();
  if (language.length > MAX_FILE_LANGUAGE_LENGTH) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  if (typeof payload.content !== "string") {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }
  if (payload.content.length > MAX_FILE_CONTENT_LENGTH) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  return {
    path,
    language,
    content: payload.content,
  };
}

function normalizeSessionFiles(
  value: unknown,
  options: { required: boolean }
): PlaygroundSessionDocument["files"] | undefined {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
    }
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }
  if (value.length === 0 || value.length > MAX_FILE_COUNT) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  const unique = new Map<string, PlaygroundSessionDocument["files"][number]>();
  for (const file of value) {
    const normalized = normalizeSessionFile(file);
    unique.set(normalized.path, normalized);
  }

  return Array.from(unique.values());
}

function normalizeMode(value: unknown): "replace" | "merge" {
  if (value === undefined || value === null || value === "") {
    return "merge";
  }
  if (value === "replace" || value === "merge") {
    return value;
  }
  throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
}

function encodePlaygroundRunsCursor(cursor: PlaygroundRunsCursor): string {
  return `${cursor.createdAt.getTime()}:${cursor.id.toString()}`;
}

function toPlaygroundTemplateDto(
  template: PlaygroundTemplateDocument
): PlaygroundTemplateDto {
  return {
    id: template._id.toString(),
    slug: template.slug,
    title: template.title,
    description: template.description ?? null,
    tags: template.tags ?? [],
    runtime: template.runtime,
    visibility: template.visibility,
    isPublished: template.isPublished,
    starterFiles: cloneSessionFiles(template.starterFiles),
    validationRules: template.validationRules ?? [],
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toPlaygroundSessionDto(
  session: PlaygroundSessionDocument,
  viewerUserId: ObjectId
): PlaygroundSessionDto {
  const canEdit = session.userId.equals(viewerUserId);
  return {
    id: session._id.toString(),
    userId: session.userId.toString(),
    templateId: session.templateId?.toString() ?? null,
    forkedFromSessionId: session.forkedFromSessionId?.toString() ?? null,
    title: session.title,
    visibility: session.visibility,
    status: session.status,
    files: cloneSessionFiles(session.files),
    latestRunId: session.latestRunId?.toString() ?? null,
    lastRunAt: session.lastRunAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    viewer: {
      canEdit,
    },
  };
}

function toPlaygroundRunDto(run: PlaygroundRunDocument): PlaygroundRunDto {
  return {
    id: run._id.toString(),
    sessionId: run.sessionId.toString(),
    userId: run.userId.toString(),
    mode: run.mode ?? "run",
    status: run.status,
    runtime: run.runtime,
    exitCode: run.exitCode ?? null,
    summary: run.summary ?? null,
    rawLog: run.rawLog ?? null,
    checks: run.checks ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.durationMs ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function canReadSession(
  session: PlaygroundSessionDocument,
  viewerUserId: ObjectId
): boolean {
  if (session.userId.equals(viewerUserId)) return true;
  return session.visibility !== "private";
}

function assertObjectId(value: string, errorCode: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error(errorCode);
  }
  return new ObjectId(value);
}

function normalizeNewSessionTitle(params: {
  explicitTitle?: string;
  template?: PlaygroundTemplateDocument | null;
  fork?: PlaygroundSessionDocument | null;
}): string {
  const explicit = params.explicitTitle?.trim();
  if (explicit) return explicit;
  if (params.fork?.title) {
    const base = `${params.fork.title} Fork`;
    return base.length > 80 ? base.slice(0, 80) : base;
  }
  if (params.template?.title) {
    return params.template.title.length > 80
      ? params.template.title.slice(0, 80)
      : params.template.title;
  }
  return "Untitled Playground";
}

function inferRuntimeFromSession(
  session: PlaygroundSessionDocument,
  template: PlaygroundTemplateDocument | null,
  runtimeFromInput?: string
): string {
  if (runtimeFromInput) return runtimeFromInput;
  if (template?.runtime?.trim()) {
    return template.runtime.trim();
  }
  if (session.files.some((file) => file.path.endsWith(".py"))) {
    return "python";
  }
  if (
    session.files.some(
      (file) =>
        file.path.endsWith(".ts") ||
        file.path.endsWith(".tsx") ||
        file.path.endsWith(".js") ||
        file.path.endsWith(".jsx")
    )
  ) {
    return "node";
  }
  return "node";
}

function normalizeTemplateValidationRules(
  rules: PlaygroundTemplateDocument["validationRules"]
): NormalizedPlaygroundValidationRule[] {
  if (!Array.isArray(rules) || rules.length === 0) return [];
  const normalized: NormalizedPlaygroundValidationRule[] = [];

  for (const rule of rules.slice(0, MAX_VALIDATION_RULES)) {
    if (!rule || typeof rule !== "object") continue;
    if (
      rule.type !== "file_exists" &&
      rule.type !== "file_includes" &&
      rule.type !== "file_regex"
    ) {
      continue;
    }

    const id =
      typeof rule.id === "string" && rule.id.trim()
        ? rule.id.trim().slice(0, 80)
        : `rule_${normalized.length + 1}`;
    const label =
      typeof rule.label === "string" && rule.label.trim()
        ? rule.label.trim().slice(0, MAX_VALIDATION_FIELD_LENGTH)
        : id;
    const filePath =
      typeof rule.filePath === "string" && rule.filePath.trim()
        ? rule.filePath.trim().slice(0, MAX_FILE_PATH_LENGTH)
        : "";

    if (!filePath) continue;

    const value =
      typeof rule.value === "string" && rule.value.length > 0
        ? rule.value.slice(0, MAX_VALIDATION_FIELD_LENGTH)
        : undefined;
    const flags =
      typeof rule.flags === "string" && rule.flags.length > 0
        ? rule.flags.slice(0, 8)
        : undefined;

    normalized.push({
      id,
      label,
      type: rule.type,
      filePath,
      value,
      flags,
      caseSensitive: rule.caseSensitive === true,
      required: rule.required !== false,
    });
  }

  return normalized;
}

function deriveFallbackValidationRulesFromTemplate(
  template: PlaygroundTemplateDocument | null
): NormalizedPlaygroundValidationRule[] {
  if (!template || !Array.isArray(template.starterFiles) || template.starterFiles.length === 0) {
    return [];
  }

  return template.starterFiles
    .filter((file) => typeof file.path === "string" && file.path.trim().length > 0)
    .slice(0, 20)
    .map((file, index) => ({
      id: `fallback_file_exists_${index + 1}`,
      label: `File exists: ${file.path}`,
      type: "file_exists",
      filePath: file.path.trim(),
      caseSensitive: true,
      required: true,
    }));
}

function findFileByPath(
  files: PlaygroundSessionDocument["files"],
  filePath: string
): PlaygroundSessionDocument["files"][number] | null {
  const direct = files.find((file) => file.path === filePath);
  if (direct) return direct;
  const lowered = filePath.toLowerCase();
  return files.find((file) => file.path.toLowerCase() === lowered) ?? null;
}

function evaluateTemplateValidationRules(params: {
  files: PlaygroundSessionDocument["files"];
  rules: NormalizedPlaygroundValidationRule[];
}): NonNullable<PlaygroundRunDocument["checks"]> {
  if (params.rules.length === 0) return [];

  const checks: NonNullable<PlaygroundRunDocument["checks"]> = [];
  for (const rule of params.rules) {
    const target = findFileByPath(params.files, rule.filePath);
    let passed = false;
    let message = "";

    if (rule.type === "file_exists") {
      passed = Boolean(target);
      message = passed
        ? `Found ${rule.filePath}`
        : `Missing required file: ${rule.filePath}`;
    }

    if (rule.type === "file_includes") {
      if (!target) {
        passed = !rule.required;
        message = passed
          ? `Optional file ${rule.filePath} not found`
          : `Missing file for content check: ${rule.filePath}`;
      } else if (!rule.value) {
        passed = false;
        message = "Validation rule is missing expected text value.";
      } else {
        const haystack = rule.caseSensitive
          ? target.content
          : target.content.toLowerCase();
        const needle = rule.caseSensitive ? rule.value : rule.value.toLowerCase();
        passed = haystack.includes(needle);
        message = passed
          ? `Matched expected content in ${rule.filePath}`
          : `Expected text not found in ${rule.filePath}`;
      }
    }

    if (rule.type === "file_regex") {
      if (!target) {
        passed = !rule.required;
        message = passed
          ? `Optional file ${rule.filePath} not found`
          : `Missing file for regex check: ${rule.filePath}`;
      } else if (!rule.value) {
        passed = false;
        message = "Validation rule is missing regex pattern.";
      } else {
        try {
          const regex = new RegExp(rule.value, rule.flags);
          passed = regex.test(target.content);
          message = passed
            ? `Regex matched in ${rule.filePath}`
            : `Regex did not match in ${rule.filePath}`;
        } catch {
          passed = false;
          message = "Invalid regex rule configuration.";
        }
      }
    }

    checks.push({
      id: rule.id,
      label: rule.label,
      passed,
      message,
    });
  }

  return checks;
}

function selectNodeEntryFile(params: {
  files: PlaygroundSessionDocument["files"];
  requested?: string;
}): PlaygroundSessionDocument["files"][number] | null {
  if (params.requested) {
    return findFileByPath(params.files, params.requested);
  }

  const preferred = [
    "index.js",
    "main.js",
    "app.js",
    "server.js",
    "index.mjs",
    "main.mjs",
  ];

  for (const candidate of preferred) {
    const found = findFileByPath(params.files, candidate);
    if (found) return found;
  }

  return (
    params.files.find((file) => {
      const lower = file.path.toLowerCase();
      return (
        lower.endsWith(".js") ||
        lower.endsWith(".mjs") ||
        lower.endsWith(".cjs") ||
        lower.endsWith(".ts") ||
        lower.endsWith(".tsx")
      );
    }) ?? null
  );
}

function executeNodeSandbox(params: {
  files: PlaygroundSessionDocument["files"];
  entryFile?: string;
}): {
  status: PlaygroundRunDocument["status"];
  exitCode: number | null;
  logs: string[];
  resolvedEntryFile: string | null;
} {
  const logs: string[] = [];
  const entry = selectNodeEntryFile({
    files: params.files,
    requested: params.entryFile,
  });
  if (!entry) {
    return {
      status: "failed",
      exitCode: 1,
      logs: ["No executable entry file was found for node runtime."],
      resolvedEntryFile: null,
    };
  }

  const lowerPath = entry.path.toLowerCase();
  if (lowerPath.endsWith(".ts") || lowerPath.endsWith(".tsx")) {
    return {
      status: "failed",
      exitCode: 1,
      logs: [
        `Entry "${entry.path}" is TypeScript and cannot run without transpilation.`,
      ],
      resolvedEntryFile: entry.path,
    };
  }

  const sandboxConsole = {
    log: (...args: unknown[]) => {
      logs.push(
        `[log] ${args
          .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
          .join(" ")}`
      );
    },
    warn: (...args: unknown[]) => {
      logs.push(
        `[warn] ${args
          .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
          .join(" ")}`
      );
    },
    error: (...args: unknown[]) => {
      logs.push(
        `[error] ${args
          .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
          .join(" ")}`
      );
    },
  };

  const sandbox = createContext({
    console: sandboxConsole,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });

  try {
    const script = new Script(entry.content, {
      filename: entry.path,
    });
    script.runInContext(sandbox, {
      timeout: EXECUTION_TIMEOUT_MS,
    });
    return {
      status: "succeeded",
      exitCode: 0,
      logs,
      resolvedEntryFile: entry.path,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);
    logs.push(`[runtime-error] ${message}`);
    return {
      status: "failed",
      exitCode: 1,
      logs,
      resolvedEntryFile: entry.path,
    };
  }
}

function buildRunRawLog(params: {
  runtime: string;
  mode: "run" | "test" | "check";
  requestedEntryFile?: string;
  resolvedEntryFile: string | null;
  command?: string;
  runtimeStatus: PlaygroundRunDocument["status"];
  runtimeLogs: string[];
  checks: NonNullable<PlaygroundRunDocument["checks"]>;
}): string {
  const lines = [
    `[mode] ${params.mode}`,
    `[runtime] ${params.runtime}`,
    `[status] ${params.runtimeStatus}`,
    `[entry-requested] ${params.requestedEntryFile ?? "auto-detect"}`,
    `[entry-resolved] ${params.resolvedEntryFile ?? "none"}`,
    `[command] ${params.command ?? "default-run"}`,
  ];

  for (const line of params.runtimeLogs) {
    lines.push(line);
  }

  if (params.checks && params.checks.length > 0) {
    lines.push("[checks]");
    for (const check of params.checks) {
      lines.push(
        ` - ${check.passed ? "PASS" : "FAIL"}: ${check.label}${
          check.message ? ` (${check.message})` : ""
        }`
      );
    }
  }

  return lines.join("\n");
}

async function loadSessionForViewer(params: {
  actor: ActorContext;
  sessionId: ObjectId;
}): Promise<{ session: PlaygroundSessionDocument; viewerUserId: ObjectId }> {
  const db = await getMongoDb();
  const viewer = await syncActorToUserDocument(params.actor);
  const session = await getPlaygroundSessionById(db, {
    tenantId: params.actor.tenantId,
    sessionId: params.sessionId,
  });

  if (!session) {
    throw new Error("PLAYGROUND_SESSION_NOT_FOUND");
  }

  if (!canReadSession(session, viewer._id)) {
    throw new Error("FORBIDDEN");
  }

  return {
    session,
    viewerUserId: viewer._id,
  };
}

export function parsePlaygroundTemplateLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_TEMPLATE_LIMIT, MAX_TEMPLATE_LIMIT);
}

export function parsePlaygroundRunLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT);
}

export function parsePlaygroundSessionLimit(value: string | null): number {
  return parseLimit(value, DEFAULT_SESSION_LIMIT, MAX_SESSION_LIMIT);
}

export function parsePlaygroundRunsCursor(
  value: string | null
): PlaygroundRunsCursor | undefined {
  if (!value) return undefined;
  const [timestampRaw, idRaw] = value.split(":");
  if (!timestampRaw || !idRaw) {
    throw new Error("INVALID_PLAYGROUND_CURSOR");
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp) || !ObjectId.isValid(idRaw)) {
    throw new Error("INVALID_PLAYGROUND_CURSOR");
  }

  const createdAt = new Date(timestamp);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("INVALID_PLAYGROUND_CURSOR");
  }

  return {
    createdAt,
    id: new ObjectId(idRaw),
  };
}

export async function listPlaygroundTemplatesCatalog(params: {
  tenantId: string;
  actor?: ActorContext | null;
  limit: number;
  tag?: string | null;
  query?: string | null;
}) {
  const db = await getMongoDb();
  const templates = await listPlaygroundTemplates(db, {
    tenantId: params.tenantId,
    visibility: params.actor ? ["public", "tenant_members"] : ["public"],
    isPublished: true,
    limit: Math.min(Math.max(params.limit, 1), MAX_TEMPLATE_LIMIT),
    tag: normalizeTemplateFilterTag(params.tag ?? null),
    search: normalizeTemplateFilterQuery(params.query ?? null),
  });

  return {
    items: templates.map(toPlaygroundTemplateDto),
    count: templates.length,
  };
}

export async function createCurrentActorPlaygroundSession(
  actor: ActorContext,
  input: unknown
): Promise<PlaygroundSessionDto> {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_PLAYGROUND_SESSION");
  }

  const payload = input as CreatePlaygroundSessionInput;
  const title = normalizeOptionalStringField(
    payload.title,
    {
      min: 1,
      max: 80,
    },
    "INVALID_PLAYGROUND_SESSION"
  );
  const visibility = normalizeSessionVisibility(payload.visibility);
  const filesFromInput = normalizeSessionFiles(payload.files, {
    required: false,
  });

  let templateId: ObjectId | null = null;
  let forkedFromSessionId: ObjectId | null = null;

  const db = await getMongoDb();
  const viewer = await syncActorToUserDocument(actor);

  let template: PlaygroundTemplateDocument | null = null;
  const templateIdRaw = normalizeOptionalStringField(
    payload.templateId,
    {
      min: 1,
      max: 100,
    },
    "INVALID_PLAYGROUND_SESSION"
  );
  if (templateIdRaw) {
    template = await getPlaygroundTemplateByIdOrSlug(db, {
      tenantId: actor.tenantId,
      templateIdOrSlug: templateIdRaw,
    });
    if (!template || !template.isPublished) {
      throw new Error("PLAYGROUND_TEMPLATE_NOT_FOUND");
    }
    templateId = template._id;
  }

  let forkSession: PlaygroundSessionDocument | null = null;
  const forkFromSessionIdRaw = normalizeOptionalStringField(
    payload.forkFromSessionId,
    {
      min: 1,
      max: 100,
    },
    "INVALID_PLAYGROUND_SESSION"
  );
  if (forkFromSessionIdRaw) {
    forkedFromSessionId = assertObjectId(
      forkFromSessionIdRaw,
      "INVALID_PLAYGROUND_SESSION"
    );
    forkSession = await getPlaygroundSessionById(db, {
      tenantId: actor.tenantId,
      sessionId: forkedFromSessionId,
    });
    if (!forkSession) {
      throw new Error("PLAYGROUND_SESSION_NOT_FOUND");
    }
    if (!canReadSession(forkSession, viewer._id)) {
      throw new Error("FORBIDDEN");
    }
  }

  const sessionFiles =
    filesFromInput ??
    (forkSession
      ? cloneSessionFiles(forkSession.files)
      : template
      ? cloneSessionFiles(template.starterFiles)
      : [
          {
            path: "main.ts",
            language: "typescript",
            content: 'console.log("Hello Playground");',
          },
        ]);

  const created = await createPlaygroundSession(db, {
    tenantId: actor.tenantId,
    userId: viewer._id,
    templateId: templateId ?? forkSession?.templateId ?? null,
    forkedFromSessionId,
    title: normalizeNewSessionTitle({
      explicitTitle: title,
      template,
      fork: forkSession,
    }),
    visibility,
    files: sessionFiles,
  });

  return toPlaygroundSessionDto(created, viewer._id);
}

export async function listCurrentActorPlaygroundSessions(
  actor: ActorContext,
  params: {
    limit: number;
    status?: PlaygroundSessionDocument["status"];
  }
): Promise<{
  items: PlaygroundSessionDto[];
  count: number;
}> {
  const db = await getMongoDb();
  const viewer = await syncActorToUserDocument(actor);
  const statuses = params.status ? [params.status] : undefined;
  const rows = await listPlaygroundSessionsByUser(db, {
    tenantId: actor.tenantId,
    userId: viewer._id,
    statuses,
    limit: Math.min(Math.max(params.limit, 1), MAX_SESSION_LIMIT),
  });

  return {
    items: rows.map((row) => toPlaygroundSessionDto(row, viewer._id)),
    count: rows.length,
  };
}

export async function getPlaygroundSessionDetail(
  actor: ActorContext,
  sessionId: string
): Promise<PlaygroundSessionDto> {
  const parsedSessionId = assertObjectId(sessionId, "INVALID_PLAYGROUND_SESSION");
  const { session, viewerUserId } = await loadSessionForViewer({
    actor,
    sessionId: parsedSessionId,
  });
  return toPlaygroundSessionDto(session, viewerUserId);
}

export async function patchPlaygroundSessionFiles(
  actor: ActorContext,
  sessionId: string,
  input: unknown
): Promise<PlaygroundSessionDto> {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  const payload = input as UpdateSessionFilesInput;
  const mode = normalizeMode(payload.mode);
  const patchFilesInput = normalizeSessionFiles(payload.files, {
    required: true,
  });
  if (!patchFilesInput) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }
  const patchFiles = patchFilesInput;
  const parsedSessionId = assertObjectId(sessionId, "INVALID_PLAYGROUND_SESSION");
  const db = await getMongoDb();
  const viewer = await syncActorToUserDocument(actor);

  const session = await getPlaygroundSessionById(db, {
    tenantId: actor.tenantId,
    sessionId: parsedSessionId,
  });
  if (!session) {
    throw new Error("PLAYGROUND_SESSION_NOT_FOUND");
  }

  if (!session.userId.equals(viewer._id)) {
    throw new Error("FORBIDDEN");
  }
  if (session.status !== "active") {
    throw new Error("PLAYGROUND_SESSION_ARCHIVED");
  }

  let nextFiles = patchFiles;
  if (mode === "merge") {
    const byPath = new Map(session.files.map((file) => [file.path, file]));
    for (const file of patchFiles) {
      byPath.set(file.path, file);
    }
    nextFiles = Array.from(byPath.values());
  }

  if (nextFiles.length === 0 || nextFiles.length > MAX_FILE_COUNT) {
    throw new Error("INVALID_PLAYGROUND_FILE_PATCH");
  }

  const updated = await updatePlaygroundSessionFiles(db, {
    tenantId: actor.tenantId,
    sessionId: parsedSessionId,
    files: nextFiles,
  });

  if (!updated) {
    throw new Error("PLAYGROUND_SESSION_NOT_FOUND");
  }

  return toPlaygroundSessionDto(updated, viewer._id);
}

export async function runCurrentActorPlaygroundSession(
  actor: ActorContext,
  sessionId: string,
  input: unknown
): Promise<PlaygroundRunDto> {
  const parsedSessionId = assertObjectId(sessionId, "INVALID_PLAYGROUND_SESSION");
  if (input !== undefined && input !== null && typeof input !== "object") {
    throw new Error("INVALID_PLAYGROUND_RUN");
  }

  const payload = (input ?? {}) as RunPlaygroundSessionInput;
  const runtimeFromInput = normalizeRunOptionalString(payload.runtime, {
    min: 2,
    max: 60,
  });
  const entryFile = normalizeRunOptionalString(payload.entryFile, {
    min: 1,
    max: 200,
  });
  const command = normalizeRunOptionalString(payload.command, {
    min: 1,
    max: 120,
  });
  const summary = normalizeRunOptionalString(payload.summary, {
    min: 3,
    max: 300,
  });
  const mode = normalizeRunMode(payload.mode);

  const db = await getMongoDb();
  const viewer = await syncActorToUserDocument(actor);
  const session = await getPlaygroundSessionById(db, {
    tenantId: actor.tenantId,
    sessionId: parsedSessionId,
  });

  if (!session) {
    throw new Error("PLAYGROUND_SESSION_NOT_FOUND");
  }
  if (!session.userId.equals(viewer._id)) {
    throw new Error("FORBIDDEN");
  }
  if (session.status !== "active") {
    throw new Error("PLAYGROUND_SESSION_ARCHIVED");
  }

  let template: PlaygroundTemplateDocument | null = null;
  if (session.templateId) {
    template = await getPlaygroundTemplateByIdOrSlug(db, {
      tenantId: actor.tenantId,
      templateIdOrSlug: session.templateId.toString(),
    });
  }

  const runtime = inferRuntimeFromSession(session, template, runtimeFromInput);
  const explicitRules = normalizeTemplateValidationRules(template?.validationRules ?? []);
  const normalizedRules =
    explicitRules.length > 0
      ? explicitRules
      : deriveFallbackValidationRulesFromTemplate(template);

  const startedAt = new Date();
  let runtimeResult:
    | {
        status: PlaygroundRunDocument["status"];
        exitCode: number | null;
        logs: string[];
        resolvedEntryFile: string | null;
      }
    | undefined;

  if (runtime === "node") {
    runtimeResult = executeNodeSandbox({
      files: session.files,
      entryFile,
    });
  } else if (runtime === "python") {
    runtimeResult = {
      status: "failed",
      exitCode: 1,
      logs: ["Python runtime execution is not configured yet for this environment."],
      resolvedEntryFile: entryFile ?? null,
    };
  } else {
    runtimeResult = {
      status: "succeeded",
      exitCode: 0,
      logs: ["Runtime does not require server execution. Validation checks were evaluated."],
      resolvedEntryFile: entryFile ?? null,
    };
  }

  const checks = evaluateTemplateValidationRules({
    files: session.files,
    rules: normalizedRules,
  });
  const checksPassed = checks.every((check) => check.passed);
  const finalStatus: PlaygroundRunDocument["status"] =
    runtimeResult.status === "failed" || !checksPassed ? "failed" : "succeeded";
  const defaultSummary =
    finalStatus === "succeeded"
      ? mode === "run"
        ? "Execution completed successfully."
        : "Validation checks passed."
      : mode === "run"
      ? "Execution failed."
      : "Validation failed.";

  const finishedAt = new Date();
  const rawLog = buildRunRawLog({
    runtime,
    mode,
    requestedEntryFile: entryFile,
    resolvedEntryFile: runtimeResult.resolvedEntryFile,
    command,
    runtimeStatus: runtimeResult.status,
    runtimeLogs: runtimeResult.logs,
    checks,
  });

  const run = await createPlaygroundRun(db, {
    tenantId: actor.tenantId,
    sessionId: session._id,
    userId: viewer._id,
    mode,
    runtime,
    status: finalStatus,
    exitCode: finalStatus === "failed" ? runtimeResult.exitCode ?? 1 : 0,
    summary: summary ?? defaultSummary,
    rawLog,
    checks,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  await setPlaygroundSessionLatestRun(db, {
    tenantId: actor.tenantId,
    sessionId: session._id,
    runId: run._id,
    runAt: finishedAt,
  });

  return toPlaygroundRunDto(run);
}

export async function listPlaygroundSessionRuns(
  actor: ActorContext,
  params: {
    sessionId: string;
    limit: number;
    cursor?: PlaygroundRunsCursor;
  }
): Promise<{
  items: PlaygroundRunDto[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}> {
  const parsedSessionId = assertObjectId(
    params.sessionId,
    "INVALID_PLAYGROUND_SESSION"
  );
  const { session } = await loadSessionForViewer({
    actor,
    sessionId: parsedSessionId,
  });

  const db = await getMongoDb();
  const pageSize = Math.min(Math.max(params.limit, 1), MAX_RUN_LIMIT);
  const rows = await listPlaygroundRunsBySession(db, {
    tenantId: actor.tenantId,
    sessionId: session._id,
    limit: pageSize + 1,
    cursor: params.cursor,
  });

  const hasMore = rows.length > pageSize;
  const visibleRows = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore
    ? encodePlaygroundRunsCursor({
        createdAt: visibleRows[visibleRows.length - 1].createdAt,
        id: visibleRows[visibleRows.length - 1]._id,
      })
    : null;

  return {
    items: visibleRows.map(toPlaygroundRunDto),
    pageInfo: {
      hasMore,
      nextCursor,
    },
  };
}
