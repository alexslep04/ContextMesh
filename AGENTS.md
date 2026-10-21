# AGENTS.md

## Purpose

This repository contains **ContextMesh**, a local coordination layer for developers running multiple AI coding agents on the same project.

ContextMesh is intended to help agents such as **Codex** and **Claude Code** share relevant project context so they can:

- understand what other agents are currently working on,
- see what work was recently completed,
- understand important project decisions and why they were made,
- identify possible file or task overlap,
- pick up where another agent left off,
- reduce duplicate or conflicting work.

ContextMesh is **not** an autonomous multi-agent orchestrator. It should inform and coordinate agents, not assign work, cancel agents, or take control away from the developer.

---

## Read This First

Before making meaningful changes:

1. Read `ContextMesh_SPEC.md`.
2. Inspect the existing repository structure and relevant code.
3. Check for existing types, services, schemas, and conventions before creating new ones.
4. Keep changes scoped to the requested task.
5. Do not redesign the architecture unless the task explicitly requires it.

If this file and `ContextMesh_SPEC.md` conflict, treat `ContextMesh_SPEC.md` as the product/architecture source of truth. `PLAN.md` describes sequencing and verification; it must not silently change product scope.

---

## Core Architecture

The MVP is a **local-first TypeScript/Node.js application**.

Primary components:

- TypeScript
- Node.js
- Fastify
- SQLite
- Drizzle ORM
- Zod
- Git CLI integration
- MCP
- Codex plugin/hooks
- Claude Code plugin/hooks
- Pino
- Vitest
- CLI interface

High-level flow:

```text
Codex Plugin ─────┐
                  │
Claude Plugin ────┤
                  ↓
            Local ContextMesh API
                  ↓
           ContextMesh Core
      ┌───────────┼───────────┐
      ↓           ↓           ↓
    SQLite      Git CLI   Coordination Logic
      │                       │
      └───────────┬───────────┘
                  ↓
              MCP / CLI
                  ↓
          Relevant agent context
```

---

## Architectural Rules

### 1. Keep the core vendor-independent

Do not place Codex-specific or Claude-specific logic inside the core coordination engine.

Agent-specific data must be translated through adapters into common internal types.

Preferred flow:

```text
Codex event ──────> Codex adapter ──┐
                                    ├──> ContextMeshEvent
Claude event ─────> Claude adapter ──┘
```

The core should operate on ContextMesh's own normalized event and state models.

---

### 2. ContextMesh owns shared project memory

Codex and Claude report information to ContextMesh, but ContextMesh maintains the shared project state.

Do not make one agent's internal memory the source of truth for another agent.

ContextMesh should store structured information such as:

- active sessions,
- tasks,
- task status,
- expected files,
- actually changed files,
- project decisions,
- decision rationale,
- blockers,
- dependencies,
- next steps,
- commits,
- warnings,
- important completion summaries.

Do **not** store full terminal transcripts or entire conversations in the MVP.

---

### 3. Agents report meaning; Git reports evidence

Agents are responsible for semantic information:

- what task they are working on,
- what they expect to change,
- why a decision was made,
- whether they are blocked,
- what was completed,
- what should happen next.

Git and ContextMesh are responsible for factual repository state:

- files actually changed,
- branch/worktree state,
- commits,
- uncommitted changes,
- diffs,
- direct file overlap.

Do not rely only on agent self-reporting when repository evidence is available.

---

### 4. Report only at meaningful moments

The product should not require an agent to send constant status updates.

Meaningful semantic updates include:

- task understood / started,
- task materially changed,
- important project decision made,
- blocker encountered,
- blocker resolved,
- task completed.

Mechanical activity such as file edits should be observed through hooks and Git rather than requiring repeated semantic status messages.

---

### 5. Support task updates

An agent may change direction after beginning work.

The system must support updating an active task instead of forcing the agent to create a completely new task for every change in scope.

