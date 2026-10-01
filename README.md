# ContextMesh

ContextMesh is a local coordination layer for developers running multiple AI coding agents on the same project.

It allows agents such as Codex and Claude Code to share relevant project context, including:

- active tasks
- recently completed work
- important project decisions
- blockers and next steps
- expected and changed files
- possible task or file overlap

ContextMesh is local-first and is intended to help one developer run multiple AI coding sessions without manually copying context between them.

## Project Status

Early development.

The current focus is building the core ContextMesh service, normalized event model, local SQLite storage, Git verification, and mock agent sessions before integrating Codex and Claude Code.

## Documentation

- `ContextMesh_SPEC.md` — product and technical specification
- `AGENTS.md` — instructions for AI coding agents working in this repository

## Planned MVP

- Local ContextMesh service
- Codex integration
- Claude Code integration
- Shared task and session state
- Git-based file verification
- Conflict/overlap warnings
- MCP context access
- CLI inspection tools

## Development

Development setup and commands will be added as the project structure is established.