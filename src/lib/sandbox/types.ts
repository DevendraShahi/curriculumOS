export type SandboxLanguage =
  | "html"
  | "css"
  | "javascript"
  | "typescript"
  | "json";

export type SandboxFile = {
  id: string;
  name: string;
  language: SandboxLanguage;
  value: string;
};

export type SandboxValidatorId = "html-css-separation" | "default";

export type SandboxHint = {
  id: string;
  title?: string;
  content: string;
};

export type SandboxValidationRule =
  | { type: "hasTag"; tag: string; message: string; file?: string }
  | {
      type: "hasAttribute";
      tag: string;
      attribute: string;
      value?: string;
      message: string;
      file?: string;
    }
  | { type: "notHasAttribute"; tag?: string; attribute: string; message: string; file?: string }
  | { type: "regex"; pattern: string; message: string; file?: string }
  | { type: "file_exists"; file: string; message: string }
  | { type: "file_includes"; file: string; text: string; message: string }
  | { type: "file_regex"; file: string; pattern: string; message: string }
  | { type: "manualCheck"; message: string };

export type SandboxLesson = {
  id: string;
  title: string;
  description: string;
  goal: string;
  hints?: SandboxHint[];
  validationRules?: SandboxValidationRule[];
  initialFiles: SandboxFile[];
  validatorId: SandboxValidatorId;
};

export type ValidationResult = {
  id: string;
  label: string;
  passed: boolean;
};

export type SandboxRuntimeError = {
  id: string;
  type: "runtime-error";
  message: string;
  line?: number;
  column?: number;
  source?: string;
  createdAt: number;
};

export type SandboxProblem = {
  id: string;
  severity: "error" | "warning" | "info";
  source: "validation" | "runtime" | "system";
  title: string;
  message?: string;
  fileName?: string;
  line?: number;
  column?: number;
};

export type SandboxSaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";
