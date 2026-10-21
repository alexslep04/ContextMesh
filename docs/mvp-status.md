# MVP status: October 20, 2026

The shared core, managed Codex lifecycle, memory editing/deletion/search and
opt-in Claude integration are implemented. Claude remains disabled until a
teammate can run live acceptance. Native two-Codex coding now passes on this host
after fixing configuration preservation. Claude/mixed-vendor and optional live
hook compatibility checks remain verification gates.

## Section 3 scope assessment

| Requirement | Current implementation and evidence |
| --- | --- |
| Local operation | Implemented: loopback Fastify service and local SQLite. |
| Codex and Claude | Codex MCP and managed lifecycle exercised live. Claude adapter, hooks, MCP configuration and launcher implemented, fixture-tested, disabled by default; live acceptance pending. |
| Multiple active sessions | Implemented: independent IDs and MCP connections sharing one service. |
| Session start/end | Explicit tools, managed Codex startup/cleanup, documented opt-in hooks and CLI recovery. Forced kills/outages can need explicit recovery. |
| Report understood task | Implemented and exercised through live MCP. |
| Update active task | Implemented; B narrowed to tests and cleared its warning. |
| Expected files | Implemented with validated repository-relative paths. |
| Observe file activity through hooks | Implemented documented file-tool normalization and automatic Git refresh; fixture-tested, live host/trust verification pending. Claims and Git evidence remain separate. |
| Verify repository state with Git | Implemented: worktree, branch, HEAD and changed paths. Native two-Codex run pair-t1QQA9 verified agent-authored implementation/tests and all eight checks. |
| Persist structured state | Implemented with migrations, Drizzle transactions, restart and replay checks. |
| Decisions and rationale | Implemented immutable versions, provenance and current context. |
| Blockers and resolutions | Implemented and used by B to wait for A's handoff. |
| Completion and handoff | Implemented for both sessions; B retrieved A's handoff and both survive restart. |
| Obvious overlap | Expected-file warnings implemented. Shared dirty files alone cannot prove session authorship; richer evidence-backed overlap remains limited. |
| Relevant context | Implemented deterministic project/file relevance, provenance, budgets and truncation. |
| MCP | Implemented shared semantic tools and context reads. |
| CLI inspection | Implemented status, sessions, tasks, conflicts, context, memories, history, doctor and refresh; new Codex connection preparation. |

## Additional target contracts

- Memory PATCH/DELETE, optimistic version checks, immutable revisions/tombstones,
  history/export and HTTP/MCP/CLI current-only retrieval are implemented/tested.
- FTS5 literal-word search is exposed through HTTP/MCP/CLI, project scoped,
  excludes deleted/superseded versions and survives restart.
- Worktree identity is observed; ContextMesh does not manage worktrees or infer
  per-session authorship from a shared dirty checkout.
- Managed Codex startup injects bounded shared context and cleans up after exit.
  Optional Codex hooks and Claude hooks are fixture-tested. Meaningful semantic
  reporting still depends on model tool calls. Offline delivery is not buffered;
  forced kills/outages have an explicit CLI recovery path.
- Generated Codex scripts work for ordinary Git repositories. Broader install
  and CLI-version compatibility need verification outside this machine.

## Release gates

The two-Codex coordination gate passed with operator edits, and a real managed
Codex session verified automatic registration/startup context/cleanup. Native
attempt `pair-nsqdRe` correctly stopped on a host-policy blocker with no edits.
The launcher configuration bug is now fixed; native run `pair-t1QQA9` passed
all eight checks with actual agent edits and independent fixture tests.
Complete [Claude/mixed-vendor acceptance](claude-validation.md). Verify native
hook trust/shell/version behavior. Teammate database work has been reconciled
with the existing schema/migration runner on `integrate/teammate-sqlite`. The
pre-integration code is saved as `5287aef`; final integration review/commit is
pending at the user's request.

Remaining breadth: confirmed per-session file authorship is intentionally not
inferred from shared dirtiness; broader host compatibility and optional richer
retrieval can follow evidence from real usage. No dashboard/cloud/orchestration
work is needed for this release.

See [verification](verification.md), [demo instructions](demo.md), and the
sequential priorities in [PLAN.md](../PLAN.md).
