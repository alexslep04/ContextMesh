# ContextMesh Specification

## 1. Project Summary

**ContextMesh** is a local coordination layer for developers running multiple AI coding sessions on the same software project.

The MVP supports **Codex** and **Claude Code**.

Each coding agent normally has its own context window and may not know what another active agent is doing. This can lead to:

- duplicate work,
- overlapping file edits,
- incompatible decisions,
- stale assumptions,
- lost reasoning between sessions,
- extra manual coordination for the developer.

ContextMesh gives connected agents a shared, structured view of relevant project activity so they can understand what is being worked on, what was completed, why important decisions were made, and what should happen next.

---

## 2. Product Goal

A developer should be able to run multiple local AI coding sessions without manually copying project context between them.

ContextMesh should allow an agent to:

- understand current active work,
- see recent completed work,
- know which files are relevant,
- understand important project decisions and rationale,
- identify possible overlap with another session,
- see blockers and dependencies,
- continue work that another agent completed.

The developer remains in control.

ContextMesh provides **awareness and coordination**, not autonomous orchestration.

---

## 3. MVP Scope

The MVP will:

1. Run locally on one developer's computer.
2. Support Codex and Claude Code.
3. Allow multiple active sessions for the same project.
4. Register session start/end events.
5. Allow an agent to report a task once it understands the work.
6. Allow an agent to update its active task.
7. Allow an agent to report expected files.
8. Observe actual file activity through agent hooks where available.
9. Verify repository state using Git.
10. Store structured project/session state in SQLite.
11. Store meaningful project decisions and rationale.
12. Store blockers and blocker resolution.
13. Store task completion and handoff information.
14. Detect obvious task/file overlap.
15. Generate relevant context for an active or newly started agent.
16. Expose project context to agents through MCP.
17. Provide a local CLI for inspection and debugging.

---

## 4. Non-Goals for MVP

The MVP will not require:

- remote collaboration between different computers,
- user accounts,
- team permissions,
- cloud hosting,
- a web dashboard,
- autonomous task assignment,
- autonomous conflict resolution,
- automatic worktree creation or management,
- support for many agent vendors,
- full terminal transcript capture,
- full conversation storage,
- a polished IDE extension.

---

## 5. Primary User

The primary user is a developer running multiple AI coding sessions locally on one software project.

Example:

```text
Developer

├── Codex Session A
│   └── Implement authentication
│
├── Claude Session B
│   └── Add authentication tests
│
└── Codex Session C
    └── Update API documentation
```

All sessions can communicate with the same local ContextMesh instance.

---

## 6. High-Level Architecture

```text
                    Developer Computer

        ┌───────────────────────────────────┐
        │                                   │
        │  Codex               Claude Code │
        │    │                      │       │
        │  Plugin / Hooks      Plugin / Hooks
        │    │                      │       │
        │    └──────────┬───────────┘       │
        │               ↓                   │
        │        Local API / MCP            │
        │               ↓                   │
        │      ┌─────────────────────┐      │
        │      │   ContextMesh Core  │      │
        │      │                     │      │
        │      │ Session Management  │      │
        │      │ Task State          │      │
        │      │ Event Processing    │      │
        │      │ Git Verification    │      │
        │      │ Conflict Detection  │      │
        │      │ Context Generation  │      │
        │      └──────────┬──────────┘      │
        │                 ↓                 │
        │               SQLite              │
        │                                   │
        │          ContextMesh CLI          │
        │                                   │
        └───────────────────────────────────┘
```

---

## 7. Technology Stack

### Core

- TypeScript
- Node.js
- Fastify

### Storage

- SQLite
- Drizzle ORM

### Validation

- Zod

### Repository Evidence

- Git CLI

### Agent Integration

- Model Context Protocol (MCP)
- Codex plugin/hooks
- Claude Code plugin/hooks

### Logging and Testing

- Pino
- Vitest

### Human Interface

- Local CLI

---

## 8. Core Design Principle

ContextMesh combines two different kinds of information.

### Agent-provided semantic information

Agents are good at reporting:

- task intent,
- expected files,
- rationale,
- decisions,
- blockers,
- completion summaries,
- next steps.

### Repository evidence

Git and ContextMesh are good at verifying:

