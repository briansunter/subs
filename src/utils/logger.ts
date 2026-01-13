/**
 * Logging utility using Pino
 */

import pino from "pino";

const isDevelopment = process.env["NODE_ENV"] !== "production";

export const logger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // In development, use pretty print formatting
  ...(isDevelopment && {
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

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: string) {
  return logger.child({ context });
}
