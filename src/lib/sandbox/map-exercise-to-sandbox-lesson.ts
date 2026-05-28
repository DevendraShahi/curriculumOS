import type {
  SandboxLesson,
  SandboxFile,
  SandboxHint,
  SandboxValidationRule,
} from "./types";

type RawExercise = {
  id?: string;
  title?: string | null;
  description?: string | null;
  instructions?: string | null;
  goal?: string | null;
  task?: string | null;
  starterCode?: string | null;
  validatorId?: SandboxLesson["validatorId"] | null;
  // Accept unknown[] since the caller types these loosely; the mapper validates them
  files?: SandboxFile[] | unknown[] | null;
  starterFiles?: SandboxFile[] | unknown[] | null;
  hints?: unknown[] | null;
  validationRules?: unknown[] | null;
};

function normalizeValidationRules(
  rawRules: unknown[] | null | undefined
): SandboxValidationRule[] {
  if (!Array.isArray(rawRules)) return [];

  const rules: SandboxValidationRule[] = [];

  for (const item of rawRules) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = typeof row.type === "string" ? row.type.trim() : "";
    const message = typeof row.message === "string" && row.message.trim()
      ? row.message.trim()
      : "Validation rule";

    if (type === "hasTag") {
      const tag = typeof row.tag === "string" ? row.tag.trim() : "";
      if (!tag) continue;
      const file = typeof row.file === "string" && row.file.trim() ? row.file.trim() : undefined;
      rules.push({ type, tag, file, message });
      continue;
    }

    if (type === "hasAttribute") {
      const tag = typeof row.tag === "string" ? row.tag.trim() : "";
      const attribute = typeof row.attribute === "string" ? row.attribute.trim() : "";
      if (!tag || !attribute) continue;
      const value = typeof row.value === "string" && row.value.trim() ? row.value.trim() : undefined;
      const file = typeof row.file === "string" && row.file.trim() ? row.file.trim() : undefined;
      rules.push({ type, tag, attribute, value, file, message });
      continue;
    }

    if (type === "notHasAttribute") {
      const attribute = typeof row.attribute === "string" ? row.attribute.trim() : "";
      if (!attribute) continue;
      const tag = typeof row.tag === "string" && row.tag.trim() ? row.tag.trim() : undefined;
      const file = typeof row.file === "string" && row.file.trim() ? row.file.trim() : undefined;
      rules.push({ type, tag, attribute, file, message });
      continue;
    }

    if (type === "regex") {
      const pattern = typeof row.pattern === "string" ? row.pattern.trim() : "";
      if (!pattern) continue;
      const file = typeof row.file === "string" && row.file.trim() ? row.file.trim() : undefined;
      rules.push({ type, pattern, file, message });
      continue;
    }

    if (type === "file_exists") {
      const file = typeof row.file === "string" ? row.file.trim() : "";
      if (!file) continue;
      rules.push({ type, file, message });
      continue;
    }

    if (type === "file_includes") {
      const file = typeof row.file === "string" ? row.file.trim() : "";
      const text = typeof row.text === "string" ? row.text : "";
      if (!file || !text) continue;
      rules.push({ type, file, text, message });
      continue;
    }

    if (type === "file_regex") {
      const file = typeof row.file === "string" ? row.file.trim() : "";
      const pattern = typeof row.pattern === "string" ? row.pattern.trim() : "";
      if (!file || !pattern) continue;
      rules.push({ type, file, pattern, message });
      continue;
    }

    if (type === "manualCheck") {
      rules.push({ type, message });
    }
  }

  return rules;
}

function normalizeLanguageFromName(name: string): SandboxFile["language"] {
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".js")) return "javascript";
  if (name.endsWith(".ts")) return "typescript";
  if (name.endsWith(".json")) return "json";
  return "html";
}

function toSafeFileId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

function normalizeRawFiles(rawFiles: unknown[] | null | undefined): SandboxFile[] {
  if (!Array.isArray(rawFiles)) return [];

  const files: SandboxFile[] = [];
  for (const item of rawFiles) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rawName =
      (typeof row.name === "string" && row.name.trim()) ||
      (typeof row.path === "string" && row.path.trim()) ||
      "";
    if (!rawName) continue;

    const language =
      typeof row.language === "string"
        ? (row.language as SandboxFile["language"])
        : normalizeLanguageFromName(rawName);
    const value =
      (typeof row.value === "string" && row.value) ||
      (typeof row.content === "string" && row.content) ||
      "";
    const id =
      (typeof row.id === "string" && row.id.trim()) || toSafeFileId(rawName);

    files.push({
      id,
      name: rawName,
      language,
      value,
    });
  }

  return files;
}

