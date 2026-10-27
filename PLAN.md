# Codex-only demo MVP plan

Product scope is defined by ContextMesh_SPEC.md: multiple Codex sessions;
Claude Code and OpenCode are stretch goals. Preserve the vendor-independent core
and existing disabled experimental adapters. The earlier SQLite integration is
already merged into main at 9c49566; no additional merge is a release gate.

## Delivery and verification

1. Fix Node reporter dependence: explicitly select TAP for independent fixture
   tests. Give the process-heavy connection acceptance test a bounded 20s budget.
2. Demonstrate a playable Snake game: A owns snake.js; B owns browser controls
   and tests, with intentional initial overlap and a real scope update.
3. Verify context receipts, blocker/resolution, decision rationale, both handoffs
   and session endings through public HTTP/MCP/CLI contracts.
4. Independently verify game behavior and executable browser controls, restart
   the actual service, recover both handoffs and reject replay duplication.
5. Provide one-command live launching, separate-terminal mode, clearly labeled
   simulation/operator fallback, a loopback preview and saved presentation notes.
6. Run typecheck, build, all deterministic tests, source/compiled rehearsal, a
   native two-Codex run and browser QA. Record actual results in verification.md.
7. Commit and push the reviewed result to the user-requested MVP branch.

## Architecture boundaries

One local Fastify process owns application coordination and SQLite writes.
Transports/adapters use validated application contracts; Git supplies evidence.
Memory versions and history remain immutable; FTS indexes current records.
Warnings inform agents, never prevent edits. Session end never completes a task.
The demo harness launches developer-selected tasks in disposable repositories;
it is not part of the service's task-assignment behavior. No live model output,
conversation or full tool payload is retained by demo receipts.

## Deferred

Claude Code/OpenCode acceptance and activation; optional host hook compatibility;
packaging/installer polish; richer relevance; confirmed per-session authorship;
dashboards, cloud sync, autonomous planning and worktree management. None is
needed to present the explicit-MCP Codex demo. Do not infer authorship from a
shared dirty worktree or call a simulated/operator-edit run native coding.
