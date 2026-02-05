/**
 * Production logger for Bun
 * Pino is the fastest logger for Bun runtime
 */

import pino from "pino";

const isProduction = process.env["NODE_ENV"] === "production";

export const logger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  // Use pretty output in development via pino-pretty
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
            singleLine: true,
          },
        },
      }),
});

export function createChildLogger(context: string) {
  return logger.child({ context });
}
