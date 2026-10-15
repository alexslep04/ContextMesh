import { loadConfig } from "./config.js";
import { EventProcessor } from "./application/event-processor.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { createDatabase } from "./storage/client.js";
import { SqliteEventPersistence } from "./storage/sqlite-event-persistence.js";
import { createApp } from "./transport/http/server.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const database = createDatabase(config.databasePath);
const processor = new EventProcessor(new SqliteEventPersistence(database.sqlite));
const app = createApp({ processor });

try {
  await app.listen({ host: config.host, port: config.port });
  logger.info({ host: config.host, port: config.port }, "ContextMesh service started");
} catch (error) {
  logger.error({ err: error }, "ContextMesh service failed to start");
  database.sqlite.close();
  process.exitCode = 1;
}
