# Claude integration: implemented, disabled pending live validation

Claude is not needed to build or run ContextMesh's shared core. The repository
includes Claude hook normalization, advisory delivery, session/context/Git
handling, MCP configuration and a generated launcher. Automated fixtures test
the contracts; no installed/authenticated Claude host was available here.

## Prepare without Claude

Keep `npm run dev` running. From the ContextMesh checkout:

```powershell
npm run cli -- connect claude --project my-project --repo 'C:\path\to\project' --task 'Test the API change'
```

This writes ignored connection artifacts only. `hook-config.json` has
`enabled: false`, and the generated launcher refuses to start Claude. Preparation
does not search for Claude, contact its account or alter global/project host
settings. Fixtures and `npm test` require no Claude account.

## Teammate opt-in

Use a disposable Git project first. Install/authenticate Claude Code using its
[normal setup](https://code.claude.com/docs/en/quickstart). Node 22.18+ and Git
must be on PATH, including in the environment used for command hooks.

Keep ContextMesh running. Prepare a new connection with explicit activation:

```powershell
npm run cli -- connect claude --project my-project --repo 'C:\path\to\project' --task 'Test the API change' --enable-experimental-claude
```

Run the printed PowerShell script, or its `.mjs` file with Node. The launcher
loads settings/MCP files for that invocation and keeps normal permission
prompts. It finds a native Claude executable on PATH or under `~/.local/bin`,
or an npm `@anthropic-ai/claude-code/cli.js` on PATH. Set an absolute
`CONTEXTMESH_CLAUDE` executable/Node entry path for an unusual installation.

Generated files follow the documented
[hook contracts](https://code.claude.com/docs/en/hooks) and
[CLI flags](https://code.claude.com/docs/en/cli-reference). Actual version,
managed policies, shell behavior and tool permissions need live testing.
If hooks are skipped, MCP remains available; the instructions explain manual
unique-session registration as a fallback. No permissions/trust bypass is used.

## Live acceptance checklist

Record the commit, OS, Node/Git/Claude versions, pass/fail results and short
diagnostics. Do not commit credentials, conversations or full tool input.

1. **Startup:** SessionStart registers a `claude_code` session and supplies its
   project/session identity and bounded context. Confirm it with
   `npm run cli -- sessions --project my-project`.
2. **MCP:** Claude retrieves context and reports its task/expected files.
   Confirm through CLI tasks and inspect ordinary tool permissions.
3. **Real edits:** Claude edits a disposable fixture. Successful supported file
   hooks record activity claims and refresh Git. Confirm changed paths in
   context; dirty files must not be attributed to every session. Check that
   ContextMesh MCP callbacks do not recursively trigger refreshes.
4. **Mixed coordination:** Start Codex with `connect codex` on the same project
   and repository. Ask for overlapping initial expected files. Verify named
   warnings; narrow one task and verify the warning clears. ContextMesh must
   not block edits or assign tasks.
5. **Handoff:** Record a decision/rationale, blocker/resolution and completion
   with next steps. The other model retrieves the actual context and continues.
   Run code/tests independently.
6. **Lifecycle:** Stop does not complete tasks or end sessions. Closing Claude
   normally fires SessionEnd; unfinished work stays unfinished. Resume and
   verify a new active lifecycle without resurrecting the ended session.
7. **Restart/replay:** Restart ContextMesh on the same database; retrieve saved
   decisions/handoffs from a fresh connection. Check search/history. Retry a
   report with its original requestId; no duplicate memory version.
8. **Outage:** Stop ContextMesh. Hook failures must be advisory and diagnostic;
   ordinary work can continue. Restore the service and inspect session state.

A forced process kill cannot guarantee hook execution. Recover a known stale
session with `end-session --project ... --session ... --reason ...`; this never
completes its task. Delivery during outages is not queued.

Do not enable Claude by default or call mixed-vendor support verified until
this checklist passes. Fix host/version issues, rerun fixtures and repeat the
affected live steps before claiming the complete specified MVP.
