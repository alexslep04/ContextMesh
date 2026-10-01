export type SessionStatus = "active" | "idle" | "ended";
export type TaskStatus = "active" | "blocked" | "completed" | "cancelled";
export type WarningKind = "expected_overlap" | "confirmed_overlap";

export interface Session {
  id: string;
  projectId: string;
  agentType: "claude_code" | "codex" | "mock";
  status: SessionStatus;
  taskId?: string;
  lastActivityAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  sessionId: string;
  title: string;
  status: TaskStatus;
  expectedFiles: string[];
  modifiedFiles: string[];
  updatedAt: string;
}

export interface Warning {
  id: string;
  kind: WarningKind;
  projectId: string;
  taskIds: string[];
  files: string[];
  message: string;
  createdAt: string;
}
