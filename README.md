# ContextMesh

ContextMesh is a local coordination layer for developers running multiple AI
coding agents on the same project.

It allows agents such as Codex and Claude Code to share relevant project context, including:

- active tasks
- recently completed work
- important project decisions
- blockers and next steps
- expected and changed files
- possible task or file overlap

ContextMesh is local-first and is intended to help one developer run multiple AI coding sessions without manually copying context between them.

## Overview

Each coding agent has its own context window. Without a shared coordination
layer, agents can duplicate work, edit the same files, miss important project
decisions, or lose the reasoning needed to continue a completed task.

ContextMesh gives those sessions a shared, structured project memory. Agents
report meaningful intent such as tasks, decisions, blockers, and handoffs.
ContextMesh combines that intent with repository evidence from Git, then makes
the relevant context available through MCP, a local API, and a CLI.

```text
Codex / Claude Code
        |
        v
  Host adapters and MCP
        |
        v
  Local ContextMesh service
      |             |
      v             v
 SQLite + FTS5    Git evidence
        |
        v
 Relevant context, history, and overlap warnings
```

ContextMesh warns about coordination risks but does not block edits, assign
tasks, cancel agents, or resolve conflicts autonomously. The developer stays
in control.

## Example Workflow

1. Codex Session A starts an authentication task and declares `src/auth.ts`.
2. ContextMesh records the session and task.
3. Git or a supported hook reports that `src/auth.ts` changed.
4. Claude Code Session B starts a password-reset task involving the same file.
5. ContextMesh returns the relevant prior work and emits a deterministic
   overlap warning.
6. Session A completes its task with a summary, decisions, blockers, and next
   steps.
7. A later session retrieves the handoff without the developer reconstructing
   the previous conversation.

## Project Status

The repository is in foundation development. The current slice establishes the
normalized event contract, an in-memory event processor, the local Fastify
boundary, SQLite/Drizzle schema boundaries, MCP tool boundaries, and a CLI
entry point. Persistent projections, Git verification, and host adapters are
the next implementation slices.

## Documentation

- `ContextMesh_SPEC.md` — product and technical specification
- `AGENTS.md` — instructions for AI coding agents working in this repository
- `PLAN.md` — implementation roadmap and definition of done
- `docs/` — focused architecture and integration notes

## Planned MVP

- Local ContextMesh service
- Codex integration
- Claude Code integration
- Shared task and session state
- Git-based file verification
- Conflict/overlap warnings
- MCP context access
- CLI inspection tools

## Technology

- TypeScript and Node.js
- Fastify local HTTP service
- SQLite with Drizzle ORM and FTS5
- Zod boundary validation
- Git CLI repository evidence
- MCP TypeScript SDK
- Commander.js CLI
- Pino structured logging
- Vitest tests

## Development

Prerequisites:

- Node.js 22 or newer
- npm 10 or newer
- Git on `PATH`

Install dependencies and run the checks:

```bash
npm install
npm run typecheck
npm test
```

Start the local service:

```bash
npm run dev
```

The service binds to `127.0.0.1:4317` by default. The CLI entry point is
available through `npm run cli -- <command>` while the package is being
developed.

Initial inspection commands:

```bash
contextmesh status
contextmesh sessions
contextmesh conflicts
contextmesh history
contextmesh doctor
```

During local development, invoke the CLI through npm:

```bash
npm run cli -- status
```

The current CLI and MCP surfaces are foundation scaffolding. Persistent
storage-backed inspection and complete host integrations are implemented in
the planned vertical slices rather than assumed by the skeleton.

## Repository Layout

```text
src/domain/           vendor-independent events and entities
src/application/      coordination and state-processing services
src/storage/          Drizzle schema, migrations, and SQLite boundaries
src/transport/        Fastify HTTP and MCP interfaces
src/adapters/         Claude Code, Codex, and common adapter contracts
src/cli/              Commander entry point
tests/                deterministic unit and integration tests
docs/                 architecture and integration notes
```

## MVP Acceptance Slice

The first vertical slice supports a mock session starting, reporting a task,
declaring an expected file, and producing a deterministic overlap warning when
another active task declares the same file. Later slices add Git evidence,
durable memories, MCP transport, and real host adapters without changing the
normalized core event contract.

## Project Principles

- Agents report meaning; Git reports repository evidence.
- Durable memories are versioned and searchable, not silently overwritten.
- External events are validated and processed idempotently where identities are
  available.
- Adapters remain isolated from vendor-independent coordination logic.
- Context is compact, scoped, and budgeted rather than a full transcript dump.
- Local services bind to loopback by default.

## Contributing With Agents

Read `AGENTS.md` and `PLAN.md` before making substantial changes. The root
instructions define project-wide boundaries; scoped `AGENTS.md` files add rules
for domain, storage, transport, adapters, tests, and documentation. Update
tests and relevant documentation whenever a public schema, command, route, or
adapter capability changes.
