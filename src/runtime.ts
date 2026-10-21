import { mkdirSync, openSync, readFileSync, writeFileSync, closeSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createDatabase } from "./storage/client.js";
import { SqliteEventPersistence } from "./storage/sqlite-event-persistence.js";
import { EventProcessor } from "./application/event-processor.js";
import { ContextMeshService } from "./application/service.js";
import { createApp } from "./transport/http/server.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { loadConfig } from "./config.js";
export function createRuntime(config = loadConfig()) {
  const path = resolve(config.databasePath), lockPath = path + ".lock";
  mkdirSync(dirname(path), { recursive: true });
  // A service owns its cache for its lifetime; two services must not write it.
  let lock: number;
  try { lock = openSync(lockPath, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    let owner: number;
    try { owner = Number(readFileSync(lockPath, "utf8")); } catch { throw new Error("Cannot inspect ContextMesh database ownership lock"); }
    if (!Number.isInteger(owner) || owner <= 0) throw new Error("Invalid database ownership lock: " + lockPath);
    try { process.kill(owner, 0); throw new Error("Another ContextMesh service owns this database (PID " + owner + ")"); }
    catch (failure) {
      if ((failure as NodeJS.ErrnoException).code !== "ESRCH") throw failure;
      unlinkSync(lockPath); lock = openSync(lockPath, "wx");
    }
  }
  writeFileSync(lock, String(process.pid)); closeSync(lock);
  let database: ReturnType<typeof createDatabase> | undefined;
  try {
    database = createDatabase(path);
    const service = new ContextMeshService(new EventProcessor(new SqliteEventPersistence(database.sqlite)), true);
    const app = createApp({ service, logger: createLogger(config.logLevel) });
    app.addHook("onClose", async () => { database!.sqlite.close(); unlinkSync(lockPath); });
    return { app, service };
  } catch (error) { database?.sqlite.close(); unlinkSync(lockPath); throw error; }
}
