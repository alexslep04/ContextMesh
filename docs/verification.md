# Demo verification: October 20, 2026

Verified locally on Windows with Node 22.18.0, Git, and the installed Codex CLI
0.162.0-alpha.17.2. This records completed checks, not a promise about a different
presentation machine or host policy.

## Automated checks

- `npm run typecheck`: passed.
- `npm run build`: passed, including migration asset copying.
- `npm test`: 58 tests in 20 files passed after the teammate SQLite integration.
- `npm run demo`: passed with real HTTP/stdio MCP/Git/CLI/SQLite processes.
- `node dist/src/demo/index.js`: passed against the compiled build and copied
  migrations, including a real service process restart.
- `git diff --check`: passed.
- Human-readable CLI sessions/tasks/conflicts/history/context/memories were
  exercised against a preserved live-rehearsal database.

Coverage includes cross-interface visibility and the stale-write regression;
ownership/lifecycle and project isolation; delayed delivery; replay/conflicting
identities; rollback on a real SQLite write failure; legacy schema adoption and
legacy retries; immutable versions and current-only FTS; Git changes, linked
worktrees, detached HEAD and failures; context scope/relevance/budgets; unavailable
and nonresponding service errors; memory history/export; and the process-based
acceptance scenario.

## Teammate SQLite integration

Integrated `origin/main` at `a08c974` on `integrate/teammate-sqlite`, with the
previous local MVP preserved at checkpoint `5287aef` on `work/contextmesh-mvp`.
The integration is staged for review; the final merge commit and push remain
undone at the user's request.

The teammate's project repository now participates in production persistence.
Database startup uses the versioned migration runner, and the build uses one
migration-copy script. Tests cover legacy database upgrades, reopening saved
projects, and project updates through the event processor.

Typecheck, build, and all 58 tests passed. Both
`npm run demo -- --two-simulated` (`pair-2y7uKO`) and
`node dist/src/demo/index.js --two-simulated` (`pair-nRt8Sl`) passed all eight
checks. These runs validate the source and compiled process paths; no additional
live model validation is claimed for this storage integration.

## Live host checks

Two real Codex sessions completed the semantic workflow with the simulated peer:

- `demo-swghgV`: live MCP registration, context, task, evidence inspection,
  overlap acknowledgment, decision and completion; seven harness assertions passed.
- `demo-2nUSVT`: repeated successfully using the generated PowerShell/Node
  launcher, including restart recovery, replay protection and CLI checks.

The reports and fixture databases are retained locally under
`.contextmesh/demos/`. They are ignored artifacts; teammates should rerun the
runbook to generate their own evidence rather than expect these files in Git.
Reports contain structured results, not model transcripts or credentials.

This host rejected Codex shell/file execution in the initial native-edit attempt.
The successful live runs therefore used explicit operator-edit mode. The live
model performed reporting/context/decision/handoff operations; the harness made
and labeled the fixture edit. Git verified it without attributing authorship to
the model. Native agent file execution and live Claude integration are not
claimed as verified. The standard live mode remains available for a host with
file execution; use the tested operator-edit mode on this machine.

## Reproduce

The launcher discovery fix was also checked against the real installed Codex
with an empty PATH: it found the VS Code-bundled executable and `login status`
reported `Logged in using ChatGPT`. Six regression tests cover extension
discovery, explicit/invalid overrides, npm shims, missing installations, empty-PATH
launching, argument preservation and child exit status. Generated login/start
scripts now use an absolute executable path across terminals.

Follow [the demo runbook](demo.md). For the tested live configuration:

```powershell
npm run demo -- --live --operator-edit
```

Run the printed `start-agent.ps1` in a second terminal. The Node launcher
preserves TOML argument quoting on Windows PowerShell 5, uses the existing
Codex login, and limits the invocation to the local demo tools. Preserve the
reviewed implementation revision and repeat the live rehearsal before presenting.

## Two-Codex milestone

Two independent live Codex sessions completed the new eight-check workflow:

- `pair-1LHd7J`: source entry point, two generated PowerShell launchers, separate
  native CLI sessions and separate MCP bridges. All eight assertions passed.
- `pair-k1dj3F`: compiled `dist/src/demo/index.js` and compiled MCP bridge;
  repeated successfully with both live agents. All eight assertions passed.

