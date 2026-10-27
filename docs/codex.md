# Codex CLI and ContextMesh setup

The MVP supports multiple independent Codex sessions. Claude Code and OpenCode
are stretch goals. You may keep using the Codex desktop app for normal work;
the repeatable demo uses two separate CLI processes with MCP connections.

## Check before installing

In PowerShell:

```powershell
codex --version
codex login status
```

If those work and report a ChatGPT login, skip installation. On the development
machine on October 27, 2026 they returned `0.164.0-alpha.11.1` and `Logged in
using ChatGPT`. Your external terminal's PATH can differ from the app's PATH.

For a separate CLI installation, the official npm method is:

```powershell
npm install -g @openai/codex
codex
```

Choose Sign in with ChatGPT if prompted. You can explicitly run `codex login`,
then `codex login status` to check. If PowerShell blocks npm's script shim, use
`npm.cmd install -g @openai/codex`; do not weaken machine execution policy.
Open a new terminal if PATH changed. In an ordinary project, running `codex`
starts the interactive CLI; describe the work you want done. The demo instead
uses `codex exec` with prepared tasks so you do not type reports yourself.

Official sources: [CLI installation and sign-in](https://learn.chatgpt.com/docs/codex/cli),
[OpenAI CLI README (npm installation)](https://github.com/openai/codex#quickstart),
[non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Run the demo

Requires Node 22.18+, Git and installed ContextMesh dependencies:

```powershell
npm ci
npm run demo:live
```

This validates login, starts its own service, runs two real agents and then
prints the playable Snake URL. Open that URL. One terminal is sufficient; use
`npm run demo -- --two-live --serve` for separate visible A/B terminals instead.
See [the presentation runbook](demo.md).

The resolver checks PATH, standard standalone/npm locations, the Windows
desktop app's bundled CLI and VS Code's bundled CLI. This lets the demo use
the installed desktop CLI even when your external terminal lacks codex on PATH. Generated scripts use absolute executable paths so another terminal
does not need the same PATH. For a custom installation:

```powershell
$env:CONTEXTMESH_CODEX = 'C:\full\path\to\codex.exe'
```

An absolute installed npm `codex.js` entry point also works. Generated
`check-login.ps1` checks the exact resolved executable. Do not commit credentials
or change global config to make the demo run. Normal sandbox/trust and account
usage apply. Unknown CLI flags or organization policy can require resolving
host compatibility first; no permissions bypass is provided.

## Ordinary project setup

Start `npm run dev` in one terminal. Prepare two connections from this checkout:

```powershell
npm run cli -- connect codex --project my-project --repo 'C:\path\to\project' --task 'Implement the API change'
npm run cli -- connect codex --project my-project --repo 'C:\path\to\project' --task 'Add tests for the API change'
```

Run each printed launch command in its own terminal. Use the same project ID
for peers and distinct generated session IDs. Preparation checks reachability,
Git identity and duplicate sessions; it only writes ignored connection artifacts.
The managed launcher registers, refreshes Git, injects bounded startup context
and ends the session after exit. Semantic reports use MCP. Unfinished tasks stay
unfinished. Connections are single-use; prepare a new one for another session.
Native launches preserve normal user configuration, including Windows sandbox
setup. Demo/connection launchers use workspace-write, ephemeral execution and no
approval prompts, so denied operations fail rather than waiting on a hidden
prompt. They never disable sandboxing or bypass managed policy.

## Limits and optional hooks

- Meaningful reporting is model tool use guided by instructions. Startup/context
  and managed ordinary-project cleanup are automatic.
- A forced kill or outage may require recovery:
  `npm run cli -- end-session --project my-project --session '<id>' --reason 'Terminal closed'`.
  This does not complete its task. Offline updates are not queued.
- Shared dirty files prove repository changes, not individual session authorship.
- `connect codex --hooks` opts into host lifecycle/tool hooks and normal trust
  requirements. Unsupported/skipped hooks fall back to managed lifecycle and
  explicit MCP/Git. Native hooks are outside the demo acceptance baseline.
- Optional hook runners ignore MCP callbacks and never read transcripts or
  treat Stop as task completion. See [adapter details](adapters.md).