- actual file changes,
- branch,
- worktree,
- commits,
- uncommitted changes,
- diffs,
- direct file overlap.

The system should combine both.

```text
Agent intent + Git evidence -> shared project context
```

Neither source should completely replace the other.

---

## 9. Meaningful Update Model

Agents should not constantly report their state.

Semantic reports should happen only at meaningful moments.

### Task started

Sent once the agent has enough understanding to describe what it is doing.

Example:

```json
{
  "task": "Implement backend authentication",
  "expectedFiles": [
    "src/auth.ts",
    "src/middleware/auth.ts"
  ]
}
```

### Task updated

Used when the agent's understanding or scope materially changes.

Example:

```json
{
  "previousTask": "Implement authentication",
  "task": "Implement backend authentication only",
  "reason": "Another session is implementing the frontend login flow."
}
```

### Decision recorded

Used only for meaningful decisions another agent may need later.

Example:

```json
{
  "decision": "Use JWT authentication instead of server-side sessions.",
  "reason": "The current API is stateless and the project already uses token-based clients."
}
```

### Blocker recorded

Example:

```json
{
  "blocker": "Cannot finish password reset until the email service interface is finalized."
}
```

### Task completed

The completion update should provide a useful handoff.

Example:

```json
{
  "summary": "Implemented backend authentication and JWT middleware.",
  "importantFiles": [
    "src/auth.ts",
    "src/middleware/auth.ts"
  ],
  "decisions": [
    "JWT expiration is one hour."
  ],
  "remainingIssues": [],
  "nextSteps": [
    "Frontend login can integrate with POST /api/login."
  ]
}
```

---

## 10. Session Model

Each connected coding session must have an independent identity.

Minimum session information:

- session ID,
- agent type,
- project ID,
- repository path,
- worktree path if applicable,
- branch if available,
- start time,
- last activity time,
- current status,
- current task.

Example statuses:

- `active`
- `idle`
- `ended`

A session ending does not automatically mean its task completed.

Task and session lifecycle are separate concepts.

---

## 11. Task Model

A task should include:

- task ID,
- session ID,
- title/summary,
- status,
- expected files,
- dependencies,
- start time,
- update time,
- completion time,
- completion summary,
- next steps.

Suggested task statuses:

- `active`
- `blocked`
- `completed`
- `cancelled`

Tasks must support updates.

---

## 12. Decision Model

A decision should include:

- decision ID,
- project ID,
- session ID that reported it,
- decision text,
- rationale,
- timestamp,
- optional related task,
- optional related files.

Decisions should represent project knowledge another session could reasonably need later.

---

## 13. Blocker Model

A blocker should include:

- blocker ID,
- project ID,
- session ID,
- task ID if applicable,
- description,
- status,
- created time,
- resolved time,
- resolution notes.

---

## 14. Event Model

ContextMesh should use a normalized event model internally.

Initial event types:

```text
session_started
session_ended

task_started
task_updated
task_completed

file_intent_declared
file_modified

decision_recorded

blocker_recorded
blocker_resolved

commit_created

warning_created
```

All incoming external events must be normalized before core processing.

Use Zod validation at the boundary.

Agent-specific raw events should not leak deeply into the core.

---

## 15. Event Flow

Example:

```text
Claude PostToolUse event
        ↓
Claude Adapter
        ↓
Normalized ContextMesh Event
        ↓
Zod validation
        ↓
Core event processor
        ↓
SQLite
        ↓
Git verification
        ↓
Derived project/session state
        ↓
Conflict / relevance checks
```

Codex should follow the same pattern.

---

## 16. Event History and Derived State

ContextMesh should preserve important structured events and derive current state from them.

Example event history:

```text
10:00 Session A started
10:01 Session A started "Authentication"
10:02 Session A declared auth.ts
10:04 Session A modified auth.ts
10:05 Session B started
10:06 Session B started "Password reset"
10:06 Session B declared auth.ts
10:06 overlap warning created
```

Current state may then be represented as:

```text
Session A
Task: Authentication
Status: Active

Session B
Task: Password reset
Status: Active

Warning
Both sessions are expected to modify auth.ts.
```

The implementation does not need full event sourcing, but event history should remain inspectable and useful.

---

## 17. Git Integration

Git provides repository evidence.

