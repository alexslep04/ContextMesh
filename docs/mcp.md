# MCP

The MCP server exposes purposeful agent operations rather than database
access. The current foundation registers `get_project_context` and
`report_task` against the in-memory processor. The storage-backed
implementation will add task update, completion, decision, blocker,
resolution, and checkpoint tools using the same Zod contracts as HTTP.
