# ContextMesh

ContextMesh is a local shared memory and coordination service for developers
running multiple coding agents on the same project. Agents report meaningful
work; Git supplies repository evidence; ContextMesh returns relevant context,
overlap warnings, decisions, and handoffs. The developer stays in control.

## Current implementation

The demo slice implements:

- One local HTTP service owning SQLite state; MCP and CLI use that service.
- Validated session/task lifecycle, updates, request identities, project
  isolation, and persistent event history.
- Expected-file overlap warnings with session/task/file explanations.
- Decisions, checkpoints, blockers/resolutions, and completion handoffs.
- Immutable memory versions and transactional FTS5 current-version indexing.
- Git worktree/branch/HEAD and staged/unstaged/untracked evidence.
- Deterministic project context with a serialized character budget.
- Purposeful MCP tools, CLI inspection, and unavailable-service diagnostics.
- Simulated and live-agent-plus-simulated-peer demo modes, including a real
  service process restart, replay checks, and preserved evidence artifacts.
- Two independent Codex sessions: shared context, overlap acknowledgment, task
  narrowing, dependency blocker/resolution, both completion handoffs and session
  endings. The harness independently executes the fixture tests.
- Reusable `connect codex` setup for ordinary Git projects with unique session
  identities and generated launch scripts; no global config changes.

Managed Codex launchers register/end sessions, supply startup context and refresh
Git. Optional host hooks are implemented and fixture-tested. Claude setup is
disabled by default pending live verification. Version-checked memory revision,
deletion with preserved history, and current-only search are available through
HTTP/MCP/CLI. File activity reports remain claims; Git evidence does not
automatically attribute shared-worktree changes to individual sessions.

## Run locally

Requires Node.js 22.18+, npm, and Git on PATH.

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run dev
```

Defaults: `127.0.0.1:4317`, `.contextmesh/contextmesh.db`. Startup runs versioned
migrations, preserves existing `cm_*` data, and prevents a second service from
owning the database. Configuration uses environment variables documented in
`.env.example`; the application does not automatically load `.env` files.

In another terminal:

```sh
npm run cli -- doctor
npm run cli -- status
npm run cli -- sessions --project my-project
npm run cli -- conflicts --project my-project
npm run cli -- context --project my-project --file src/auth.ts
npm run cli -- history --project my-project --json
```

Launch `npm run mcp` from an MCP-capable host while the service runs. Register a
session before reporting tasks. Mutations require `requestId`; reuse it for an
exact retry and use a new ID for new work.

## Rehearse the demo

```sh
npm run demo -- --two-simulated
npm run demo -- --two-live
```

Two-live mode prints separate commands for Codex A and Codex B. Run them in
two other terminals while the harness stays running. A implements a fixture;
B retrieves its context, deliberately reports an overlapping initial scope,
narrows to tests, and uses A's completion handoff. Eight checkpoints verify the
workflow, test execution, restart retrieval and replay protection. On a host
with restricted file execution, use `--two-live --operator-edit`: both agents
are live, while the harness makes and labels the two fixture edits.

The original rehearsal modes remain available:

```sh
npm run demo
npm run demo -- --live
```

Default mode clearly labels both sessions as simulated while exercising real
HTTP, stdio MCP, Git, CLI, SQLite, and restart recovery. Live mode prints a
PowerShell command that starts Codex with the demo MCP connection. For a host
that cannot edit files, use the explicit operator-edit variant:

```sh
npm run demo -- --live --operator-edit
```

The operator edit is labeled and never attributed to the agent. Demo modes use
disposable fixtures/databases under `.contextmesh/demos/`; they never reset the
developer's repository or database. See [the runbook](docs/demo.md).

## Use Codex on your own project

Keep `npm run dev` running, then prepare a session from the ContextMesh checkout:

```sh
npm run cli -- connect codex --project my-project --repo C:/path/to/project --task "Implement the API change"
npm run cli -- connect codex --project my-project --repo C:/path/to/project --task "Add tests for the API change"
```

Run each printed launch command in its own terminal. Both use the same project
ID and independent generated session IDs. The launcher handles lifecycle and
startup context; the prompts guide meaningful MCP reporting. Add `--hooks` to
opt in to documented lifecycle/tool hooks, subject to normal host trust and
version support. Review the tasks and normal Codex permissions before running. See
[Codex setup](docs/codex.md) for prerequisites and limitations.

Claude connection files can be prepared without installing Claude:

```sh
npm run cli -- connect claude --project my-project --repo C:/path/to/project --task "Test the API change"
```

They remain disabled until a teammate prepares them with
`--enable-experimental-claude`. See [Claude validation](docs/claude-validation.md).

## Architecture and documentation

```text
Live agent / simulated peer       Human CLI
           |                         |
      MCP stdio bridge               |
           +-------- local API ------+
                         |
                 application services
                    /           \
             SQLite + FTS5     Git CLI
```

- [Specification](ContextMesh_SPEC.md): product contracts and MVP scope.
- [Plan](PLAN.md): execution stages and verification gates.
- [Agent guidance](AGENTS.md): repository and scoped development rules.
- [Architecture](docs/architecture.md), [persistence](docs/persistence.md),
  [MCP](docs/mcp.md), [adapters](docs/adapters.md), [demo](docs/demo.md).
- [Codex setup](docs/codex.md) and [MVP status](docs/mvp-status.md).
