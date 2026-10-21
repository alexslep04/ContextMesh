# Thursday demo runbook

Primary target: two live Codex sessions. The original one-live/simulated-peer
workflow remains available. Run from
ContextMesh in PowerShell. Requires Node 22.18+, npm dependencies, Git, and an
authenticated MCP-capable Codex CLI for live mode.

## Two live Codex sessions

In Terminal 1, from the ContextMesh checkout:

```powershell
npm run demo -- --two-live --timeout 300
```

Keep that command running. It prints `check-login.ps1`, `start-agent-a.ps1`
and `start-agent-b.ps1` commands using the actual absolute paths for this run.
Run the login check, then the A command in Terminal 2 and B command in Terminal
3. Both can start together. Each uses an independent ephemeral Codex invocation
and MCP bridge, with the same project ID and a distinct session ID. Scripts
resolve the installed CLI (including the VS Code installation) without relying
on a `codex` command being available in the other terminals.

The fixture demonstrates this sequence:

1. A reports authentication work, edits `src/auth.ts`, and refreshes Git.
2. B retrieves A's active task, readiness checkpoint and Git evidence.
3. B intentionally includes `src/auth.ts` in its initial expected scope. It
   receives an overlap warning; both agents acknowledge the coordination issue.
4. B updates its task to `tests/auth.test.mjs` only. The warning clears. B records
   a dependency blocker while waiting for A's completed interface.
5. A saves the decision/rationale, completes a useful handoff and ends its session.
6. B retrieves that decision and handoff through MCP, saves a checkpoint,
   resolves its blocker, adds/tests the contract tests, completes and ends.
7. The harness independently runs the test file and checks the token contract.
   It restarts the actual service and verifies both handoffs from a new MCP
   connection, then verifies replay protection and CLI consistency.

Expect **eight PASS checkpoints** and `report.json` with mode `two-live-codex`.
The fixture is a demonstration token predicate, not production authentication.
The overlap is deliberately introduced by the demo task instructions;
ContextMesh neither assigns the tasks nor forces the agents to narrow them.
The post-restart reader is a deterministic MCP verifier, not a third live model.

For this host's restricted file execution, use:

```powershell
npm run demo -- --two-live --operator-edit --timeout 300
```

Run the two newly printed scripts. Both Codex sessions still perform their own
context retrieval, semantic reports, coordination and handoffs. The harness
explicitly writes the implementation and test fixture at the appropriate
checkpoints; the agents must not claim authorship or test execution. The report
records `operatorEdit: true`. This demonstrates live coordination with operator
file edits, not two agents authoring code. Do not bypass a host policy rejection.

For deterministic rehearsal without model usage:

```powershell
npm run demo -- --two-simulated
```

This follows the same eight-check workflow using separate real stdio MCP
processes and scripted semantic peers. Its report is labeled
`two-simulated-mcp-peers`. It is included in the ordinary test suite.

Each bridge records only operation names, request IDs, warning IDs and returned
context item provenance under `*-receipts.jsonl`. Assertions check B's actual
context response before its task report and its receipt of A's handoff. These
files exclude tool payloads, full context text, prompts and model responses.
`fixture-test-results.txt` records the independent test runner's output.
Handled failures produce `failure.json` with completed checkpoints and the
failure message. Ctrl+C stops the harness-owned service; close the separately
started Codex sessions too if interrupting early.

## Automated rehearsal

```powershell
npm ci
npm run typecheck
npm run build
npm test
npm run demo
```

Default mode simulates both sessions but uses real HTTP, stdio MCP, Git,
SQLite, CLI and a real service process restart. Seven PASS checkpoints must
appear. Success is saved under `.contextmesh/demos/demo-*/report.json`.
This is diagnostic rehearsal, not evidence of a real host run.

## Live-agent demo

```powershell
npm run demo -- --live --timeout 300
```

The harness prints a path to `start-agent.ps1`. Run that exact script in a
second PowerShell terminal while the harness remains running. The script passes
the full fixture prompt to an ephemeral Codex invocation with the demo MCP
connection and limited tool list. It uses the existing host login and does not
edit global configuration or store credentials in the project.

The harness resolves Codex before starting the service, checking
`CONTEXTMESH_CODEX`, PATH, standard standalone/npm locations and the VS Code
extension. The generated scripts use the resolved absolute executable path;
Terminal 2 does not need a `codex` command on PATH. The harness prints a
`check-login.ps1` command that checks the same executable's login status.
Run that check in Terminal 2, then run the printed `start-agent.ps1` command.

