export type ValidationRule = (
  | { type: "hasTag"; tag: string; message: string }
  | { type: "hasAttribute"; tag: string; attribute: string; value?: string; message: string }
  | { type: "notHasAttribute"; tag?: string; attribute: string; message: string }
  | { type: "regex"; pattern: string; message: string }
) & { file?: string }; // Optional target file, defaults to index.html

export type ValidationResult = {
  passed: boolean;
  message: string;
};

const IMPLIED_HTML_TAGS = new Set(["html", "head", "body"]);

function hasExplicitTagInSource(code: string, tag: string): boolean {
  const normalizedTag = tag.trim().toLowerCase();
  if (!normalizedTag) return false;
  const escapedTag = normalizedTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const openTagRegex = new RegExp(`<\\s*${escapedTag}(?=\\s|>)`, "i");
  return openTagRegex.test(code);
}

export function validateProject(
  files: Record<string, { code: string }>,
  rules: ValidationRule[]
): ValidationResult[] {
  // Cache parsed documents so we don't re-parse the same HTML file multiple times per run
  const parsedDocs: Record<string, Document> = {};

  const getDoc = (filePath: string): Document | null => {
    if (typeof window === 'undefined') return null;
    if (parsedDocs[filePath]) return parsedDocs[filePath];
    
    const file = files[filePath] || files[`/${filePath}`];
    if (!file) return null;

    // Only parse HTML
    if (filePath.endsWith('.html')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(file.code, "text/html");
      parsedDocs[filePath] = doc;
      return doc;
    }
    return null;
  };

  const getFileCode = (filePath: string): string => {
    const file = files[filePath] || files[`/${filePath}`];
    return file ? file.code : "";
  };

  return rules.map((rule) => {
    let passed = false;
    const targetFile = rule.file || "index.html";
    const targetPath = targetFile.startsWith('/') ? targetFile.slice(1) : targetFile;
    const doc = getDoc(targetPath);
    const code = getFileCode(targetPath);

    switch (rule.type) {
      case "hasTag": {
        const normalizedTag = rule.tag.trim().toLowerCase();
        const shouldRequireExplicitSource =
          targetPath.endsWith(".html") && IMPLIED_HTML_TAGS.has(normalizedTag);

        if (shouldRequireExplicitSource) {
          passed = hasExplicitTagInSource(code, normalizedTag);
        } else if (doc) {
          passed = doc.querySelector(rule.tag) !== null;
        }
        break;
      }
      case "hasAttribute": {
        if (doc) {
          const elements = doc.querySelectorAll(rule.tag);
          for (const el of Array.from(elements)) {
            if (el.hasAttribute(rule.attribute)) {
              if (rule.value) {
                if (el.getAttribute(rule.attribute) === rule.value) {
                  passed = true;
                  break;
                }
              } else {
                passed = true;
                break;
              }
            }
          }
        }
        break;
      }
      case "notHasAttribute": {
        if (doc) {
          const selector = rule.tag ? rule.tag : "*";
          const elements = doc.querySelectorAll(selector);
          passed = true; 
          for (const el of Array.from(elements)) {
            if (el.hasAttribute(rule.attribute)) {
              passed = false;
              break;
            }
          }
        }
        break;
      }
      case "regex": {
        try {
          // HTML checks should ignore tag-case differences (e.g. DOCTYPE vs doctype).
          const flags = targetPath.endsWith(".html") ? "im" : "m";
          const regex = new RegExp(rule.pattern, flags);
          passed = regex.test(code);
        } catch {
          console.error("Invalid regex in rule", rule.pattern);
          passed = false;
        }
        break;
      }
    }

    return {
      passed,
      message: rule.message,
    };
  });
}
