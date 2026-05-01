/**
 * Elysia server for email signup API
 * Supports CORS and iframe embedding for external sites
 */

import { getConfig } from "./src/config";
import { createSignupRoutes } from "./src/routes/signup.elysia";
import { logger, setLogLevel } from "./src/utils/logger";

const config = getConfig();
setLogLevel(config.nodeEnv === "test" ? "silent" : config.logLevel);
const app = createSignupRoutes();

// Start server
app.listen({
  port: config.port,
  hostname: config.host,
});

logger.info(`Server listening on ${config.host}:${config.port}`);
logger.info(`Embed script: http://${config.host}:${config.port}/embed.js`);
logger.info(`Form page: http://${config.host}:${config.port}/`);

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  app.stop();
  process.exit(0);
});