ContextMesh should use the Git CLI to inspect information such as:

- repository root,
- current branch,
- worktree identity,
- changed files,
- staged files,
- unstaged files,
- commits,
- diffs when needed.

The MVP should avoid expensive constant polling where possible.

Git checks can be triggered by meaningful hook activity and supplemented with lightweight fallback checks if needed.

---

## 18. File Activity and Overlap

Distinguish between:

### Expected file activity

The agent reports that it expects to work on a file.

### Observed file activity

Hooks and/or Git show that the file was actually modified.

This enables two warning levels.

Example:

```text
Potential overlap:
Two active tasks expect to modify auth.ts.
```

and:

```text
Confirmed direct overlap:
Two active sessions have changed auth.ts.
```

The MVP should keep overlap detection deterministic and understandable.

Do not begin with semantic AI-based conflict scoring.

---

## 19. Conflict / Warning Behavior

ContextMesh should warn about likely coordination risks.

Initial warning categories may include:

- same expected file,
- same modified file,
- obvious duplicate task,
- active dependency on changing work.

Warnings should explain:

- what was detected,
- which sessions/tasks are involved,
- which files are involved,
- why the warning exists.

Warnings do not block agents.

---

## 20. Context Generation

ContextMesh should not dump the entire project history into every agent.

It should return concise, relevant context.

A context response may include:

- active related tasks,
- recently completed related tasks,
- relevant changed files,
- important decisions,
- blockers,
- dependencies,
- warnings,
- next steps.

Example:

```text
ContextMesh Project Context

Active work:
- Claude session B is implementing authentication tests.

Recently completed:
- Codex session A completed backend authentication.

Important decisions:
- JWT authentication is being used.
- Auth middleware lives in src/middleware/auth.ts.

Relevant files:
- src/auth.ts
- src/middleware/auth.ts

Warning:
- auth.ts has uncommitted changes from another active session.
```

---

## 21. Agent Startup Behavior

When a supported agent session begins:

1. Register the session with ContextMesh.
2. Identify the project/repository.
3. Retrieve a small amount of relevant project context.
4. Make that context available to the agent.
5. Allow the agent to request deeper context through MCP.

The startup context should be useful but concise.

---

## 22. Agent Task Behavior

Once the agent understands the user's request:

1. Report its task.
2. Report expected files when reasonably known.
3. Receive any immediate overlap/relevance warnings.
4. Continue working.
5. Update the task if scope materially changes.

The agent should not need to report after every minor step.

---

## 23. Completion Behavior

When meaningful work is completed:

1. Report task completion.
2. Provide a short summary.
3. Record important decisions.
4. Record remaining blockers if any.
5. Record next steps.
6. Associate relevant Git/commit evidence where available.

The resulting state should help the next agent continue.

---

## 24. MCP Interface

MCP is an agent-facing interface to the ContextMesh core.

Initial candidate tools:

```text
get_project_context
get_active_sessions
get_conflicts

report_task
update_task
complete_task

record_decision

record_blocker
resolve_blocker
```

Exact schemas should be defined before implementation.

MCP should expose purposeful operations rather than raw database access.

---

## 25. Local API

Fastify provides a lightweight local API for hooks/adapters and other local clients.

Responsibilities may include:

- event ingestion,
- session registration,
- health checks,
- internal inspection endpoints,
- plugin communication.

The API should be local-only by default.

---

## 26. CLI

The CLI is the MVP inspection/debugging interface.

Initial command set:

```text
contextmesh start
contextmesh status
contextmesh sessions
contextmesh conflicts
contextmesh history
contextmesh doctor
```

Possible behavior:

### `contextmesh status`

Shows:

- current project,
- service status,
- active session count,
- current warnings.

### `contextmesh sessions`

Shows:

- session ID,
- agent type,
- task,
- status,
- files.

### `contextmesh conflicts`

Shows active warnings.

### `contextmesh history`

Shows recent meaningful events.

### `contextmesh doctor`

Checks configuration, Git access, database access, and plugin connectivity.

---

## 27. Database

Use SQLite.

Drizzle ORM should manage schema access and migrations.

Likely tables:

```text
projects
sessions
tasks
events
file_activity
decisions
blockers
warnings
commits
```

A `worktrees` table may be useful if the design benefits from explicit worktree entities.

