import type { ContextMeshEvent } from "../domain/events.js";
import type { PersistedProcessorState, ProcessorSnapshot } from "../domain/state.js";

export interface EventPersistence {
  load(): PersistedProcessorState;
  persist(event: ContextMeshEvent, identity: string, snapshot: ProcessorSnapshot): boolean;
}