Example:

```text
Original:
Implement authentication.

Updated:
Implement backend authentication only.

Reason:
Another session is handling the frontend login flow.
```

---

### 6. Record meaningful decisions only

A decision should be useful to another agent later.

Good examples:

- "Use JWT authentication rather than server sessions."
- "All normalized events are validated with Zod before storage."
- "Authentication middleware lives under `src/middleware/`."

Do not treat ordinary actions such as opening a file or running a command as project decisions.

---

### 7. Completion updates must support handoff

When an agent completes meaningful work, the completion record should make it possible for another agent to continue without reconstructing the previous session.

A useful completion update includes:

- task completed,
- short summary,
- important files changed,
- important decisions,
- blockers still remaining,
- next steps,
- commit information when available.

---

### 8. Warn; do not control

For the MVP, ContextMesh should:

- surface relevant context,
- detect possible overlap,
- produce warnings,
- make project state queryable.

It should **not**:

- prevent file edits,
- automatically cancel agents,
- assign tasks,
- autonomously resolve conflicts,
- force agents to use specific worktrees,
- make major project decisions.

---

### 9. Be worktree-aware, but do not manage worktrees in the MVP

The internal model should be able to distinguish:

- repository,
- branch,
- worktree,
- session.

However, ContextMesh does not need to create, delete, or automatically manage Git worktrees in the MVP.

---

### 10. Local-first by default

The MVP runs on one developer's computer.

Do not add cloud hosting, remote accounts, team permissions, or remote synchronization unless explicitly requested.

Local services should bind to loopback interfaces by default where appropriate.

### 11. Version durable memories

Durable decisions, progress checkpoints, handoffs, and blocker resolutions are
versioned records. New content supersedes old content; it must not overwrite
history or make a previous source impossible to inspect. FTS5 is a retrieval
index, not the source of truth.

### 12. Keep boundaries explicit

HTTP, MCP, CLI, and adapter inputs must use the same validated application
contracts. They must not access Drizzle repositories directly or duplicate
coordination logic. Adapters translate host-specific payloads into normalized
ContextMesh events.

### 13. Idempotency and evidence

External event delivery may be duplicated or delayed. Processing must be
idempotent by source event identity where one is available. Agent reports
describe intent; Git inspection supplies repository evidence. Never infer
changed files only from an agent claim when Git evidence is available.

---

## Suggested Internal Event Types

Prefer a discriminated union or similarly explicit model.

Initial event set:

- `session_started`
- `session_ended`
- `task_started`
- `task_updated`
- `task_completed`
- `file_intent_declared`
- `file_modified`
- `decision_recorded`
- `blocker_recorded`
- `blocker_resolved`
- `commit_created`
- `warning_created`
- `progress_checkpoint` (explicit durable progress report)

Do not add event types casually. Reuse or extend the existing schema when possible.

---

## Development Priorities

Build the system in vertical slices.

Recommended order:

1. Define normalized event types and validation.
2. Store events and current state in SQLite.
3. Support mock/fake sessions.
4. Implement task/session/project state.
5. Integrate Git verification.
6. Implement direct overlap detection.
7. Generate relevant context from stored state.
8. Add CLI inspection commands.
9. Integrate Codex.
10. Integrate Claude Code.
11. Add MCP tools/resources.
12. Improve installation and packaging.

A working end-to-end slice is more valuable than many disconnected modules.

---

## Testing Expectations

Use Vitest for unit and integration tests.

Prioritize tests for:

- event validation,
- event normalization,
- task transitions,
- session lifecycle,
- project state derivation,
- Git change detection,
- overlap detection,
- context generation,
- database persistence,
- adapter behavior,
- failure when ContextMesh is unavailable,
- duplicate/replayed events where relevant.

Prefer deterministic tests.

Avoid requiring real external agent sessions for every test. Use fixtures and mock adapter events where practical.

---

## Logging

