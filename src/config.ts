import process from "node:process";

export interface ContextMeshConfig {
  host: string;
  port: number;
  databasePath: string;
  logLevel: string;
  timeoutMs: number;
}

export function loadConfig(env = process.env): ContextMeshConfig {
  const port = Number(env.CONTEXTMESH_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("CONTEXTMESH_PORT must be a valid TCP port");
  }

  const timeoutMs = Number(env.CONTEXTMESH_TIMEOUT_MS ?? 5000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error("CONTEXTMESH_TIMEOUT_MS must be between 100 and 60000");

  return {
    timeoutMs,
    host: env.CONTEXTMESH_HOST ?? "127.0.0.1",
    port,
    databasePath: env.CONTEXTMESH_DB ?? "./.contextmesh/contextmesh.db",
    logLevel: env.LOG_LEVEL ?? "info",
  };
}
