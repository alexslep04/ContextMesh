export type MemoryKind =
  | "decision"
  | "progress"
  | "handoff"
  | "blocker_resolution"
  | "project_fact";

export interface MemoryVersion {
  id: string;
  memoryId: string;
  version: number;
  kind: MemoryKind;
  projectId: string;
  content: string;
  sourceSessionId?: string;
  supersedesVersionId?: string;
  createdAt: string;
}
