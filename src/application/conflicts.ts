import type { ProcessorSnapshot } from "../domain/state.js";
import type { Warning } from "../domain/entities.js";
export function deriveWarnings(state: ProcessorSnapshot, projectId: string, now: string): Warning[] {
  const activeSessions = new Set(state.sessions.filter(s => s.projectId === projectId && s.status !== "ended").map(s => s.id));
  const tasks = state.tasks.filter(t => t.projectId === projectId && (t.status === "active" || t.status === "blocked") && activeSessions.has(t.sessionId)).sort((a, b) => a.id.localeCompare(b.id));
  const result: Warning[] = [];
  for (let i = 0; i < tasks.length; i++) for (const other of tasks.slice(i + 1)) {
    const task = tasks[i];
    if (task.sessionId === other.sessionId) continue;
    const files = task.expectedFiles.filter(file => other.expectedFiles.includes(file));
    if (!files.length) continue;
    const id = JSON.stringify([projectId, "expected_overlap", [task.id, other.id]]);
    result.push({ id, projectId, kind: "expected_overlap", taskIds: [task.id, other.id], sessionIds: [task.sessionId, other.sessionId], files,
      message: "Sessions " + task.sessionId + " and " + other.sessionId + " expect to modify " + files.join(", ") + ".",
      createdAt: state.warnings.find(w => w.id === id)?.createdAt ?? now });
  }
  return result;
}
