import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PAGE_PATH =
  "/Users/devendrashahithakuri/Work/curriculum/apps/web/src/components/curriculum/LessonRuntimeClient.tsx";
const CSS_PATH =
  "/Users/devendrashahithakuri/Work/curriculum/apps/web/src/app/globals.css";

test("lesson page contains overflow-safe expected-output container", async () => {
  const source = await readFile(PAGE_PATH, "utf8");
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /max-h-\[60vh\]/);
});

test("lesson page includes expected output placeholder", async () => {
  const source = await readFile(PAGE_PATH, "utf8");
  assert.match(source, /No expected output checklist yet\./);
});

test("lesson page includes ARIA region labeling", async () => {
  const source = await readFile(PAGE_PATH, "utf8");
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label="Lesson content"/);
});

test("lesson page uses shared Button and toast feedback", async () => {
  const source = await readFile(PAGE_PATH, "utf8");
  assert.match(source, /from "@\/components\/ui\/Button"/);
  assert.match(source, /from "@\/components\/ui\/Toast"/);
  assert.match(source, /Lesson marked complete/);
});

test("dark mode code background token is defined", async () => {
  const source = await readFile(CSS_PATH, "utf8");
  assert.match(source, /--code-bg-dark:\s*#2a2a2a;/);
});
