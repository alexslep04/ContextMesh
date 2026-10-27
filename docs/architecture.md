# Architecture

A single local service owns the event processor, application services, and SQLite
connection. HTTP, the stdio MCP bridge, and CLI share validated contracts. The MCP
bridge and CLI never open the database or maintain writable state caches.

`runtime.ts` composes storage, logging, services and HTTP. `service.ts` starts it,
handles termination, and closes resources. Database ownership rejects a second
service; a lock from a dead process can be recovered at startup.

The processor validates semantic operations, enforces ownership/lifecycle,
derives warnings, and commits events/projections atomically through a persistence
port. Decisions, handoffs, progress, and blocker resolutions are versioned
memories. Unsupported operations fail explicitly rather than silently counting
as implemented behavior.

The Git inspector records worktree-scoped evidence independently of agent file
claims. Expected overlap is deterministic. Shared Git dirtiness does not prove
which session edited a file, so claims alone cannot create confirmed warnings.

Context selects current scoped records, sorts by category/file relevance/recency,
and respects a serialized JSON character budget with provenance and truncation.
History preserves prior versions; FTS5 indexes current versions only.

Memory revision/deletion uses normalized events with optimistic version checks.
Tombstones exclude deleted memories from current retrieval without removing
historical versions. HTTP, MCP and CLI call the same application behavior.

Managed Codex launchers own session registration, bounded startup context and
exit cleanup. Host adapters normalize documented hook inputs; a common advisory
runner calls the local API and refreshes Git. Hook errors never block host work
or complete tasks. Claude configuration defaults disabled; Claude Code and OpenCode are stretch goals.
Explicit Codex MCP with managed lifecycle is the MVP baseline; optional hooks
do not gate this release.

The demo uses public interfaces and isolated fixtures. Its acceptance test starts
real service and MCP processes, edits a Git fixture, restarts the service with
the same database, and validates CLI/context/replay results.
