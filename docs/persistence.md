# Persistence

`SqliteEventPersistence` implements the application port with Drizzle queries.
`createDatabase` executes the shared versioned migration runner when opening a
database, so standalone project repositories are ready immediately. Event
persistence also checks that same idempotent runner for compatibility with raw
SQLite handles. Migrations are applied once through the ledger:

- `0000_contextmesh.sql`: existing `cm_*` base tables and FTS5 virtual table.
- `0001_demo_state.sql`: detailed projections, blockers, repository evidence,
  event lookup and memory-version uniqueness indexes.

`cm_schema_migrations` records applied migrations. Existing `cm_*` tables from
the persistence PR are adopted without clearing data. Legacy modification claims
load as reported files, not verified evidence. Retry comparison normalizes added
defaults while preserving historical event content.

Events, sessions/tasks, warnings, blockers, immutable memory versions, current
references and FTS updates share one transaction. Failed writes leave application
state/history unchanged. Memory history comes from `cm_memory_versions`, not FTS5.

Git evidence is stored by project/worktree in `cm_repository_evidence` after
inspection and survives restart. The runtime does not use the separate generic
`src/database/schema.sql`; reconciliation remains deferred and no prompt/response
capture is introduced.

The service is the only production writer. MCP/CLI use HTTP. The database `.lock`
file is removed on clean shutdown; restart checks the PID before recovering a
dead owner's lock. A live owner or malformed lock fails startup diagnostically.
Do not remove a lock belonging to a running service.

The build copies SQL migrations beside compiled storage modules, so source and
`node dist/src/service.js` execute the same migration path.

The teammate's `ProjectRepository` provides create/find/list and the projection
save operation used inside the event transaction. Event persistence loads and
saves projects through this repository; production writes still belong to the
single service. Project creation time is preserved when projections update.
`scripts/copy-migrations.mjs` is the single build asset-copy entry point; the
duplicate `copy-assets.mjs` was removed during integration.

Memory revision/deletion appends a version with an expected-version check and
reason. Deletion is a tombstone in the existing JSON version details and marks
`cm_memories.status` deleted. Content/history remain inspectable; the current-only
FTS index is updated in the same transaction. No new table or destructive schema
rewrite is required. Retrieval uses bound FTS5 MATCH parameters with query words
quoted as literals and project scoping; it never reconstructs history from FTS.

CLI examples (use a registered active session for edits):

```powershell
npm run cli -- memories --project my-project --query 'authentication token'
npm run cli -- memory show auth-contract --project my-project
npm run cli -- memory revise auth-contract --project my-project --session '<session>' --expected-version '<current-version-id>' --reason 'Clarify contract' --content 'Updated decision'
npm run cli -- memory delete auth-contract --project my-project --session '<session>' --expected-version '<current-version-id>' --reason 'No longer applicable'
```

HTTP PATCH/DELETE `/v1/memories/:id` accepts projectId, sessionId, requestId,
expectedVersionId and reason; PATCH additionally accepts changed content,
rationale and/or relatedFiles. GET `/v1/memories?projectId=...&query=...` searches
current memories. A missing query lists them. Limits are bounded to 1-100.
