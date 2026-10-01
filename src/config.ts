import process from "node:process";

export interface ContextMeshConfig {
  host: string;
  port: number;
  databasePath: string;
  logLevel: string;
}

export function loadConfig(env = process.env): ContextMeshConfig {
  const port = Number(env.CONTEXTMESH_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("CONTEXTMESH_PORT must be a valid TCP port");
  }

  return {
    host: env.CONTEXTMESH_HOST ?? "127.0.0.1",
    port,
    databasePath: env.CONTEXTMESH_DB ?? "./.contextmesh/contextmesh.db",
    logLevel: env.LOG_LEVEL ?? "info",
  };
}
