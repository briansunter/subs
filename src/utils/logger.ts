/**
 * Production logger for Bun
 * Pino is the fastest logger for Bun runtime
 */

import pino from "pino";
import { getRuntimeEnv } from "./runtime-env";

const validLogLevels = new Set(["trace", "debug", "info", "warn", "error", "fatal", "silent"]);

function isCloudflareWorkerRuntime(): boolean {
  return "WebSocketPair" in globalThis || "caches" in globalThis;
}

function getLogLevel(): string {
  const env = getRuntimeEnv();

  if (env["NODE_ENV"] === "test") {
    return "silent";
  }

  const logLevel = (env["LOG_LEVEL"] || "info").trim().toLowerCase();
  return validLogLevels.has(logLevel) ? logLevel : "info";
}

const runtimeEnv = getRuntimeEnv();
const shouldUsePrettyTransport =
  runtimeEnv["NODE_ENV"] !== "production" &&
  runtimeEnv["NODE_ENV"] !== "test" &&
  !isCloudflareWorkerRuntime();

export const logger = pino({
  level: getLogLevel(),
  // Use pretty output in development via pino-pretty
  ...(shouldUsePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
            singleLine: true,
          },
        },
      }
    : {}),
});

export function setLogLevel(level: string): void {
  const normalizedLevel = level.trim().toLowerCase();
  logger.level = validLogLevels.has(normalizedLevel) ? normalizedLevel : "info";
}

export function createChildLogger(context: string) {
  return logger.child({ context });
}
