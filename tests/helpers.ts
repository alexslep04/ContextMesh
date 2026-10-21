import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import type { ContextMeshEvent } from "../src/domain/events.js";
export function temporaryDirectory() {
  const prefix = join(tmpdir(), "contextmesh-tests-");
  const path = mkdtempSync(prefix);
  return { path, remove() { if (!resolve(path).startsWith(resolve(prefix))) throw new Error("Unexpected cleanup target"); rmSync(path, { recursive: true, force: true }); } };
}
export function events() {
  let sequence = 0;
  const now = () => new Date(Date.UTC(2026, 9, 20, 12, 0, sequence++)).toISOString();
  return { now, event(type: ContextMeshEvent["type"], payload: Record<string, unknown> = {}, sessionId = "a", projectId = "p"): ContextMeshEvent {
    const eventId = "event-" + sequence;
    return { eventId, sourceEventId: eventId, type, source: "mock", projectId, sessionId, occurredAt: now(), payload };
  }};
}
export function git(path: string, ...args: string[]) { return execFileSync("git", ["-C", path, ...args], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim(); }
export function fixtureRepository(path: string) {
  mkdirSync(join(path, "src"), { recursive: true });
  git(path, "init"); git(path, "config", "user.name", "ContextMesh Test"); git(path, "config", "user.email", "contextmesh@example.invalid");
  writeFileSync(join(path, "src", "auth.ts"), "export const authenticate = () => false;\n");
  git(path, "add", "."); git(path, "commit", "-m", "Fixture baseline");
}
