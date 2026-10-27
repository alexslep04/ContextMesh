# Agent integrations

The delivered agent interface is the shared stdio MCP bridge. A live Codex host
can register, report tasks/decisions/handoffs, request context and refresh Git.
Agent identity is an explicit session field; MCP is the transport identity.
The simulated peer is identified as `mock`.

Two live Codex sessions now have a dedicated demo workflow and independent
MCP bridges. `connect codex` generates an equivalent connection and coordination
prompt for ordinary Git projects. See [Codex setup](codex.md). This is explicit
MCP integration with managed startup context, lifecycle cleanup and Git refresh.

Vendor hook adapters now normalize documented session and file-tool fixtures.
The common runner handles delivery, startup context and Git refresh, never
task assignment or automatic completion. Codex hooks are opt-in and subject to
host support/trust. Claude connection preparation defaults disabled and requires
`--enable-experimental-claude` to launch. Claude Code and OpenCode are stretch goals outside the Codex MVP. No live Claude or native hook rehearsal
is claimed; see [Claude validation](claude-validation.md).

HTTP/MCP failures are bounded and diagnostic and do not cancel the agent. A host
without file execution can still report work and inspect Git. The explicit demo
operator-edit mode labels that edit independently rather than claiming the host
performed it.
