# AI Agent Workflow

Use this workflow for coding tasks in this repository.

## Before editing

1. Read [PROJECT.md](PROJECT.md), [STATUS.md](STATUS.md), relevant backlog/plan sections, and any applicable `AGENTS.md` instructions.
2. Inspect `git status` and preserve all existing user changes, including changes outside the requested feature.
3. Trace the current UI, API, backend service, and persistence path before changing behavior.
4. State the implementation scope and any assumptions in a short progress update when work spans multiple steps.

## While implementing

- Make the smallest complete change that satisfies the request.
- Follow the existing React/TypeScript, FastAPI/Python, and Tauri conventions.
- Keep UI, API, backend, and persisted data behavior consistent.
- Maintain Arabic RTL behavior and testable user-facing error states by design.
- Preserve existing APIs and data; make migrations explicit and backwards compatible.
- Do not add dependencies or replace a major subsystem without a clear requirement.
- Do not commit, publish, deploy, or modify external services unless the user asks.

## Validation and completion

- Run checks only when the user requests them or the task instructions explicitly require them.
- Report what changed, relevant files, validation performed (or not performed), and known limitations.
- Update [STATUS.md](STATUS.md) and [BACKLOG.md](BACKLOG.md) when a milestone changes project state.
- Record durable architectural choices in [DECISIONS.md](DECISIONS.md).
- Keep the detailed implementation plan current as phases complete.

## Reader enhancement sequence

For reader/comments work, follow [REVIEW_ENHANCEMENTS_PLAN.md](REVIEW_ENHANCEMENTS_PLAN.md) in order unless the user changes priority. Complete the authorized scope; do not stop for approval between phases. Ask only for information that materially blocks a safe implementation.
