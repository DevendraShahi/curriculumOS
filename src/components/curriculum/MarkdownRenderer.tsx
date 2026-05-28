"use client";

import { Fragment } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleOff,
  ClipboardCheck,
  Lightbulb,
  ListChecks,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { LazyCodeBlock } from "@/components/curriculum/LazyCodeBlock";

function FencedCodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative my-4">
      <LazyCodeBlock code={code} language={language} />
    </div>
  );
}

export function renderInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={`code-${idx}`}
          className="rounded-sm bg-[var(--code-inline-bg)] px-1 py-0.5 font-mono text-xs text-[var(--code-inline-fg)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={`text-${idx}`}>{part}</Fragment>;
  });
}

function normalizeHeadingKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getHeadingIcon(headingKey: string) {
  if (headingKey === "summary") return <Sparkles size={14} />;
  if (headingKey === "why this matters") return <Lightbulb size={14} />;
  if (headingKey === "concept brief") return <ListChecks size={14} />;
  if (headingKey === "guided build") return <Target size={14} />;
  if (headingKey === "try it yourself") return <CheckCircle2 size={14} />;
  if (headingKey === "common mistakes") return <AlertTriangle size={14} />;
  if (headingKey === "checkpoint") return <ClipboardCheck size={14} />;
  if (headingKey === "next step") return <Target size={14} />;
  return <ListChecks size={14} />;
}

function getCommonMistakeIcon(index: number) {
  const icons = [AlertTriangle, XCircle, CircleOff, Ban];
  const Icon = icons[index % icons.length];
  return <Icon size={14} />;
}

/**
 * Strips redundant leading content from lesson bodyMarkdown.
 *
 * The lesson page already renders `lesson.title` as an <h1> and
 * `lesson.summary` as a <p> in the header card above the body section.
 * Many seeded lessons begin their bodyMarkdown by repeating those same
 * values as a `# Title` + `## Summary` block, causing visible duplication.
 *
 * This function removes:
 *  1. A leading `# …` heading if it matches the lesson title (case-insensitive trim)
 *  2. The next `## Summary` heading + its paragraph body, if present
 */
export function stripRedundantPreamble(
  markdown: string,
  lessonTitle: string,
  lessonSummary: string
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  // Skip leading blank lines
  while (i < lines.length && !lines[i].trim()) i++;

  // Strip matching # H1
  if (i < lines.length) {
    const h1Match = lines[i].match(/^#\s+(.+)$/);
    if (
      h1Match &&
      h1Match[1].trim().toLowerCase() === lessonTitle.trim().toLowerCase()
    ) {
      i++;
    }
  }

  // Skip blank lines between H1 and potential ## Summary
  while (i < lines.length && !lines[i].trim()) i++;

  // Strip ## Summary heading + its paragraph if it matches lesson.summary
  if (i < lines.length) {
    const h2Match = lines[i].match(/^##\s+(.+)$/);
    if (h2Match && h2Match[1].trim().toLowerCase() === "summary") {
      i++; // skip the ## Summary heading
      // Skip blank lines
      while (i < lines.length && !lines[i].trim()) i++;
      // Skip the summary paragraph text if it matches
      if (i < lines.length) {
        const paraText = lines[i].trim();
        if (paraText.toLowerCase() === lessonSummary.trim().toLowerCase()) {
          i++;
        }
      }
    }
  }

  return lines.slice(i).join("\n");
}

export function MarkdownRenderer({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: React.ReactNode[] = [];
  let activeHeadingKey: string | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || "text";
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].startsWith("```")) i += 1;

      blocks.push(
        <FencedCodeBlock
          key={`code-block-${blocks.length}`}
          code={codeLines.join("\n")}
          language={language}
        />
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      activeHeadingKey = normalizeHeadingKey(text);
      const className =
        level === 1
          ? "mt-6 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
          : level === 2
            ? "mt-5 text-xl font-semibold tracking-tight text-[var(--foreground)]"
            : "mt-4 text-lg font-semibold tracking-tight text-[var(--foreground)]";
      const Tag = (level === 1 ? "h2" : level === 2 ? "h2" : "h3") as
        | "h2"
        | "h3";
      blocks.push(
        <Tag key={`heading-${blocks.length}`} className={className}>
          <span className="inline-flex items-center gap-2">
            <span className="text-[var(--muted-foreground)]">
              {getHeadingIcon(activeHeadingKey)}
            </span>
            <span>{renderInlineMarkdown(text)}</span>
          </span>
        </Tag>
      );
      i += 1;
      continue;
    }

    const listItems: string[] = [];
    while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
      listItems.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
      i += 1;
    }
    if (listItems.length > 0) {
      if (activeHeadingKey === "common mistakes") {
        blocks.push(
          <div
            key={`common-mistakes-${blocks.length}`}
            className="my-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4"
          >
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <AlertTriangle size={14} />
              <span className="font-mono text-[10px] uppercase tracking-widest">
                Watch Outs
              </span>
            </div>
            <ul className="space-y-2">
              {listItems.map((item, idx) => (
                <li
                  key={`mistake-${idx}`}
                  className="flex items-start gap-2 rounded border border-amber-500/20 bg-black/20 px-3 py-2 text-sm leading-6 text-[var(--foreground)]"
                >
                  <span className="mt-1 text-amber-300">
                    {getCommonMistakeIcon(idx)}
                  </span>
                  <span>{renderInlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      } else {
        blocks.push(
          <ul
            key={`list-${blocks.length}`}
            className="my-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--foreground)]"
          >
            {listItems.map((item, idx) => (
              <li key={`li-${idx}`}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
      }
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^(#{1,3})\s+/) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }

    if (paragraphLines.length > 0) {
      const paragraph = paragraphLines.join(" ").trim();
      blocks.push(
        <p
          key={`p-${blocks.length}`}
          className="my-3 text-base leading-7 text-[var(--foreground)]"
        >
          {renderInlineMarkdown(paragraph)}
        </p>
      );
    }
  }

  return <div className={className}>{blocks}</div>;
}
