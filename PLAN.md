# ContextMesh Implementation Plan

## Goal

Give one developer a reliable local shared memory and coordination layer for
multiple Codex and Claude Code sessions without turning ContextMesh into an
autonomous orchestrator or a transcript archive.

## Current Slice

The working demo slice now includes one local service authority; versioned
SQLite migrations and atomic Drizzle persistence; validated session/task
lifecycle; decisions, checkpoints, blockers/resolutions and handoffs; Git
evidence; deterministic budgeted context; shared HTTP/MCP/CLI interfaces; and
simulated/live demo tooling with real process restart and replay verification.

The unused generic schema remains isolated. Managed Codex lifecycle/startup
context, optional documented hooks, memory PATCH/DELETE/search and disabled
Claude integration are implemented. Native two-Codex coding passed after fixing
Windows configuration preservation. Remaining release gates are live
hooks/Claude/mixed-vendor checks and team review.
See `docs/demo.md` and `docs/claude-validation.md` for runbooks.

## Active Delivery: Finish Locally, Hand Off Live Claude Verification

- [x] Version-checked memory revision/deletion, preserved tombstones/history,
  current-only FTS search and shared HTTP/MCP/CLI interfaces.
- [x] Managed Codex registration, bounded startup context, Git refresh and
  cleanup on process exit; CLI recovery without completing unfinished tasks.
- [x] Actual managed Codex MCP-only rehearsal passed (`managed-kJTQj8`).
- [x] Documented Codex/Claude hook adapters, advisory runner, bounded input,
  duplicate protection, resume handling and no transcript capture.
- [x] Claude connection preparation works without a Claude installation and
  defaults disabled; activation requires `--enable-experimental-claude`.
- [x] Fixture/integration tests for hooks, failure behavior, managed launch,
  memory lifecycle/search/restart and CLI recovery.
- [x] Native Codex edit attempt reproduced the host restriction (`pair-nsqdRe`);
  blocker recorded honestly and the rehearsal stopped without file changes.
- [x] Native two-Codex code/test acceptance passed (`pair-t1QQA9`), eight checks,
  actual agent-authored files and independent fixture tests. The native launcher
  now preserves the user's normal Windows sandbox configuration.
- [ ] Teammate live Claude/mixed-vendor/hook compatibility acceptance.
- [ ] Team review, reconciliation of the unseen teammate SQLite changes and
  commit/merge of the reviewed local delivery.

Do not enable Claude by default or label the original specification fully
verified until those external gates pass. Follow `docs/claude-validation.md`.
The stage history below records the earlier implementation sequence.

## Active Milestone: Two Codex Sessions

The team now prioritizes two live Codex sessions rather than adding Claude for
Thursday. This supersedes the one-live/simulated-peer delivery target below;
the original D1-D6 work is retained as the completed foundation and fallback.
Full Codex + Claude support remains the product goal.

- [x] Independent Codex identities and MCP connections on one shared project.
- [x] B retrieves A's task and evidence, receives overlap, updates its scope and
  verifies that the warning clears.
- [x] Dependency blocker/resolution and handoff consumption by B before it
  completes; both sessions end explicitly.
- [x] Independent fixture-test/contract checks, service restart, both handoffs,
  replay protection, CLI consistency and structured provenance receipts.
- [x] Deterministic two-peer rehearsal using real MCP processes.
- [x] `connect codex` setup for an ordinary Git project, with unique identities,
  generated scripts and explicit coordination instructions.
- [x] First two-live Codex rehearsal passed with labeled operator edits.
- [x] Compiled two-peer rehearsal and repeated two-live acceptance passed.
- [x] Native agent-authored implementation/tests verified in `pair-t1QQA9`.

### MVP assessment and next stages

The implemented core covers the central two-session awareness, warning and
durable-handoff workflow. It is a Codex-first MVP candidate, not completion of
every specification requirement. Finish sequentially, with one implementation
owner and a reviewer per stage:

1. **Validate and share this milestone.** Rehearse twice, review/commit the local
   implementation and compare the teammate's pending SQLite work before merging.
   Keep one active schema. Present operator editing honestly if still required.
2. **Harden ordinary Codex usage.** Verify native file edits, interrupted-session
   recovery, supported lifecycle signals/Git refresh points and unavailable-host
   behavior. Keep explicit MCP as the fallback; do not invent hooks.
3. **Close durable-memory contracts (implemented).** Target memory PATCH/DELETE with
   immutable revision history, current-only retrieval/tombstones, validation and
   shared HTTP/MCP/CLI semantics. Validate public retrieval/search usability.
4. **Add Claude equivalence (implemented; live verification pending).** Use the
   existing core/MCP contracts and documented hooks. A teammate must rehearse
   Codex + Claude and restart handoff before default activation.