Use structured logging with Pino.

Logs should help answer:

- What event arrived?
- Which session sent it?
- Was it accepted or rejected?
- What state changed?
- Was a warning generated?
- Did Git verification succeed?
- Did an MCP or local API call fail?

Do not log secrets or entire terminal transcripts.

---

## CLI

The CLI is the MVP human-inspection interface.

Expected commands may include:

```text
contextmesh start
contextmesh status
contextmesh sessions
contextmesh conflicts
contextmesh history
contextmesh doctor
```

Exact command names may evolve, but keep the CLI focused on inspection, startup, configuration, and debugging.

---

## Plugin / Adapter Guidance

### Codex

The Codex integration should be thin.

Its responsibilities:

- identify/register a session,
- observe supported lifecycle/tool events,
- normalize events into ContextMesh's internal format,
- retrieve relevant project context,
- allow meaningful task/decision/blocker/completion reporting.

Do not duplicate ContextMesh's database or coordination logic inside the plugin.

### Claude Code

Follow the same rule.

The Claude integration should translate Claude-specific hooks/events into the same normalized ContextMesh structures used by Codex.

Claude Code currently exposes session, tool, stop, and HTTP hook surfaces. Use
only the capabilities verified in the adapter implementation and document any
fallback behavior. Codex capabilities must be detected rather than assumed;
explicit MCP reporting is the safe baseline.

---

## MCP Guidance

MCP is an interface to the ContextMesh core, not the core architecture itself.

Possible tools/resources may include:

- `get_project_context`
- `get_active_sessions`
- `get_conflicts`
- `report_task`
- `update_task`
- `record_decision`
- `record_blocker`
- `resolve_blocker`
- `complete_task`

Do not expose unnecessary low-level database operations directly to agents.

---

## Code Quality Rules

- Prefer simple, explicit code over clever abstractions.
- Use strong TypeScript types.
- Validate data at process/API boundaries.
- Keep modules small and focused.
- Avoid large dependency additions without a clear need.
- Reuse existing utilities before adding new ones.
- Keep agent adapters isolated from core business logic.
- Keep database access behind clear repository/service boundaries.
- Avoid hidden global state.
- Use descriptive names.
- Add comments for non-obvious reasoning, not for obvious syntax.
- Do not silently swallow errors.

Scoped instructions live beside the code they govern:

- `src/domain/AGENTS.md`
- `src/application/AGENTS.md`
- `src/storage/AGENTS.md`
- `src/transport/AGENTS.md`
- `src/adapters/AGENTS.md`
- `tests/AGENTS.md`
- `docs/AGENTS.md`

---

## Scope Guardrails

The following are **not MVP requirements**:

- remote multi-user collaboration,
- user accounts,
- cloud hosting,
- team permissions,
- a React web dashboard,
- a polished VS Code extension,
- IDE-specific UI,
- additional agents beyond Codex and Claude,
- automatic worktree management,
- autonomous task assignment,
- autonomous conflict resolution,
- advanced semantic conflict prediction.

A polished VS Code extension, easier installation/distribution, and additional agent support are valid stretch goals.

---

## Before Finishing a Task

Before claiming a task is complete:

1. Run relevant tests.
2. Run type checking/linting if configured.
3. Confirm the change fits the existing architecture.
4. Update tests for changed behavior.
5. Update documentation when behavior, architecture, commands, or schemas changed.
6. Summarize:
   - what changed,
   - important files,
   - important design decisions,
   - remaining issues,
   - suggested next step.

Do not claim success if tests are failing or the feature was not verified.

For behavior changes, add or update deterministic tests. At minimum, cover
the happy path, invalid input, relevant state boundaries, and cross-layer
integration when the change crosses an API, adapter, database, or MCP seam.

---

## Final Principle

ContextMesh should make it easier for one developer to run multiple coding agents without becoming the manual message bus between them.

Every major implementation decision should support that goal.
