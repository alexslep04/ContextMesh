import { readFileSync } from "node:fs";
import { managedSessionSchema, runManagedSession } from "./managed.js";
try {
  const path = process.argv[2]; if (!path) throw new Error("A generated managed-session configuration is required");
  process.exitCode = await runManagedSession(managedSessionSchema.parse(JSON.parse(readFileSync(path, "utf8"))));
} catch (error) { console.error(error instanceof Error && "code" in error && error.code === "EEXIST" ? "This connection was already launched. Prepare a new connection for a new session." : "Cannot start the managed Codex session. Check its generated configuration and service endpoint."); process.exitCode = 1; }