Schema design should favor clear relationships and easy querying over premature optimization.

---

## 28. Logging

Use Pino structured logs.

Logs should include enough information to trace:

- incoming events,
- adapter normalization,
- validation failures,
- state changes,
- Git checks,
- generated warnings,
- MCP calls,
- service errors.

Do not store secrets or large terminal transcripts.

---

## 29. Privacy and Security

MVP principles:

- local-first,
- no cloud dependency required,
- no full terminal transcript storage,
- no full conversation storage,
- avoid secret collection,
- local interfaces bound to loopback by default where possible,
- validate all incoming external data.

---

## 30. Codex Integration

The Codex integration should:

- register sessions,
- capture supported lifecycle/tool signals,
- normalize Codex-specific events,
- pass events to the ContextMesh core,
- retrieve relevant context,
- allow reporting of task/decision/blocker/completion state.

Keep Codex-specific logic isolated inside its adapter/plugin layer.

---

## 31. Claude Code Integration

The Claude Code integration should provide equivalent functionality:

- register sessions,
- capture supported lifecycle/tool signals,
- normalize Claude-specific events,
- pass them to the ContextMesh core,
- retrieve relevant context,
- allow meaningful semantic reporting.

Claude-specific formats should not alter the core data model unless there is a genuine product requirement.

---

## 32. MVP Acceptance Scenario

The system should be able to demonstrate this end-to-end workflow:

```text
1. ContextMesh starts locally.

2. Codex Session A connects.

3. Session A reports:
   "Implement authentication."

4. ContextMesh stores the task.

5. Session A reports/uses auth.ts.

6. Git verifies that auth.ts changed.

7. Claude Session B connects.

8. Claude receives context:
   "Codex A is implementing authentication
    and has modified auth.ts."

9. Claude reports:
   "Implement password reset."
   Expected file: auth.ts.

10. ContextMesh detects overlap.

11. Claude receives a warning.

12. Codex completes authentication and reports:
    summary,
    decisions,
    next steps.

13. A later session starts.

14. The later session receives the relevant
    completed-work context and can continue
    without the developer manually explaining it.
```

If this scenario works reliably, the core MVP concept is demonstrated.

---

## 33. Testing Strategy

### Unit tests

Test:

- Zod schemas,
- state transitions,
- warning rules,
- context filtering,
- task updates,
- decision/blocker logic.

### Integration tests

Test:

- Fastify -> event processor -> SQLite,
- adapter -> normalized event,
- Git fixture repository -> detected changes,
- MCP tool -> core service -> response.

### End-to-end tests

Use mock sessions first.

Then validate with:

1. Codex + ContextMesh
2. Claude + ContextMesh
3. Codex + Claude simultaneously

---

## 34. Recommended Implementation Order

### Phase 1 — Foundation

- repository structure,
- TypeScript configuration,
- lint/typecheck/test setup,
- core domain types,
- Zod schemas,
- SQLite/Drizzle setup.

### Phase 2 — Core State

- projects,
- sessions,
- tasks,
- events,
- decisions,
- blockers,
- warnings.

### Phase 3 — Mock Integration

- fake agent adapter,
- event ingestion,
- state updates,
- CLI inspection.

### Phase 4 — Git

- repository detection,
- file change verification,
- branch/worktree detection,
- overlap detection.

### Phase 5 — Context

- relevance rules,
- context generation,
- startup context,
- completion handoff context.

### Phase 6 — MCP

- project context tools,
- task reporting,
- task update,
- decisions,
- blockers,
- completion.

### Phase 7 — Codex

- plugin/hooks,
- session registration,
- event normalization,
- context retrieval.

### Phase 8 — Claude Code

- equivalent Claude adapter/plugin.

### Phase 9 — Hardening

- failure handling,
- duplicate events,
- logging,
- installation,
- docs,
- integration testing.

---

## 35. Stretch Goals

### High-priority stretch goals

- easier installation and setup,
- one-command initialization,
- polished Codex/Claude plugin installation,
- automatic safe context injection,
- improved context relevance,
- better handoff summaries,
- VS Code extension/sidebar.

### Additional stretch goals

