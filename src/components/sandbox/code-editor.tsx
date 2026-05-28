"use client";

import dynamic from "next/dynamic";
import type { Monaco, OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

type CodeEditorProps = {
  value: string;
  language: string;
  fileName?: string;
  onChange: (value: string) => void;
};

let htmlScaffoldProviderRegistered = false;

function registerHtmlScaffoldSnippetProvider(monaco: Monaco) {
  if (htmlScaffoldProviderRegistered) return;
  htmlScaffoldProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("html", {
    triggerCharacters: ["!", "l"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems: (model: any, position: any) => {
      if (!model.uri.path.endsWith("/index.html")) {
        return { suggestions: [] };
      }

      const word = model.getWordUntilPosition(position);
      const wordLower = word.word.toLowerCase();
      const lineUntilCursor = model
        .getLineContent(position.lineNumber)
        .slice(0, Math.max(0, position.column - 1));
      const justTypedBang = lineUntilCursor.endsWith("!");
      const isHtmlPrefix =
        wordLower === "h" ||
        wordLower === "ht" ||
        wordLower === "htm" ||
        wordLower === "html";

      if (!justTypedBang && !isHtmlPrefix) {
        return { suggestions: [] };
      }

      const range = justTypedBang
        ? {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: Math.max(1, position.column - 1),
            endColumn: position.column,
          }
        : {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

      return {
        suggestions: [
          {
            label: "HTML scaffold",
            detail: "Insert boilerplate document structure",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              "<!doctype html>",
              '<html lang="en">',
              "  <head>",
              '    <meta charset="UTF-8" />',
              '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
              "    <title>${1:Document}</title>",
              "  </head>",
              "  <body>",
              "    ${2}",
              "  </body>",
              "</html>",
            ].join("\n"),
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation:
              "Use this when an exercise asks for full HTML structure.",
            range,
            sortText: "0000",
            filterText: "html !",
          },
        ],
      };
    },
  });
}

export function CodeEditor({
  value,
  language,
  fileName,
  onChange,
}: CodeEditorProps) {
  const handleMount: OnMount = (editor, monaco) => {
    registerHtmlScaffoldSnippetProvider(monaco);

    monaco.editor.defineTheme("curriculum-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "tag", foreground: "67E8F9" },
        { token: "attribute.name", foreground: "C084FC" },
        { token: "string", foreground: "86EFAC" },
        { token: "comment", foreground: "71717A" },
      ],
      colors: {
        "editor.background": "#070A0F",
        "editor.foreground": "#E5E7EB",
        "editorLineNumber.foreground": "#52525B",
        "editorLineNumber.activeForeground": "#67E8F9",
        "editorCursor.foreground": "#22D3EE",
        "editor.selectionBackground": "#164E63",
        "editor.lineHighlightBackground": "#0F172A",
        "editorGutter.background": "#070A0F",
      },
    });

    monaco.editor.setTheme("curriculum-dark");

    editor.updateOptions({
      fontSize: 14,
      lineHeight: 22,
      fontFamily:
        "JetBrains Mono, Geist Mono, Menlo, Monaco, Consolas, monospace",
      minimap: { enabled: false },
      wordWrap: "on",
      tabSize: 2,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: {
        top: 16,
        bottom: 16,
      },
    });
  };

  return (
    <MonacoEditor
      height="100%"
      language={language}
      path={fileName ? `file:///${fileName}` : undefined}
      value={value}
      theme="light"
      onMount={handleMount}
      onChange={(value) => onChange(value ?? "")}
      options={{
        fontLigatures: true,
        bracketPairColorization: {
          enabled: true,
        },
        guides: {
          indentation: true,
          bracketPairs: true,
        },
      }}
    />
  );
}
