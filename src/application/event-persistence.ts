import type { ContextMeshEvent } from "../domain/events.js";
import type { GitEvidence } from "../domain/entities.js";
import type { PersistedProcessorState, ProcessorSnapshot } from "../domain/state.js";
export interface EventPersistence {
  load(): PersistedProcessorState;
  persist(event: ContextMeshEvent, identity: string, snapshot: ProcessorSnapshot): boolean;
  saveEvidence(evidence: GitEvidence): void;
  searchMemories?(projectId: string, terms: string[], limit: number): string[];
}
