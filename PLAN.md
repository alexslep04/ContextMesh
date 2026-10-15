# ContextMesh Implementation Plan

## Goal

Give one developer a reliable local shared memory and coordination layer for
multiple Codex and Claude Code sessions without turning ContextMesh into an
autonomous orchestrator or a transcript archive.

## Current Slice

This initial repository slice establishes the contracts and boundaries needed
for vertical implementation:

- TypeScript and Node.js project configuration.
- Zod-validated normalized events.
- A restart-safe SQLite event processor for deterministic mock-session behavior.
- Fastify health and event-ingestion routes.
- SQLite/Drizzle schema and FTS5 migration boundary.
- Commander CLI boundary.
- MCP server and tool boundary.
- Common, Claude Code, and Codex adapter boundaries.
- Scoped `AGENTS.md` instructions.

The current persistence adapter uses isolated `cm_*` tables so it does not
collide with the separately introduced generic SQL schema under
`src/database/schema.sql`. A later migration will reconcile those schemas while
keeping the event and application contracts stable.

## Architecture Decisions

1. Keep one npm package until independent publishing is justified.
2. Keep the core vendor-independent; adapters normalize host events at the edge.
3. Use append-only event history plus derived operational state.
4. Store durable decisions, progress, handoffs, and blocker resolutions as
   versioned memories. Use SQLite FTS5 as an index over current searchable
   versions.
5. Use `better-sqlite3` with Drizzle for the local synchronous SQLite driver.
6. Make event ingestion idempotent by source event identity.
7. Bind local HTTP services to loopback by default.
8. Keep MCP, HTTP, and CLI as thin interfaces over application services.
9. Detect host adapter capabilities instead of inventing unsupported hooks.
10. Generate deterministic overlap warnings from expected and observed files;
    defer semantic conflict prediction.

## Delivery Units

### U1. Foundation

Project configuration, scripts, logging, configuration loading, and scoped
agent instructions.

### U2. Domain Contracts

Sessions, tasks, events, memories, scopes, warnings, and Zod boundary schemas.

### U3. Persistence

Drizzle schema, migrations, SQLite FTS5 index, repositories, transactions, and
optimistic revision handling.

### U4. Event Processing

Idempotent event processing, task/session projections, file activity, and
deterministic overlap warnings.

### U5. Repository Evidence

Safe Git CLI integration for repository, branch, worktree, commit, and changed
file evidence.

### U6. Context and Memories

Versioned memory lifecycle, FTS5 search, scoped relevance ranking, supersession,
export, deletion, and budgeted context generation.

### U7. Local API and CLI

Fastify routes, structured errors, Commander inspection commands, diagnostics,
and local service startup.

### U8. MCP

MCP TypeScript SDK server and purposeful tools for context, tasks, decisions,
blockers, checkpoints, and completion handoffs.

### U9. Adapters

Common adapter interface, Claude Code hook integration, Codex capability-aware
integration, and failure-isolated event delivery.

### U10. End-to-End Hardening

Mock-session acceptance flow, duplicate-event tests, service-unavailable tests,
documentation, and packaging/install checks.

## Repository Shape

```text
src/
  application/       use cases and coordination logic
  adapters/          Claude Code, Codex, and common adapter contracts
  cli/               Commander entry point and commands
  domain/            vendor-independent types and Zod schemas
  infrastructure/    Git and logging integrations
  storage/           Drizzle schema, migrations, and repositories
  transport/         Fastify HTTP and MCP interfaces
tests/               deterministic unit, integration, and fixture tests
docs/                architecture and integration documentation
```

## Verification Contract

Every behavior-bearing unit must have deterministic Vitest coverage. The
repository is ready for the next implementation phase when:

- `npm run typecheck` passes.
- `npm test` passes.
- HTTP, MCP, storage, Git, and adapter seams have integration coverage.
- Replayed events do not duplicate state.
- Context output respects a caller budget and excludes superseded records.
- The documented mock-session overlap scenario passes end to end.
- No full transcripts, conversations, secrets, cloud dependencies, or remote
  synchronization are introduced.

## Deferred Work

- Automatic worktree creation or management.
- Embedding-based or model-based retrieval ranking.
- Semantic conflict prediction.
- Dashboard, IDE extension, accounts, and cloud synchronization.
- Codex hooks that are not confirmed by the host's supported integration API.
