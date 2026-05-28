import { Monaco } from "@monaco-editor/react";

export function getLanguageFromFile(filePath: string) {
  if (filePath.endsWith(".html")) return "html";
  if (filePath.endsWith(".css")) return "css";
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) return "javascript";
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".json")) return "json";
  return "plaintext";
}

export function syncSandpackFilesToMonaco(
  monaco: Monaco,
  files: Record<string, { code: string }>,
) {
  Object.entries(files).forEach(([path, file]) => {
    // Sandpack paths often start with "/", ensure Monaco URI consistency
    const uri = monaco.Uri.parse(`file://${path.startsWith('/') ? path : '/' + path}`);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      const language = getLanguageFromFile(path);
      model = monaco.editor.createModel(file.code, language, uri);
    } else {
      // If the model exists, we only update its value if it differs from Sandpack
      // This might happen if Sandpack resets files from the outside
      if (model.getValue() !== file.code) {
        model.setValue(file.code);
      }
    }
  });
}
