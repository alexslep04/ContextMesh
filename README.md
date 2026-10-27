# ContextMesh

ContextMesh gives independent Codex sessions shared project context, explained
file-overlap warnings, decisions and durable completion handoffs. It runs locally
with Fastify, SQLite/Drizzle and Git. The developer stays in control.

**MVP: multiple Codex sessions. Claude Code and OpenCode are stretch goals.**
No dashboard, cloud backend, automatic task assignment or worktree management
is needed. Existing experimental Claude support stays disabled by default.

## Start with the Snake demo

Requires Node 22.18+, npm and Git. Live mode also needs an authenticated Codex CLI.

```powershell
npm ci
npm run typecheck
npm run build
npm test
npm run demo:live
```

`demo:live` checks login, starts an isolated ContextMesh service, launches two
independent Codex processes and prints eight verified coordination checkpoints.
A implements Snake rules; B encounters an intentional file-overlap warning,
narrows to browser/tests, retrieves A's handoff and builds the playable game.
The harness independently tests the game, restarts the real service and checks
saved handoffs/replay protection. It then prints a loopback browser URL. Open it,
click Start, play with arrows/WASD, and show Pause/Restart. Ctrl+C stops preview.

Only meaningful reports and provenance receipts are retained; conversations and
model output are not captured. Live runtime varies; rehearse before presenting.
The harness supplies developer-selected tasks, not autonomous core assignment.

Without model usage:

```powershell
npm run demo -- --serve
```

This is clearly labeled simulated, with real HTTP/MCP/Git/SQLite processes.
For separate visible agent terminals, use `npm run demo -- --two-live`, then run
the two printed launch commands. See [demo instructions](docs/demo.md) for the
few-minute presentation and recovery steps, and [Codex setup](docs/codex.md) if
you currently use the desktop app only.

Every run preserves a fresh fixture and database under `.contextmesh/demos/`.
It never resets your ordinary checkout/database. Replay a saved game with:

```powershell
npm run demo:play -- '<demo-directory printed by the harness>'
```

## Use ContextMesh on your project

Start the local service in one terminal:

```powershell
npm run dev
```

Prepare each Codex session from the ContextMesh checkout, then run its printed
launch command in a separate terminal:

```powershell
npm run cli -- connect codex --project my-project --repo 'C:\path\to\project' --task 'Implement the API change'
npm run cli -- connect codex --project my-project --repo 'C:\path\to\project' --task 'Add tests for the API change'
```

These share a project ID and have independent session IDs. Managed launchers
register/end sessions, inject startup context and refresh Git. Codex reports
meaningful task/decision/blocker/completion changes through MCP. Global host
configuration and credentials are left alone; normal host policy still applies.

Inspect with `npm run cli -- doctor`, `status`, `sessions --project my-project`,
`tasks`, `conflicts`, `context`, `history`, and `memories` (same project option).
Defaults: `127.0.0.1:4317`, `.contextmesh/contextmesh.db`. Environment variables
are in `.env.example`; `.env` is not automatically loaded.

## Implemented behavior and limits

- One service owns SQLite; HTTP/MCP/CLI share validated application contracts.
- Independent session/task lifecycle, scope updates, ownership/project isolation,
  idempotent request identities and persistent event history.
- Deterministic expected-file overlap, cleared when scope/lifecycle changes.
- Git worktree/branch/HEAD and staged/unstaged/untracked evidence.
- Versioned decisions, checkpoints, blockers/resolutions and handoffs; memory
  revision/deletion preserves history and current-only FTS5 search.
- Bounded relevant context with provenance and explicit truncation.
- Forced termination/outages can require manual session recovery. Offline
  delivery is not queued. Shared dirty files do not prove session authorship.

[Specification](ContextMesh_SPEC.md) · [Plan](PLAN.md) ·
[MVP status](docs/mvp-status.md) · [Verification](docs/verification.md) ·
[Architecture](docs/architecture.md) · [MCP](docs/mcp.md)
