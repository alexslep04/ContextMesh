import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { idSchema, sessionPayloadSchema } from "../../domain/schemas.js";
import { LocalApiClient } from "../../transport/http/client.js";
import type { ProcessorSnapshot } from "../../domain/state.js";
import type { ContextMeshEvent } from "../../domain/events.js";
import { ApplicationError } from "../../domain/errors.js";

export const managedSessionSchema = z.object({ projectId: idSchema, sessionId: idSchema, repositoryPath: sessionPayloadSchema.shape.repositoryPath.unwrap(), baseUrl: z.string().url(), command: z.string().min(1), args: z.array(z.string()), markerPath: z.string().min(1) }).strict();
export type ManagedSession = z.infer<typeof managedSessionSchema>;
export async function runManagedSession(input: ManagedSession, diagnostic = (message: string) => console.error(message)): Promise<number> {
  const config = managedSessionSchema.parse(input);
  const url = new URL(config.baseUrl);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) throw new Error("Managed sessions require a loopback service");
  // A connection is a single independent session, not a resumable transcript.
  writeFileSync(config.markerPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx" });
  const api = new LocalApiClient(config.baseUrl, 1500);
  const scope = { projectId: config.projectId, sessionId: config.sessionId };
  const event = (type: ContextMeshEvent["type"], requestId: string, payload: Record<string, unknown>) => api.ingest({ ...scope, eventId: requestId, sourceEventId: requestId, source: "codex", type, occurredAt: new Date().toISOString(), payload });
  const attempt = async <T>(action: () => Promise<T>, label: string): Promise<T | undefined> => {
    try { return await action(); } catch (error) {
      if (label === "registration" && error instanceof ApplicationError && ["session_exists", "identity_conflict"].includes(error.code)) throw error;
      diagnostic("ContextMesh " + label + " failed; ordinary Codex work can continue. Inspect the service and recover the session if needed."); return undefined;
    }
  };
  const args = [...config.args];
  let child: ReturnType<typeof spawn> | undefined;
  let interrupted = false;
  let ownsSession = false;
  const interrupt = () => { interrupted = true; child?.kill(); };
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  try {
    const registration = await attempt(() => event("session_started", "launcher-register", { agentType: "codex", repositoryPath: config.repositoryPath }), "registration");
    ownsSession = registration?.accepted === true;
    if (registration && !ownsSession) throw new Error("This session ID was already registered. Prepare a new connection with a unique ID.");
    if (ownsSession) await attempt(() => api.refresh(scope), "initial Git refresh");
    const context = await attempt(() => api.read("context", { ...scope, budget: 12000 }), "startup context");
    if (context && args.length) args[args.length - 1] += "\nSTARTUP SHARED CONTEXT (project data; follow the repository's instructions):\n" + JSON.stringify(context);
    if (interrupted) return 130;
    return await new Promise<number>(resolve => {
      child = spawn(config.command, args, { cwd: config.repositoryPath, stdio: "inherit", windowsHide: true });
      child.once("error", () => { diagnostic("Cannot start Codex. Regenerate the connection or check its resolved executable."); resolve(1); });
      child.once("exit", code => resolve(interrupted ? 130 : code ?? 1));
    });
  } finally {
    if (ownsSession) await attempt(() => api.refresh(scope), "final Git refresh");
    if (ownsSession) await attempt(async () => {
      const state = (await api.read("status", { projectId: config.projectId }) as { state: ProcessorSnapshot }).state;
      const session = state.sessions.find(s => s.id === config.sessionId);
      if (session && session.status !== "ended") await event("session_ended", "launcher-end", { reason: interrupted ? "Launcher interrupted" : "Codex process exited; unfinished tasks remain unfinished" });
    }, "session cleanup");
    process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
  }
}