function applyStarterCodeToDefaults(
  starterCode: string | null | undefined,
  defaults: SandboxFile[]
): SandboxFile[] {
  const code = (starterCode ?? "").trim();
  if (!code) return defaults;

  const styleMarkerMatch = code.match(
    /\/\*\s*styles?\s*\*\/([\s\S]*?)\/\*\s*markup\s*\*\//i
  );
  const markupMarkerMatch = code.match(/\/\*\s*markup\s*\*\/([\s\S]*)$/i);
  if (styleMarkerMatch && markupMarkerMatch) {
    const extractedCss = styleMarkerMatch[1]?.trim() ?? "";
    const extractedHtml = markupMarkerMatch[1]?.trim() ?? "";
    return defaults.map((file) => {
      if (file.name === "style.css") {
        return { ...file, value: extractedCss };
      }
      if (file.name === "index.html") {
        return { ...file, value: extractedHtml };
      }
      return file;
    });
  }

  const looksLikeHtml = /<([a-z!][^>]*)>/i.test(code);
  const looksLikeCss =
    /[{][^}]*[}]/.test(code) ||
    code.includes("@media") ||
    code.includes("display:") ||
    code.includes("color:");
  const looksLikeJs =
    code.includes("function ") ||
    code.includes("const ") ||
    code.includes("let ") ||
    code.includes("document.");

  return defaults.map((file) => {
    if (looksLikeHtml && file.name === "index.html") {
      return { ...file, value: code };
    }
    if (!looksLikeHtml && looksLikeCss && file.name === "style.css") {
      return { ...file, value: code };
    }
    if (!looksLikeHtml && !looksLikeCss && looksLikeJs && file.name === "script.js") {
      return { ...file, value: code };
    }
    if (!looksLikeHtml && !looksLikeCss && !looksLikeJs && file.name === "index.html") {
      return { ...file, value: `<pre>${code.replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[m] as string)}</pre>` };
    }
    return file;
  });
}

function normalizeHints(rawHints: unknown[] | null | undefined): SandboxHint[] {
  if (!Array.isArray(rawHints)) return [];

  const hints: SandboxHint[] = [];

  for (const [index, item] of rawHints.entries()) {
    if (typeof item === "string") {
      const content = item.trim();
      if (!content) continue;
      hints.push({
        id: `hint-${index + 1}`,
        content,
      });
      continue;
    }

    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const contentCandidate =
      (typeof row.content === "string" && row.content.trim()) ||
      (typeof row.text === "string" && row.text.trim()) ||
      (typeof row.hint === "string" && row.hint.trim()) ||
      "";
    if (!contentCandidate) continue;

    const titleCandidate =
      (typeof row.title === "string" && row.title.trim()) ||
      (typeof row.label === "string" && row.label.trim()) ||
      undefined;
    const idCandidate =
      (typeof row.id === "string" && row.id.trim()) || `hint-${index + 1}`;

    hints.push({
      id: idCandidate,
      title: titleCandidate,
      content: contentCandidate,
    });
  }

  return hints;
}

export function mapExerciseToSandboxLesson(exercise: RawExercise): SandboxLesson {
  const files = normalizeRawFiles(exercise.files ?? exercise.starterFiles ?? []);

  // Always ensure all 3 core files exist. Merge with API files if they exist.
  const defaultFiles: SandboxFile[] = [
    {
      id: "index-html",
      name: "index.html",
      language: "html",
      value: "<h1>Welcome</h1>\n<p>This is a paragraph.</p>",
    },
    {
      id: "style-css",
      name: "style.css",
      language: "css",
      value: "",
    },
    {
      id: "script-js",
      name: "script.js",
      language: "javascript",
      value: "",
    },
  ];

  let mergedFiles = defaultFiles.map((df) => {
    const existing = files.find((f) => f.id === df.id || f.name === df.name);
    if (existing) return existing;
    return df;
  });

  if (typeof exercise.starterCode === "string" && exercise.starterCode.trim().length === 0) {
    mergedFiles = mergedFiles.map((file) =>
      file.name === "index.html" ? { ...file, value: "" } : file
    );
  } else {
    mergedFiles = applyStarterCodeToDefaults(exercise.starterCode, mergedFiles);
  }

  const hints = normalizeHints(exercise.hints);
  const validationRules = normalizeValidationRules(exercise.validationRules);

  return {
    id: exercise.id ?? "sandbox-exercise",
    title: exercise.title ?? exercise.task ?? "Exercise",
    description:
      exercise.description ??
      exercise.instructions ??
      "Complete the coding exercise in the editor.",
    goal:
      exercise.goal ??
      exercise.task ??
      "Update the code and pass the validation checks.",
    // CSS course exercises mostly use manual review rules; avoid forcing unrelated static validators.
    validatorId:
      exercise.validatorId === "html-css-separation" ||
      exercise.validatorId === "default"
        ? exercise.validatorId
        : "default",
    hints: hints.length > 0 ? hints : undefined,
    validationRules: validationRules.length > 0 ? validationRules : undefined,
    initialFiles: mergedFiles,
  };
}