Both runs used explicit operator edits. A reported implementation intent and
read Git evidence. B retrieved that actual active context and received the
expected-file warning; it narrowed scope and recorded a dependency blocker.
A saved its decision and handoff, then ended. B retrieved the decision and
handoff through MCP, resolved its blocker, reviewed the operator test fixture,
completed and ended. The harness ran three Node fixture tests independently,
restarted the actual service, recovered both handoffs through a fresh MCP
connection, replayed registration and verified CLI consistency.

The second run also independently checked the token predicate outside the
peer's test file. The final suite verifies rejection of a broken implementation
even when the peer's own tests pass. The compiled deterministic two-peer
rehearsal also passed. Native agent-authored edits remain unverified on this
restricted host; neither successful run claims them.

The final automated suite also covers ordinary-project connection preparation,
distinct identities, existing session/repository mismatch checks, invalid Git
directories, unreachable service, actual CLI `connect codex` output, absolute
runtime entry paths, loopback configuration, receipt scope/content exclusion,
and interrupted coordination waits. The Node minimum is now 22.18.0, matching
the verified runtime and the demo's built-in TypeScript execution path.

Use `npm run demo -- --two-live --operator-edit` and run both printed scripts
in separate terminals. See [the runbook](demo.md) and [MVP status](mvp-status.md).

## Memory, lifecycle and Claude preparation

The completion-stage checks passed typecheck, build and 54 tests in 19 files.
New integration coverage verifies optimistic memory revision/deletion, immutable
history/tombstones, stale version conflicts, exact replay, current-only FTS
search, project scope, restart recovery and the actual HTTP/MCP/CLI seams.

Managed-launch tests run real child processes and HTTP/Git. They verify automatic
registration/context/cleanup, preserving unfinished work after child failure,
single-use and duplicate-session protection, generated runtime entry points and
continuing ordinary work when ContextMesh is unavailable. Hook fixtures verify
concurrent duplicate starts, file activity claims plus separate Git evidence,
resume, Stop without completion, bounded advisory failures, subagent/MCP callback
exclusion, disabled configuration and absence of transcript/prompt/tool contents
from event history. CLI tests exercise memory editing/search/deletion and manual
session recovery with stable retries.

A real Codex session (`managed-kJTQj8`) passed the managed launcher rehearsal:
automatic registration, bounded startup context, explicit MCP checkpoint, CLI
exit and automatic `launcher-end`. It intentionally used MCP only, performed no
file work and does not establish native coding/hook execution.

Native attempt `pair-nsqdRe` requested the normal workspace-write mode but the
host reported read-only execution and rejected the initial shell command.
Codex recorded a blocker; the harness emitted failure.json and stopped with no
file changes, test claims or success report. The waiting peer was then stopped.
The policy restriction was not bypassed.

Claude connection preparation and disabled launch refusal passed without an
installed Claude CLI. Adapters/settings follow the official host contracts;
fixtures are not live-host evidence. Claude and mixed-vendor acceptance remain
for the teammate checklist in [claude-validation.md](claude-validation.md).

Final compiled smoke checks also passed: `pair-FlrePx` completed the eight-check
two-peer rehearsal, and `compiled-connections-PgRKyW` exercised generated
managed Codex runtime/cleanup with a deterministic CLI double plus disabled
Claude launch refusal. These compiled smoke checks are not live model evidence.

## Windows native launcher regression

The `pair-yUUn6K` report exposed that the generated native launcher passed
`--ignore-user-config`. This skipped the user's trusted Windows sandbox setup:
the CLI reported read-only despite the requested workspace-write mode. A
configuration-only run with the same executable/worktree and preserved user
config reported workspace-write. Native launches now preserve normal user
configuration; operator-edit remains explicitly read-only. The one-live demo,
two-live demo and ordinary managed connections share the argument helper.

No sandbox/trust/managed-policy bypass was added. A regression checks native
configuration preservation and read-only operator mode. Old generated launch
scripts retain the faulty flag and must be replaced by starting a fresh run.
This corrects the earlier assumption that native execution was necessarily
unavailable on this machine.

Native rehearsal `pair-t1QQA9` then passed all eight checkpoints with
`operatorEdit: false`: A edited the implementation, B wrote/executed the tests,
the harness independently verified the contract/tests, and both handoffs
survived a real service restart. This is verified native two-Codex coding, not
operator-authored fixture work. Typecheck, build and all 55 tests passed.