- additional agent integrations,
- advanced dependency graphs,
- semantic change-risk analysis,
- automatic worktree support,
- richer visualization,
- remote/multi-computer collaboration,
- team workspaces and permissions.

---

## 36. Explicitly Deferred

Do not spend MVP time on:

- React dashboard,
- SaaS accounts,
- authentication,
- cloud database,
- hosted backend,
- remote synchronization,
- autonomous multi-agent planning,
- autonomous task assignment,
- marketplace-polished IDE UI.

---

## 37. Source of Truth

For development:

1. `ContextMesh_SPEC.md` defines product behavior and architecture.
2. `AGENTS.md` defines how coding agents should work in this repository.
3. Code and tests define implemented behavior.
4. Important architectural changes should be reflected in the spec.

When a major design decision changes, update the documentation deliberately rather than allowing the implementation and spec to drift apart.

---

## 38. Guiding Principle

ContextMesh succeeds if one developer can run multiple AI coding sessions while spending less time manually explaining:

- what is being worked on,
- what changed,
- why it changed,
- what another agent needs to know,
- and where the next session should continue.

The MVP should stay focused on that problem.

---

## 39. Durable Memory Contract

The MVP stores durable project knowledge as versioned memories. Memory kinds
include decisions, progress checkpoints, completion handoffs, blocker
resolutions, and project facts.

Each memory version records its project/repository scope, source session,
content, creation time, and the version it supersedes. Updating a memory adds
a new version; it does not overwrite or destroy the prior version. Deleted or
superseded records are excluded from normal retrieval but remain inspectable
through history and export operations.

SQLite FTS5 is a retrieval index over searchable current memory versions. It is
not the source of truth and must not be used to reconstruct history.

## 40. Boundary and Idempotency Contract

HTTP, MCP, CLI, and adapter inputs use the same validated application
contracts. None of these interfaces may access Drizzle repositories directly.
They call application services that own coordination behavior.

Incoming events are idempotent by source event identity when the host provides
one. Duplicate or delayed delivery must not create duplicate sessions, tasks,
memory versions, or warnings. Every accepted event remains inspectable in
event history.

Agent reports describe intent. Git inspection supplies evidence for changed
files, branches, worktrees, commits, and diffs. The system must distinguish
expected files from observed modifications and must not treat an agent claim as
proof of a repository change.

## 41. Target Local API Contract

The local Fastify service binds to loopback by default and initially exposes:

```text
GET    /health
GET    /v1/status
POST   /v1/events
GET    /v1/context
GET    /v1/sessions
GET    /v1/warnings
GET    /v1/memories
GET    /v1/memories/:id
PATCH  /v1/memories/:id
DELETE /v1/memories/:id
GET    /v1/memories/export
```

Request bodies, query parameters, and tool inputs are validated with Zod.
Errors use a consistent structured JSON shape and never expose stack traces or
secrets.

The current foundation implements only `/health`, `/v1/status`, and
`POST /v1/events`. The remaining routes are target MVP contracts and must be
added as storage-backed application services are implemented.

## 42. MCP Contract

MCP is a thin agent-facing interface over the application services. Initial
tools are:

```text
get_project_context
get_active_sessions
get_conflicts
report_task
update_task
complete_task
record_decision
record_blocker
resolve_blocker
save_progress_checkpoint
```

MCP must not expose raw database operations. The same schemas and semantics
apply whether an operation arrives through MCP, HTTP, or a host adapter.

The current foundation implements `get_project_context` and `report_task`
against the in-memory processor. The remaining tools are target MVP contracts.

## 43. Adapter Capability Contract

Adapters must report their supported capabilities rather than pretending the
hosts are equivalent. Claude Code may use documented session, tool, stop, and
HTTP hook surfaces. Codex begins with explicit MCP reporting and context
retrieval until an automatic lifecycle surface is verified.

When ContextMesh is unavailable, adapter delivery failures are logged and
reported diagnostically but must not block the host agent's work.

## 44. Implementation Source of Truth

The repository uses these ownership boundaries:

1. `ContextMesh_SPEC.md` defines product behavior and architectural constraints.
2. `PLAN.md` defines implementation sequencing and verification gates.
3. `AGENTS.md` and scoped agent files define collaboration and code-quality
   rules.
4. Code and tests define implemented behavior.
5. Important architectural changes update the specification deliberately.
