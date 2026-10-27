# Snake demo: what to run and what to show

MVP scope: two Codex sessions. Claude Code and OpenCode are stretch goals.
Requires Node 22.18+, npm, Git and a logged-in Codex CLI. The desktop app can
remain open; the demo launches independent CLI processes with your existing
login. See [Codex setup](codex.md).

## One terminal plus a browser (recommended)

From the ContextMesh checkout:

```powershell
npm ci
npm run demo:live
```

Setup only needs `npm ci` after cloning/dependency changes. `demo:live` checks
Codex login and starts its own local ContextMesh service on a free loopback
port. Do not start `npm run dev` for this demo. It automatically launches A and B,
prints coordination checkpoints, independently verifies tests and restart,
stops the service and keeps a game preview running. Open the printed
`PLAY SNAKE: http://127.0.0.1:...` URL in your browser. Ctrl+C stops preview.

The agents write the actual game. A receives an engine task; B receives browser
and test work with an intentionally overlapping initial scope. These are
operator-selected instructions in the harness, not tasks assigned by the core.
Automatic mode displays checkpoint summaries rather than agent conversations.
It does not store model output. Live execution uses normal Codex account usage
and permissions; no new account or API key is required when ChatGPT login works.

## A few-minute presentation

Start live generation a few minutes before your speaking slot. Do not promise a
fixed model runtime; it depends on model latency and the host. Keep one verified
saved game as backup. A short talk can show the results of the run while you
point to the terminal evidence; no need to narrate every tool call.

| Moment | Show | Say |
| --- | --- | --- |
| 0:00-0:30 | Terminal: A task + real Git change | Two independent Codex sessions share one project. A builds Snake rules. |
| 0:30-1:15 | OVERLAP line, followed by scope-change PASS | B read A's actual context, noticed both planned to edit snake.js, and narrowed its own scope to browser/tests. |
| 1:15-2:00 | SHARED DECISION and handoff/restart PASS lines | B consumed A's interface decision and handoff. Both completed. A real service restart retained the knowledge. |
| 2:00-3:00 | Browser: click Start, steer, Pause, Restart | Here is the playable game the two sessions built. ContextMesh helped them coordinate without me relaying messages. |

The overlap is intentional. It demonstrates explained expected-file overlap,
not a detected merge conflict or proven per-session authorship. ContextMesh
warns; it does not block edits. The post-restart reader is a deterministic MCP
verifier, not a third live model.

## Three visible terminals (optional)

```powershell
npm run demo -- --two-live --serve --timeout 300
```

Leave Terminal 1 running. It prints a login-check script and launch commands for
A and B. Run the login check, then the A command in Terminal 2 and B command in
Terminal 3. Launch both promptly; the 300-second timeout is per phase.
Do not run these scripts as well as `--launch-agents`: that would duplicate the
same session identities. Scripts are single-run artifacts; generate a fresh
run after failure or changing code/configuration.

## Rehearsal and honest fallbacks

```powershell
npm run demo -- --serve
```

This follows the same eight checks with deterministic peers and is labeled
`two-simulated-mcp-peers`. HTTP, stdio MCP, Git, SQLite and restart are real;
the models and edits are simulated. Default `npm run demo` runs the same
rehearsal without keeping preview open, so it exits for automation.

If a host denies agent file execution, do not bypass its policy. An explicitly
labeled fallback is `npm run demo:live -- --operator-edit`. The harness then
writes the fixture while both live models perform semantic coordination.
Its report sets `operatorEdit:true`; it is not native agent-authored coding.
The earlier simulated authentication check is `npm run demo -- --legacy-auth`.

## Saved evidence and replay

Each run prints a fresh `.contextmesh/demos/pair-...` directory, containing:

- `report.json`: mode, operatorEdit, elapsed time and eight checks.
- `presentation.md`: checks and actual decision/handoffs recovered after restart.
- `fixture-test-results.txt`: independent Node test output (explicit TAP).
- `*-receipts.jsonl`: operation IDs and returned context provenance, no tool
  payloads or model conversations.
- `repository/`: the playable game and tests; `state.db`: persistent shared state.
- Generated connection/prompts/scripts, plus service diagnostics.

Replay a saved game without calling any model:

```powershell
npm run demo:play -- '<demo-directory>'
```

Or run that directory's `play.ps1`. Preview serves only index.html, app.js and
snake.js on loopback; it does not expose the database, Git metadata or receipts.
Game controls start paused. Use arrows/WASD, Start/Pause and Restart.

## Failure and recovery

A handled failure writes `failure.json` with its checkpoints and diagnostic;
it never writes a success report. Fix the cause and start a fresh run. In
automatic mode the harness stops its own agent process trees and service. In
separate-terminal mode also stop the two CLI processes yourself. Old artifacts
remain for diagnosis and never reset your ordinary repository/database.

For live CLI errors, retry separate-terminal mode so you can read each CLI's
own diagnostic. Check `codex --version`, `codex login status`, normal sandbox
setup/trust and Node/Git availability. If Codex is not found, set an absolute
`CONTEXTMESH_CODEX` path or follow codex.md. The scripts preserve normal user
configuration and do not bypass permissions. Forced crashes may leave a stale
session; ordinary projects support CLI `end-session` recovery without completing
unfinished work.
