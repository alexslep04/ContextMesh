# Demo verification: October 27, 2026

Scope: the Codex-only Snake demo MVP. Claude Code and OpenCode are stretch goals.
Verified on Windows with Node 24.11.1, Git and Codex CLI 0.164.0-alpha.11.1 using
an existing ChatGPT login. No credentials or conversations are committed.

## Automated verification

- `npm run typecheck`: passed.
- `npm run build`: passed, including migration asset copying.
- `npm test`: **62 tests in 21 files passed**.
- Source Snake rehearsal: eight checks passed through the acceptance suite.
- `node dist/src/demo/index.js --two-simulated`: eight checks passed;
  pair-bTOKSM completed in 5 seconds.
- `git diff --check`: passed.
- Empty-PATH discovery in a normal Windows environment resolved the actual
  desktop-bundled CLI, independent of the app's injected PATH.

Coverage includes existing domain/storage/HTTP/MCP/Git/adapter contracts plus
Snake rules, independent rejection of a broken implementation even when peer
tests pass, actual browser-module controls via a deterministic DOM/timer double,
loopback preview/asset limits, invalid CLI modes/timeouts, desktop CLI discovery,
failed automatic agent launch and cleanup of a demo-owned process tree.
The connection test now has a bounded 20s budget for its multiple Git/process
checks, avoiding the observed 5s timeout under concurrent test load.

The fixture verifier explicitly requests TAP. Its previous assumption about
Node's default reporter caused false failures on Node 24 even with passing
fixture tests. Independent rule checks remain separate from peer-authored tests.

## Native two-Codex acceptance

Both runs used real agent file edits and separate MCP bridges, with
`mode:two-live-codex`, `operatorEdit:false` and all eight checks passing:

| Run | Entry | Elapsed |
| --- | --- | --- |
| pair-PhypjH | Source, automatic two-agent launch | 184 seconds |
| pair-0FlJy1 | Compiled build, automatic two-agent launch | 213 seconds |

A authored snake.js; B consumed A's actual context, intentionally declared an
overlapping initial scope, acknowledged the warning, narrowed to browser/tests,
recorded a dependency blocker, retrieved A's decision/rationale and handoff,
resolved its blocker and authored index.html, app.js and tests. Both sessions
completed/ended. The harness independently ran each peer's tests and checked
movement, growth/scoring, reversal, collisions, vacating-tail behavior, input
validation, immutability, ended/full-board state and executable browser controls.

It then restarted the actual service, retrieved both handoffs and the decision
through a new MCP connection, checked duplicate registration did not change
state, and verified CLI/doctor consistency. The restart reader is deterministic;
these runs do not claim a third live model or automatic core task assignment.

Structured reports, databases, receipts and game files are retained locally
under `.contextmesh/demos/`, ignored by Git. They contain no captured model
conversations. Each teammate should regenerate their own evidence using the
runbook; those local files are not required for cloning or running the demo.

## Browser check

Opened the agent-authored pair-PhypjH game in the browser through the loopback
preview. Confirmed the canvas, readable score/status and buttons; Start and
keyboard steering produced score 1; wall collision showed Game over; Restart
reset the game; Pause stopped play. Saved a full-page screenshot locally at
pair-PhypjH/snake-preview.jpg. Replay needs no model calls:

```powershell
npm run demo:play -- '.contextmesh/demos/pair-PhypjH'
```

## Presentation and boundaries

Use `npm run demo:live`: automatic live launch plus a persistent local preview.
Use `npm run demo -- --two-live --serve` for separate visible agent terminals,
or `npm run demo -- --serve` for a clearly labeled deterministic fallback.
Rehearse on the presentation machine; the observed roughly three-minute live
runs are measurements, not fixed latency guarantees. Existing login, normal
sandbox permissions and model availability are prerequisites.

Shared dirty Git files do not prove individual session authorship. Warnings
reflect expected-file overlap. Offline queuing, optional native hooks, forced
kill cleanup, additional vendors and broad installer compatibility are not
claimed as new guarantees. No dashboard or cloud dependency was introduced.
