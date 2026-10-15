import type { Session, Task, Warning } from "./entities.js";

export interface ProcessorSnapshot {
  sessions: Session[];
  tasks: Task[];
  warnings: Warning[];
  acceptedEventCount: number;
}

export interface PersistedProcessorState {
  snapshot: ProcessorSnapshot;
  eventIdentities: string[];
  latestEventAt: Record<string, string>;
}