For a custom installation, set an absolute path in Terminal 1 before starting:

```powershell
$env:CONTEXTMESH_CODEX = 'C:\path\to\codex.exe'
```

An installed npm `codex.js` entry point is also supported. If no installation
can be found, the harness fails immediately with a diagnostic. See
[official CLI installation instructions](https://learn.chatgpt.com/docs/codex/cli)
for machines that do not have Codex installed.

The live agent registers, retrieves context, reports work, edits `src/auth.ts`
and refreshes Git. The harness then registers its simulated peer, retrieves
context and reports overlap. The live agent sees the warning, records a decision
and completes its handoff. The harness restarts the service and checks retrieval,
replay protection and CLI output.

### Hosts with read-only file execution

If the host rejects file/shell operations, use the explicit variant:

```powershell
npm run demo -- --live --operator-edit --timeout 300
```

Run the newly generated script in a second terminal. The live model performs
all semantic reporting and context requests through MCP. After its task report,
the harness makes a labeled operator edit to the disposable fixture. Git verifies
that edit. The agent must not claim authorship or report that operator change as
its own activity. This is a live semantic-coordination demo with an operator
edit, not an agent-authored-code demo; the report identifies it.

## Presentation sequence

1. Explain the problem: independent sessions can duplicate work and lose rationale.
2. Show live task registration and context retrieval.
3. Show Git evidence and the simulated peer's named overlap warning.
4. Show the decision rationale and completion next steps.
5. Show restart retrieval and replay protection.
6. Explain that ContextMesh informs and warns; it does not assign work or block
   edits. Identify the simulated peer and any operator edit clearly.

The harness owns a service on a free loopback port and stops it on completion or
handled failure. Each run uses a fresh fixture/database; it never resets an
ordinary checkout/database. Artifacts contain the fixture, database, service
logs, connection settings, generated prompt/script and summary. They do not
store model conversations or credentials.

## Inspect saved state

Use the printed directory as `<demo-directory>`. Start the preserved database:

```powershell
$env:CONTEXTMESH_DB = '<demo-directory>\state.db'
$env:CONTEXTMESH_PORT = '4317'
npm run dev
```

In another terminal, set the same port and use `projectId` from `report.json`:

```powershell
$env:CONTEXTMESH_PORT = '4317'
npm run cli -- status --project '<project-id>'
npm run cli -- sessions --project '<project-id>'
npm run cli -- conflicts --project '<project-id>'
npm run cli -- context --project '<project-id>'
npm run cli -- history --project '<project-id>' --json
npm run cli -- doctor
```

## Recovery and freeze

- Service/MCP unavailable: inspect the endpoint and `service.log`; rerun for a
  fresh instance and generated configuration.
- `codex` unrecognized or `spawn codex ENOENT`: start a fresh demo using this
  version and run its newly generated scripts, which use an absolute executable
  path. Old scripts from earlier demo folders still depend on PATH.
- MCP denied: check host tool policy and the generated connection. Organization
  policy may still reject tools; report the limitation rather than success.
- File execution denied: use operator-edit mode; do not bypass host policy.
- `sandbox: read-only` in native mode despite the generated `workspace-write`:
  regenerate scripts with the current version. The previous launcher used
  `--ignore-user-config`, which omitted this host's Windows sandbox setup.
  Native launches now preserve normal user configuration and policy. Old
  generated scripts still have the faulty flag; restarting A alone does not fix
  them. If a genuine managed restriction remains, use operator-edit.
- Timeout: inspect host output. The task must be reported before the simulated
  peer starts. Reports are written only after every assertion passes.
- Restart recovers dead PID locks but never replaces a live owner. Do not remove
  a running service's ownership lock.
- Rehearse twice on the presentation machine, preserve the verified revision,
  and prepare a short recording. Label automated fallback runs as simulated.

Ordinary-project connections now support managed lifecycle and optional host
hooks, independently of the intentionally explicit demo prompts. Claude support
is implemented but disabled pending live verification. Two Codex sessions do
not verify the specification's separate Claude integration requirement.
The latest native-edit attempt (`pair-nsqdRe`) failed honestly when host policy
rejected the initial shell command; it made no fixture changes or success report.
Use operator-edit on this restricted host and native mode on a permitted host.
