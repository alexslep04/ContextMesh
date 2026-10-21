import { ApplicationError } from "../domain/errors.js";
import { currentMemories } from "../domain/memories.js";
import type { ProcessorSnapshot } from "../domain/state.js";
import { contextQuerySchema } from "../domain/schemas.js";
export interface ContextItem {
  kind: string; id: string; summary: string; files?: string[]; sessionId?: string;
  taskId?: string; rationale?: string; data?: Record<string, unknown>; createdAt?: string;
}
export interface ProjectContext { projectId: string; budget: number; used: number; truncated: boolean; items: ContextItem[] }
export function generateContext(state: ProcessorSnapshot, input: unknown): ProjectContext {
  const query = contextQuerySchema.parse(input);
  const candidates: { item: ContextItem; score: number }[] = [];
  const add = (item: ContextItem, score: number) => candidates.push({ item, score: score + (item.files?.some(f => query.files.includes(f)) ? 500 : 0) });
  for (const warning of state.warnings.filter(w => w.projectId === query.projectId)) add({ kind: "warning", id: warning.id, summary: warning.message, files: warning.files, data: { sessionIds: warning.sessionIds, taskIds: warning.taskIds }, createdAt: warning.createdAt }, 10000);
  for (const blocker of state.blockers.filter(b => b.projectId === query.projectId && b.status === "open")) add({ kind: "blocker", id: blocker.id, summary: blocker.description, sessionId: blocker.sessionId, taskId: blocker.taskId, createdAt: blocker.createdAt }, 9500);
  for (const memory of currentMemories(state.memoryVersions).filter(m => m.projectId === query.projectId)) add({ kind: memory.kind, id: memory.id, summary: memory.content, rationale: memory.rationale, files: memory.relatedFiles, sessionId: memory.sourceSessionId, taskId: memory.taskId, data: memory.data, createdAt: memory.createdAt }, memory.kind === "decision" ? 9000 : memory.kind === "handoff" ? 8500 : 6000);
  for (const task of state.tasks.filter(t => t.projectId === query.projectId && ["active", "blocked"].includes(t.status) && t.sessionId !== query.sessionId && state.sessions.some(s => s.projectId === query.projectId && s.id === t.sessionId && s.status !== "ended"))) add({ kind: "active_task", id: task.id, summary: task.title, sessionId: task.sessionId, files: task.expectedFiles, data: { status: task.status, reportedFiles: task.reportedFiles ?? [], dependencies: task.dependencies ?? [] }, createdAt: task.updatedAt }, 8000);
  for (const evidence of state.evidence.filter(e => e.projectId === query.projectId)) add({ kind: "git_evidence", id: evidence.worktreePath, summary: "Git-verified repository changes; individual session attribution is not established.", files: evidence.files.map(f => f.path), data: { branch: evidence.branch, head: evidence.head, changes: evidence.files, source: evidence.source }, createdAt: evidence.observedAt }, 7500);
  candidates.sort((a, b) => b.score - a.score || (b.item.createdAt ?? "").localeCompare(a.item.createdAt ?? "") || a.item.id.localeCompare(b.item.id));
  const result: ProjectContext = { projectId: query.projectId, budget: query.budget, used: 0, truncated: false, items: [] };
  if (JSON.stringify(result).length + 16 > query.budget) throw new ApplicationError("context_budget_too_small", "Budget cannot fit this project context envelope", 400);
  for (const { item } of candidates) {
    result.items.push(item);
    if (JSON.stringify(result).length + 16 > query.budget) { result.items.pop(); result.truncated = true; }
  }
  // Account for the character count's own digits in the serialized envelope.
  for (let i = 0; i < 4; i++) result.used = JSON.stringify(result).length;
  return result;
}
