import type { Blocker, GitEvidence, Project, Session, Task, Warning } from "./entities.js";
import type { MemoryVersion } from "./memories.js";
import type { ContextMeshEvent } from "./events.js";
export interface ProcessorSnapshot {
  projects: Project[]; sessions: Session[]; tasks: Task[]; warnings: Warning[];
  memoryVersions: MemoryVersion[]; blockers: Blocker[]; evidence: GitEvidence[];
  acceptedEventCount: number;
}
export interface PersistedProcessorState {
  snapshot: ProcessorSnapshot; eventIdentities: string[]; events: ContextMeshEvent[];
  latestEventAt: Record<string, string>;
}
export function emptySnapshot(): ProcessorSnapshot {
  return { projects: [], sessions: [], tasks: [], warnings: [], memoryVersions: [], blockers: [], evidence: [], acceptedEventCount: 0 };
}
