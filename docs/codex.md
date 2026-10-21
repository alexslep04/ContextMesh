# Codex connections

ContextMesh coordinates sessions independently of vendor. Two Codex sessions
can share one project just as Codex and Claude eventually will. Claude remains
in the full MVP goal; the current delivery milestone prioritizes two Codex
sessions connected through explicit MCP reporting.

## Ordinary project setup

Requires Node 22.18+, Git, installed dependencies and a logged-in Codex CLI with
`exec`, inline MCP configuration and `--ephemeral`.
The local verification uses CLI `0.162.0-alpha.17.2`. The launcher discovers
PATH, standard installations or the VS Code-bundled binary. Override with an
absolute `CONTEXTMESH_CODEX` path if necessary.

Start the ContextMesh service in one terminal:

```powershell
npm run dev
```

From the ContextMesh checkout, prepare two sessions against the actual Git
repository you want to work on:

```powershell
npm run cli -- connect codex --project my-project --repo 'C:\path\to\project' --task 'Implement the API change'
npm run cli -- connect codex --project my-project --repo 'C:\path\to\project' --task 'Test the API change'
```

Run each printed PowerShell command in a separate terminal. Alternatively run
the printed absolute `.mjs` path with Node. Use the same project ID for peers;
omit `--session` for a unique generated ID, or supply a new explicit value for
each session. Configuration uses the same `CONTEXTMESH_HOST/PORT` as the service
and must point to loopback. `--json` returns script and connection details.

Preparation checks service reachability, Git repository identity and already
registered session IDs. It creates only ignored connection artifacts under
`.contextmesh/connections/`, without registering a session, editing project
files, writing global Codex config or changing credentials. The generated
`check-login.ps1` checks the resolved CLI; `codex-cli.mjs login` can be run with
Node if that installation needs authentication.

The managed launcher registers the session, refreshes Git and retrieves bounded
startup context before starting Codex. The launch prompt asks Codex to report its
task and expected files, inspect warnings, update scope when useful, report
decisions/blockers and finish with a handoff. The launcher refreshes Git and ends
the session after the CLI exits, including failure or a handled interruption;
it never completes unfinished work. Each generated connection is single-use;
prepare another for a new session. It uses
the workspace-write sandbox with no approval prompts, an ephemeral session,
and an explicit ContextMesh MCP configuration. Existing authentication is used;
native mode preserves user Codex configuration, including Windows sandbox setup;
the explicit read-only operator demo still ignores user configuration.
Unsupported CLI flags or
organization tool restrictions can prevent execution. The launcher propagates
the CLI exit status; it never disables sandboxing or bypasses host policy.

## Limits

- Meaningful task/decision/completion reporting remains model tool calls guided
  by instructions. Startup context and launcher session cleanup are automatic.
- A forced process kill or a service outage can prevent cleanup. Recover an
  affected session explicitly; its unfinished task remains unfinished:

  ```powershell
  npm run cli -- end-session --project my-project --session '<id>' --reason 'Terminal was closed'
  ```
- MCP errors are bounded and diagnostic. After setup, the instructions tell
  the agent to continue ordinary work if ContextMesh becomes unavailable.
  Coordination updates made while offline are not durably queued.
- A dirty shared worktree proves repository changes, not which session made
  each change. No file locking, task assignment or autonomous conflict resolution
  is performed. Developers choose the tasks and whether to share a worktree.
- Run against a disposable fixture first if the host's file execution is
  uncertain. The demo's operator-edit option is intentionally fixture-only;
  it is not offered for ordinary projects.

The executable flow uses Codex's documented
[non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) and
[MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Optional hooks

Add `--hooks` to `connect codex` to generate hook definitions and pass them for
this invocation. The shared hook runner handles SessionStart/SessionEnd, refreshes
Git after supported tool activity and Stop, and supplies context at SessionStart
and UserPromptSubmit. The integration uses the same launcher session ID, so it
does not create a duplicate session. Stop never completes a task or ends a session.
It ignores MCP tool callbacks to avoid recursive refreshes and never reads a
transcript. File-tool reports are claims; repository evidence stays separate.

The command hook requires Node on PATH. Hook support and normal user trust are
required by the installed host. Review/trust hooks using its normal workflow;
the launcher never bypasses trust or organization policy. Unsupported or skipped
hooks leave managed startup/cleanup and explicit MCP as the fallback. Hook
contracts are fixture-tested; live hook execution on this host is not claimed.
See [official hook documentation](https://learn.chatgpt.com/docs/hooks).
