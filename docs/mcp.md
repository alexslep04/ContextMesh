# MCP

Start the service, then launch the stdio bridge with `npm run mcp` or
`node dist/src/mcp.js` after building. The bridge calls HTTP and never opens
SQLite. Configure the same `CONTEXTMESH_HOST`/`PORT` for service, MCP and CLI.

Mutations take `projectId`, `sessionId`, and `requestId`. Use a unique session
ID per host session and a shared project ID for peers. Exact retries reuse the
request ID; new updates use new IDs. Different content with an existing identity
returns `identity_conflict`.

| Tool | Purpose / additional inputs |
| --- | --- |
| `register_session` | Actual agentType (`codex`, `claude_code`, `mock`), absolute repositoryPath |
| `end_session` | Ends the session without completing its task |
| `report_task` | taskId, title, expectedFiles, optional dependencies |
| `update_task` | taskId, changed title/files/dependencies, optional reason |
| `complete_task` | taskId, summary, importantFiles/decisions/remainingIssues/nextSteps |
| `record_decision` | memoryId, decision, rationale, optional taskId/relatedFiles |
| `record_blocker` | blockerId, description, optional taskId |
| `resolve_blocker` | blockerId, resolution |
| `save_progress_checkpoint` | memoryId, content, optional taskId/relatedFiles |
| `report_file_activity` | taskId, repository-relative path; an unverified claim |
| `refresh_repository` | projectId, optional sessionId; inspect registered worktree |
| `get_project_context` | projectId, optional sessionId/files/budget |
| `get_active_sessions` | projectId |
| `get_conflicts` | projectId |
| `search_project_memory` | projectId, optional query/limit; current non-deleted versions only |
| `revise_memory` | memoryId, expectedVersionId, reason, changed content/rationale/relatedFiles |
| `delete_memory` | memoryId, expectedVersionId, reason; retains a historical tombstone |

Read-only tools have corresponding annotations. Mutations are retry-idempotent
and return immediate warnings. Tool errors use `isError` and structured codes.
An unavailable service never falls back to an independent database; default
HTTP timeout is five seconds, and the host may continue its ordinary work.

Supersede a decision/checkpoint using the same memoryId and a new requestId.
Old versions remain inspectable through HTTP memory history/export. Completion
saves a handoff with next steps. Context budget measures the complete serialized
JSON in JavaScript string characters, not model tokens: 256-30000, default 8000.
A budget unable to fit the required envelope is rejected. Omitted items set
`truncated`.

The generated demo connection applies settings only to that invocation's local
server and limited tool list. It does not modify permanent Codex configuration.

Memory edits reject a stale expectedVersionId with `memory_version_conflict`.
An exact retry uses the original requestId even after the version advances.
Deleted memories stay in history/export but leave normal context, lists and
search. Semantic reports cannot silently resurrect a deleted memory ID.
All mutations require a registered, non-ended reporting session.
See [the runbook](demo.md) and
[official OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
