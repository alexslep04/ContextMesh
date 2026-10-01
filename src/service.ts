import { loadConfig } from "./config.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { createApp } from "./transport/http/server.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const app = createApp();

try {
  await app.listen({ host: config.host, port: config.port });
  logger.info({ host: config.host, port: config.port }, "ContextMesh service started");
} catch (error) {
  logger.error({ err: error }, "ContextMesh service failed to start");
  process.exitCode = 1;
}
