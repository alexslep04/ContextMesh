# ContextMesh

ContextMesh is a local coordination layer for developers running multiple AI coding agents on the same project.

It allows agents such as Codex and Claude Code to share relevant project context, including:

- active tasks
- recently completed work
- important project decisions
- blockers and next steps
- expected and changed files
- possible task or file overlap

ContextMesh is local-first and is intended to help one developer run multiple AI coding sessions without manually copying context between them.

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

## Development

Prerequisites:

- Node.js 22 or newer
- npm 10 or newer
- Git on `PATH`

Install dependencies and run the checks:

```text
npm install
npm run typecheck
npm test
```

Start the local service:

```text
npm run dev
```

The service binds to `127.0.0.1:4317` by default. The CLI entry point is
available through `npm run cli -- <command>` while the package is being
developed.

Initial inspection commands:

```text
contextmesh status
contextmesh sessions
contextmesh conflicts
contextmesh history
contextmesh doctor
```

## MVP Acceptance Slice

The first vertical slice supports a mock session starting, reporting a task,
declaring an expected file, and producing a deterministic overlap warning when
another active task declares the same file. Later slices add Git evidence,
durable memories, MCP transport, and real host adapters without changing the
normalized core event contract.
