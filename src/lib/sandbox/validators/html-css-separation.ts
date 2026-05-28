import type { SandboxFile, ValidationResult } from "../types";

export function validateHtmlCssSeparation(
  files: SandboxFile[]
): ValidationResult[] {
  const html = files.find((file) => file.name === "index.html")?.value ?? "";
  const css = files.find((file) => file.name === "style.css")?.value ?? "";

  return [
    {
      id: "remove-style-tag",
      label: "Remove CSS from <style> blocks inside index.html",
      passed: !/<style[\s\S]*?>[\s\S]*?<\/style>/i.test(html),
    },
    {
      id: "remove-inline-style",
      label: "Remove inline style attributes from HTML elements",
      passed: !/\sstyle\s*=/i.test(html),
    },
    {
      id: "move-css-to-file",
      label: "Move styling rules into style.css",
      passed: css.trim().length > 0,
    },
    {
      id: "keep-semantic-html",
      label: "Keep the heading and paragraph as semantic HTML",
      passed:
        /<h1[\s\S]*?>[\s\S]*welcome[\s\S]*?<\/h1>/i.test(html) &&
        /<p[\s\S]*?>[\s\S]*paragraph[\s\S]*?<\/p>/i.test(html),
    },
  ];
}
