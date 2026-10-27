# Codex-only MVP status: October 27, 2026

The demo MVP supports two independent Codex sessions. Claude Code and OpenCode
are stretch goals, not release gates. Existing experimental Claude support
remains isolated and disabled. The teammate SQLite integration is already
merged into main at 9c49566; older notes about an unmerged integration are obsolete.

## Implemented and verified

- Loopback Fastify service with one SQLite owner, migrations/Drizzle, persistent
  events, transactional projections and immutable memory versions/FTS search.
- Validated session/task lifecycle, expected files, scope changes, project and
  ownership boundaries, meaningful progress, decisions/rationale, blockers and
  durable completion handoffs.
- Git worktree/branch/HEAD/change evidence, distinct from agent claims.
- Explained expected-file overlap cleared by scope/lifecycle changes.
- Shared HTTP/MCP/CLI services, bounded context/provenance, duplicate protection,
  version-aware memory edits/deletions and inspectable history/export.
- Managed ordinary-project Codex startup/context/cleanup and explicit recovery.
- Playable Snake demo: A implements rules; B reads A's context, receives overlap,
  narrows to browser/tests, consumes the handoff and completes the game.
- Independent game tests and browser-control smoke checks, actual service
  restart, fresh MCP handoff retrieval, replay and CLI consistency checks.
- One-command automatic live launch, optional separate visible terminals,
  Windows desktop-bundled CLI discovery, local game preview and saved evidence.

A real native two-Codex Snake run, pair-PhypjH, passed all eight checkpoints in
184 seconds with operatorEdit:false; compiled run pair-0FlJy1 repeated all
eight checks in 213 seconds. All 62 tests pass. The browser was exercised for Start,
keyboard steering, score, game-over, Pause and Restart. Automated source/compiled
rehearsals pass. See verification.md for exact final checks and further runs.

## Limits

Meaningful reporting depends on the models following their instructions.
Forced kills/outages can require explicit session cleanup; offline reports are
not queued. Git dirtiness does not prove per-session authorship, and the warning
is expected-file overlap rather than semantic conflict detection. Optional host
hooks are fixture-tested and not required by the explicit-MCP demo baseline.
Live model runtime is variable; retain a clearly labeled saved game/rehearsal
as presentation backup. No dashboard/cloud/orchestration work is needed.

See [the runbook](demo.md), [Codex setup](codex.md), and
[verification](verification.md).
