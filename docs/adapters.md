# Adapter Capabilities

Adapters are deliberately capability-aware. Claude Code has documented
session, tool, stop, and HTTP hook surfaces. The adapter boundary currently
declares these capabilities without claiming automatic capture; implementation
of each hook must be added with payload fixtures and integration tests.

Codex integration begins with an intentionally empty capability declaration.
The repository must not claim automatic Codex lifecycle capture until a
supported host surface is verified and covered by adapter tests. Explicit MCP
reporting is planned for the next integration slice.
