<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may differ from older versions.

For speed, do not scan docs on every small edit. Read the relevant guide in `node_modules/next/dist/docs/` only when:
- changing `next.config.*`
- touching routing, data-fetching, caching, or rendering behavior
- using a Next.js API you are not sure about

Heed deprecation notices when docs are consulted.
<!-- END:nextjs-agent-rules -->

# Project Snapshot (2026-05-19)

## Playground Sandbox

- Learner-first sandbox UX is implemented with:
  - mission panel
  - file tree + tabs + editor
  - preview / console / runs panels
  - share/fork/session flows
- Mobile responsiveness pass is complete.
- Run history includes:
  - status/mode badges
  - check summaries
  - expandable rows
  - mode filters with URL persistence (`runFilter` query).

## Playground Execution

- `POST /api/v1/playground/sessions/[sessionId]/run` now supports:
  - `mode: "run" | "test" | "check"`
- Runs store:
  - `mode`
  - validation `checks`
- Validation rules supported on templates:
  - `file_exists`
  - `file_includes`
  - `file_regex`
- Fallback behavior:
  - if no explicit `validationRules`, derive `file_exists` checks from starter files.

## Operational Notes

- Integration tests for playground should be run via:
  - `npm run test:integration:playground-api`
- Backfill script for existing templates:
  - `npm run db:backfill:playground-validation-rules`
