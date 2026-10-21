export type SessionStatus = "active" | "idle" | "ended";
export type TaskStatus = "active" | "blocked" | "completed" | "cancelled";
export type AgentType = "claude_code" | "codex" | "mock";
export interface Project { id: string; repositoryPath: string; createdAt: string }
export interface Session {
  hostSessionId?: string; integrationId?: string;
  id: string; projectId: string; agentType: AgentType; status: SessionStatus;
  taskId?: string; repositoryPath?: string; startedAt?: string; lastActivityAt: string;
}
export interface Task {
  id: string; projectId: string; sessionId: string; title: string; status: TaskStatus;
  expectedFiles: string[]; modifiedFiles: string[]; reportedFiles?: string[];
  dependencies?: string[]; updatedAt: string; startedAt?: string; completedAt?: string;
  summary?: string; importantFiles?: string[]; decisions?: string[];
  remainingIssues?: string[]; nextSteps?: string[];
}
export interface Warning {
  id: string; kind: "expected_overlap" | "confirmed_overlap"; projectId: string;
  taskIds: string[]; sessionIds?: string[]; files: string[]; message: string; createdAt: string;
}
export interface Blocker {
  id: string; projectId: string; sessionId: string; taskId?: string; description: string;
  status: "open" | "resolved"; createdAt: string; resolvedAt?: string; resolution?: string;
}
export interface GitEvidence {
  projectId: string; repositoryPath: string; worktreePath: string; commonDirectory: string;
  branch: string | null; head: string | null; observedAt: string; source: "git";
  files: { path: string; staged: boolean; unstaged: boolean; untracked: boolean }[];
}
