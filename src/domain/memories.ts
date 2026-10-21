export type MemoryKind = "decision" | "progress" | "handoff" | "blocker_resolution" | "project_fact";
export interface MemoryVersion {
  id: string; memoryId: string; version: number; kind: MemoryKind; projectId: string;
  content: string; rationale?: string; sourceSessionId?: string; taskId?: string;
  relatedFiles?: string[]; supersedesVersionId?: string; createdAt: string;
  data?: Record<string, unknown>;
  deleted?: boolean; revisionReason?: string;
}
export function currentMemories(versions: MemoryVersion[], includeDeleted = false): MemoryVersion[] {
  const latest = new Map<string, MemoryVersion>();
  for (const version of versions) {
    const key = JSON.stringify([version.projectId, version.memoryId]);
    if (!latest.has(key) || latest.get(key)!.version < version.version) latest.set(key, version);
  }
  return [...latest.values()].filter(version => includeDeleted || !version.deleted);
}
