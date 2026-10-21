import { createRuntime } from "./runtime.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./infrastructure/logging/logger.js";
const config = loadConfig();
const logger = createLogger(config.logLevel);
let runtime: ReturnType<typeof createRuntime> | undefined;
try {
  runtime = createRuntime(config);
  await runtime.app.listen({ host: config.host, port: config.port });
  logger.info({ host: config.host, port: config.port }, "ContextMesh service started");
  let closing = false;
  process.on("message", message => {
    if (message === "shutdown" && !closing) {
      closing = true;
      void runtime!.app.close().then(() => { if (process.connected) process.disconnect(); });
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
    if (closing) return;
    closing = true;
    void runtime!.app.close().catch(error => { logger.error({ err: error }, "Shutdown failed"); process.exitCode = 1; });
  });
} catch (error) {
  logger.error({ err: error }, "ContextMesh service failed to start");
  await runtime?.app.close();
  process.exitCode = 1;
}
