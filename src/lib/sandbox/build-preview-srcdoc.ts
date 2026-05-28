import type { SandboxFile } from "./types";

export function buildPreviewSrcDoc(files: SandboxFile[]) {
  const html = files.find((file) => file.name === "index.html")?.value ?? "";
  const css = files.find((file) => file.name === "style.css")?.value ?? "";
  const js = files.find((file) => file.name === "script.js")?.value ?? "";

  const safeJs = js.replaceAll("</script>", "<\\/script>");

  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      ${css}
    </style>
  </head>
  <body>
    ${html}

    <script>
      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({
          type: "sandbox-error",
          message: String(message),
          line: lineno,
          column: colno
        }, "*");
      };

      try {
        ${safeJs}
      } catch (error) {
        window.parent.postMessage({
          type: "sandbox-error",
          message: error instanceof Error ? error.message : String(error)
        }, "*");
      }
    </script>
  </body>
</html>`;
}
