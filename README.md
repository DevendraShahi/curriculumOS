 # Curriculum.OS Web

Curriculum.OS Web is the learning operating system layer for curriculum delivery, focused practice, project execution, and progress intelligence.

## Core Product Features

### Curriculum Experience

- Structured course delivery with:
  - course, module, lesson, quiz, and syllabus APIs
  - lesson runtime and quiz attempt flows
- Learner progression tracking across:
  - enrollments
  - progress snapshots
  - progress event streams

### Playground Sandbox (Learner Coding Lab)

- Full lab workspace with:
  - mission panel and checkpoints
  - file tree, tabbed editor, add/rename/delete file controls
  - preview / console / run history panels
- Session lifecycle:
  - create, save, fork, share, and restore
  - private/unlisted/public session visibility
- Run system:
  - run modes: `run`, `test`, `check`
  - node runtime execution path with timeout control
  - structured run checks and logs
  - mode-aware run history with filters, badges, and expandable diagnostics
- Validation system:
  - template-level rules: `file_exists`, `file_includes`, `file_regex`
  - fallback rule generation from starter files when explicit rules are missing

### Focus Mode

- Dedicated deep-work screen with:
  - session timer
  - focus messaging
  - persistent in-session context
- Dynamic visibility behavior where focus state remains visible while navigating.

### Community + Collaboration

- Discussion infrastructure:
  - threads, comments, votes, tags
  - community leaderboard and moderation-ready status fields
- Supports collaborative learning and async problem-solving workflows.

### Projects + Profile

- Project catalog and learner submissions pipeline
- Profile overview with activity and progress metrics
- Notifications and preference management

### Platform + Data Layer

- Multi-tenant-aware data model and APIs
- Operational scripts for:
  - DB setup
  - seed/reset workflows
  - targeted backfills
- Integration-test coverage for key verticals, including playground execution flows.

## Current Progress Snapshot

- Playground UX and runtime pipeline are substantially implemented and validated in integration tests.
- Mobile responsiveness is completed for key sandbox interactions.
- Run evaluation and validation rules are now first-class product features rather than placeholder metrics.

# curriculum.os

# curriculum.os

# curriculum.os