5. **Run the full specification acceptance audit.** Check each requirement against
   code and reproducible evidence, then document installation and remaining
   limitations. Do not call the full MVP finished merely because the demo passes.

Avoid dashboard, cloud, autonomous task assignment and parallel schema work.
These stages replace splitting work into five unrelated simultaneous tasks.
See `docs/mvp-status.md` for the requirement-level implementation assessment.

## Immediate Delivery Target: Thursday, October 22, 2026

### Execution Update: Implement the Complete Slice Now

The October 20 implementation run executes D1 through D6 in dependency order
in this checkout, rather than waiting for the calendar checkpoints below.
Deliver production code, regression/integration tests, a restartable demo,
and an exact runbook. Preserve existing data and distinguish automated MCP
verification from a real host rehearsal. The calendar is a presentation
deadline, not a reason to leave an authorized stage unimplemented.

- [x] D1: one service authority, migrations, atomic state, regression coverage.
- [x] D2: semantic lifecycle, versioned memories, purposeful MCP operations.
- [x] D3: Git evidence with honest attribution and fixture coverage.
- [x] D4: deterministic budgeted context and restart handoffs.
- [x] D5: CLI, simulated/live demo modes, runbook, automated acceptance.
- [x] D6: full checks, repeated rehearsal, implementation-status documentation.

Verification on October 20: typecheck, build, all 37 tests, the compiled-build
demo, and two live Codex-plus-simulated-peer rehearsals passed. Both successful
live rehearsals used explicit operator-edit mode because this host rejected
Codex file execution. The second used the generated PowerShell/Node launcher.
Native agent-authored file edits are not claimed as verified on this host.
See `docs/verification.md` and `docs/demo.md` for evidence and reproduction.
The demo launcher also discovers Codex outside PATH (including the VS Code
extension), writes absolute executable paths, and generates a login-check script.
The reported `spawn codex ENOENT` regression is covered with empty-PATH checks.

This implementation delivers the specification's coordination and
handoff scenario using **one live coding agent plus one simulated peer**. Work
through the stages below sequentially. The delivery units later in this file
remain the longer-term roadmap; they are not five simultaneous assignments.

This is a demo slice of the existing MVP, not a change to product scope. The
full specification remains authoritative. The execution checklist records what
has been implemented; verification evidence below distinguishes automated and
live-host results.

### Baseline and Main Blocker

Before this implementation, `b94be26` passed typecheck, build, and 13 tests.
That baseline provided SQLite persistence and an MCP entry point, but lacked
Git evidence, semantic memory services, useful context, and CLI inspection.

The HTTP service keeps a processor in memory while MCP reloads from SQLite on
each call. Previously reproduced behavior: HTTP misses MCP-created tasks and
warnings; a later HTTP write could overwrite newer MCP task fields. This
baseline defect is now covered by regression tests and removed by routing all
production interfaces through one service authority.

### Demo Success Criteria

1. Start the service with a dedicated fixture repository and demo database.
2. Connect one real agent through MCP and register its project/session identity.
3. Have the live agent report a task and expected files.
4. Have the live agent change a fixture file and inspect Git. On a read-only
   host, use the explicit operator-edit mode, label its author separately, and
   let the live agent inspect the Git evidence without claiming authorship.
5. Start a clearly identified simulated peer through the public application
   interfaces. It retrieves the first session's context, reports an overlapping
   task, and receives an understandable warning.
6. The live agent records a decision with rationale and completes its task with
   a summary, important files, remaining issues, and next steps.
7. Restart the service without replacing the database. A newly registered
   session retrieves the decision and completion handoff.
8. Replay a previously accepted report and demonstrate that records are not
   duplicated. Show the same project state through the CLI and MCP.

The simulated peer must be identified as simulated in output and narration.
Its events use real validation, application services, persistence, and warning
rules. It must not insert database rows or fabricate returned context.

### D1. Establish One Service Authority and Close the Consistency Bug

Deliverables:

- Keep one long-running local service responsible for coordination and database
  writes. MCP and CLI call its validated application API through a shared local
  client instead of maintaining independent writable processor caches.
  Production entry points must use this authority; isolated in-memory processors
  remain available for tests.
- Keep runtime composition and database setup outside transport handlers.
  Preserve the persistence interface where useful; avoid an unrelated rewrite.
- Use versioned migrations for runtime initialization, including the existing
  `cm_*` tables. Use Drizzle for ordinary repository queries. Preserve existing
  `cm_*` data; do not solve upgrades by silently recreating the database.
- Keep the unused generic schema out of the active runtime path. Its archival
  or broader reconciliation can follow the demo; prompt/response capture is
  not introduced.
