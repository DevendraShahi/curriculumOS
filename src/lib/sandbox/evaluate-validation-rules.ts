import { validateProject, type ValidationRule as PlaygroundValidationRule } from "@/lib/playground-validation";
import type { SandboxFile, SandboxValidationRule, ValidationResult } from "./types";

function toFileRecord(files: SandboxFile[]): Record<string, { code: string }> {
  const record: Record<string, { code: string }> = {};

  for (const file of files) {
    record[file.name] = { code: file.value };
    record[`/${file.name}`] = { code: file.value };
  }

  return record;
}

function toAutomaticRule(
  rule: SandboxValidationRule
): PlaygroundValidationRule | null {
  if (
    rule.type === "hasTag" ||
    rule.type === "hasAttribute" ||
    rule.type === "notHasAttribute" ||
    rule.type === "regex"
  ) {
    return rule;
  }
  return null;
}

export function evaluateValidationRules(params: {
  rules: SandboxValidationRule[];
  files: SandboxFile[];
  initialFiles: SandboxFile[];
}): ValidationResult[] {
  const fileRecord = toFileRecord(params.files);
  const initialByName = new Map(params.initialFiles.map((file) => [file.name, file.value]));
  const anyCodeChanged = params.files.some(
    (file) => (initialByName.get(file.name) ?? "") !== file.value
  );

  return params.rules.map((rule, index) => {
    const fallbackId = `rule-${index + 1}-${rule.type}`;

    if (rule.type === "manualCheck") {
      return {
        id: fallbackId,
        label: rule.message,
        passed: anyCodeChanged,
      };
    }

    if (rule.type === "file_exists") {
      return {
        id: fallbackId,
        label: rule.message,
        passed: Boolean(fileRecord[rule.file] ?? fileRecord[`/${rule.file}`]),
      };
    }

    if (rule.type === "file_includes") {
      const file = fileRecord[rule.file] ?? fileRecord[`/${rule.file}`];
      return {
        id: fallbackId,
        label: rule.message,
        passed: Boolean(file?.code.includes(rule.text)),
      };
    }

    if (rule.type === "file_regex") {
      const file = fileRecord[rule.file] ?? fileRecord[`/${rule.file}`];
      if (!file) {
        return {
          id: fallbackId,
          label: rule.message,
          passed: false,
        };
      }

      try {
        return {
          id: fallbackId,
          label: rule.message,
          passed: new RegExp(rule.pattern, "m").test(file.code),
        };
      } catch {
        return {
          id: fallbackId,
          label: rule.message,
          passed: false,
        };
      }
    }

    const autoRule = toAutomaticRule(rule);
    if (!autoRule) {
      return {
        id: fallbackId,
        label: "Unsupported validation rule",
        passed: false,
      };
    }

    const [result] = validateProject(fileRecord, [autoRule]);
    return {
      id: fallbackId,
      label: result?.message ?? rule.message,
      passed: result?.passed ?? false,
    };
  });
}
