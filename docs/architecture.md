# Architecture

ContextMesh is a local-first TypeScript service. Host adapters translate
supported Claude Code and Codex payloads into normalized events. Application
services process those events, combine agent intent with Git evidence, and
persist shared state. HTTP, MCP, and CLI are interface layers over the same
application contracts.

```text
Host hooks / MCP / CLI
          |
          v
  validated application contracts
          |
          v
  ContextMesh application services
       |              |
       v              v
   SQLite + FTS5     Git evidence
```

The current foundation includes a SQLite persistence adapter for event history,
sessions, tasks, and overlap warnings. It uses isolated `cm_*` tables while the
repository's separate generic SQL schema is reconciled in a later migration.