- Consolidate overlap derivation in the application layer. Persist its result
  atomically with the accepted event and projections instead of maintaining a
  second implementation in storage.
- Give the local client bounded timeouts and clear unavailable-service errors;
  do not fall back to a separate writable database. Close the database on
  shutdown and keep MCP protocol output free of application logs.

Acceptance gate:

- An MCP-created task is immediately visible through HTTP and the reverse.
- A later update through either interface preserves fields changed through the
  other interface. Warnings also agree.
- A file-backed close/reopen preserves state, history, and duplicate protection.
- Invalid input and failed writes do not partially mutate state. Existing
  project-isolation and delayed-event tests remain green.
- Include a regression test for the previously reproduced stale HTTP overwrite.

Main touch points: `src/service.ts`, `src/application/`, `src/storage/`,
`src/transport/`, `src/config.ts`, and integration tests.

### D2. Complete the Semantic Coordination Loop and Basic MCP Operations

Deliverables:

- Validate payloads by event type and define explicit session/task transitions.
  Missing entities, wrong ownership, and unsupported operations must return
  structured errors instead of silently reporting success.
- Support project/session registration, task reporting and updates, meaningful
  decisions with rationale, and completion handoffs. Keep agent identity
  separate from transport identity: an MCP connection is not an agent vendor.
- Persist decisions and handoffs as immutable memory versions with provenance
  and a current-version reference. Keep the FTS5 current-version index in sync
  transactionally; retain old versions for history.
- Completion must preserve summary, important files, decisions, remaining
  issues, and next steps as retrievable structured information. Ending a
  session must not complete its task.
- Expose the required operations through thin MCP tools and the same validated
  application contracts used by HTTP. Add session lifecycle operations as
  needed and document their exact public contracts deliberately.
- Give mutating operations stable request identities for retries, distinguishing
  a replay from a genuinely new task update or memory version.
- Return immediate coordination warnings from task reports/updates. Define how
  completed tasks and ended sessions affect active warnings.

Acceptance gate:

- Two sessions can report/update tasks, receive overlap warnings, record a
  decision, and complete a task through public interfaces.
- Retries do not create duplicate tasks or memories. Invalid operations do not
  appear successful. Memory supersession preserves history.
- Establish the live agent's MCP connection and execute a real report/context
  round trip now; do not defer host setup to demo day. The final context format
  can be improved in D4.

Blocker reporting/resolution and progress checkpoints were also implemented in
this run, including structured lifecycle and versioned resolution records.

Main touch points: `src/domain/`, `src/application/`, `src/storage/`,
`src/transport/mcp/`, `src/transport/http/`, and their tests.

### D3. Add Trustworthy Git Evidence

Deliverables:

- Inspect repository root, current branch or detached HEAD, worktree identity,
  and staged/unstaged/untracked paths through Git CLI calls with argument
  arrays, timeouts, and normalized repository-relative paths.
- Associate project/session identity with its repository/worktree. Trigger
  inspection at explicit refresh points and relevant reports; constant polling
  is unnecessary for this slice.
- Store repository evidence separately from expected files and unverified
  reports, with its observation source and time.
- Surface expected-file overlap alongside verified dirty-file evidence.
  Git showing a dirty shared-worktree file does not prove which session edited
  it. Only label overlap as confirmed when sufficient session-specific evidence
  exists; do not assign every dirty file to every active session.

Acceptance gate:

- Temporary Git repositories cover tracked edits, staged changes, untracked
  files, path normalization, and missing/non-Git directories.
- The demo shows a real file change verified by Git and an expected overlap
  warning naming the affected sessions/tasks and file.
- An agent claim alone cannot create verified evidence. Shared-worktree edits
  are not falsely attributed. A Git failure produces a visible diagnostic.

Main touch points: new `src/infrastructure/git/` modules, repository/evidence
application services, storage migrations, and fixture-based tests.

### D4. Generate Useful Startup and Handoff Context

Deliverables:

- Implement `GET /v1/context` and `get_project_context` over an application
  context service, replacing the unbounded serialized processor snapshot.
- Return active related work, warnings, Git evidence, relevant decisions,
  recent completions, remaining issues, and next steps.
- Use deterministic relevance rules: project isolation first, related files
  and tasks next, then recency. Support an explicit output budget with clear
  truncation. Prefer important warnings and current decisions over old activity.
- Exclude superseded/deleted memories from normal context while leaving their
  history inspectable. Return enough provenance to identify where context came
  from. Include blockers if that extension is implemented.

Acceptance gate:

- The simulated peer receives useful context about the live session before
  starting overlapping work.
