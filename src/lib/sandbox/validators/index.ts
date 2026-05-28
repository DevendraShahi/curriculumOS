import type { SandboxFile, ValidationResult } from "../types";
import { validateHtmlCssSeparation } from "./html-css-separation";

export type SandboxValidatorId = "html-css-separation" | "default";

export const sandboxValidators: Record<
  SandboxValidatorId,
  (files: SandboxFile[]) => ValidationResult[]
> = {
  "html-css-separation": validateHtmlCssSeparation,
  "default": (_files: SandboxFile[]) => [], // Default fallback
};