- A new session after restart receives the completion rationale and next steps.
- Tests verify relevance, project isolation, deterministic ordering, budget
  enforcement, and superseded-memory exclusion.

Main touch points: context/memory application services, domain read contracts,
HTTP/MCP handlers, and context integration tests.

### D5. Make the Workflow Visible and Repeatable

Deliverables:

- Replace CLI placeholders with real `status`, `sessions`, `conflicts`, and
  `history` output. Add a context inspection command. Support readable terminal
  output and machine-readable JSON without duplicating application logic.
- Make `doctor` check the configured service, Git availability, and the
  service's reported storage readiness. Report actionable failures.
- Add a proposed `npm run demo` harness and `docs/demo.md` runbook. Provide a
  fully simulated rehearsal mode and a live-agent mode where the harness
  supplies the simulated peer and fixture setup. An explicit operator-edit
  variant also performs a labeled fixture edit for read-only hosts.
- Use a dedicated fixture repository and isolated demo database. Every run
  creates fresh disposable artifacts; never reset the developer's repository
  or silently clear an ordinary ContextMesh database.
- The automated acceptance scenario must use public interfaces, actual Git
  edits, and a real service restart with the same database. It must assert
  returned state and context rather than only printing a happy-path story.
- Record live-agent setup instructions for the tested host, exact commands,
  expected checkpoints, known limits, and recovery steps. Keep vendor-specific
  setup at the adapter/documentation boundary.

Acceptance gate:

- A teammate can run the scripted rehearsal from the runbook without manually
  constructing JSON or editing source files.
- One live agent plus the simulated peer completes the success criteria above.
- Fully simulated rehearsal uses the same core path and is clearly labeled.
  Keep it available as a diagnostic fallback; it does not replace live-agent
  acceptance.
- Service-unavailable behavior is visible and bounded; integration failure does
  not block the host agent from continuing its ordinary work.

Main touch points: `src/cli/`, a demo harness/fixtures, `package.json`, host
integration documentation, and end-to-end tests.

### D6. Freeze and Rehearse

- Run typecheck, build, and all tests, including the new cross-interface,
  file-backed restart, Git, context, and MCP acceptance coverage.
- Rehearse the live-agent scenario twice on the actual presentation machine.
  Reconfirm required local tools and host authentication before presenting.
- Preserve structured rehearsal reports, the fixture/runbook, and the verified
  working revision for team review. Commit the reviewed implementation before
  presentation; do not store model conversations in shared project memory.
- Update README, implementation-status notes in the spec, and focused docs to
  distinguish implemented functionality from remaining MVP targets.
- During the freeze, make changes only for reproduced acceptance failures and
  rerun the affected checks. Do not start another architecture or UI project.

### Schedule and Scope Control

These are target checkpoints, not a guarantee of effort or completion:

| Date | Target checkpoint |
| --- | --- |
| Tuesday, October 20 | D1 passes; D2 core reporting/decision/handoff loop works; live MCP connection validated |
| Wednesday, October 21, morning | D3 Git evidence and D4 relevant restart-safe context integrated |
| Wednesday, October 21, afternoon | D5 CLI and demo harness complete; first full live-agent rehearsal |
| Wednesday, October 21, evening | D6 verification and second rehearsal; freeze known-good commit |
| Thursday, October 22 | Presentation-machine smoke check and demo; fix only demonstrated blockers |

If a checkpoint slips, remove optional breadth before adding new work. The
required story remains one live agent, a simulated peer, shared tasks, honest
overlap/Git evidence, a decision, a completion handoff, and restart retrieval.
Report a missed gate explicitly rather than calling the demo ready.

Defer until after this demo unless all required gates pass: a second live host,
automatic lifecycle hooks/context injection, blocker/progress extensions not
needed by the story, advanced FTS ranking, full memory CRUD/export interfaces,
complete legacy-schema cleanup, packaging polish, dashboards, and IDE UI.
These remain roadmap work; this list does not remove MVP requirements.

### Sequential Agent Development and Handoff

- Use one active implementation owner for the current stage, with a second
  teammate reviewing the diff and running its acceptance scenario. Ownership
  can rotate between stages; there is no requirement to keep five coding tasks
  active. Supporting rehearsal/fixture work may proceed when its contracts are
  already stable.
- Each stage may use several small PRs. Merge verified increments and start
  the next stage from the merged baseline, not a stale parallel implementation.
- An agent task specifies the current stage, allowed scope, existing contracts,
  acceptance criteria, and verification commands. Agents must read root/scoped
  instructions and inspect the current implementation before editing.
- Handoff records the commit, implemented operations, tests run and results,
  known limitations, and the next unmet gate. Do not hand off only a narrative
  claim that a subsystem is complete.

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
