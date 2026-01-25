/**
 * Elysia plugin for request/response logging
 *
 * Provides structured logging for all HTTP requests and responses
 * following Elysia plugin architecture best practices.
 *
 * @see {@link https://elysiajs.com/plugins/overview | Elysia Plugin Overview}
 * @see {@link https://elysiajs.com/essential/life-cycle | Elysia Lifecycle}
 */

import type { Elysia } from "elysia";
import { logger } from "../utils/logger";
import { getRequestStartTime } from "../utils/request-state";

/**
 * Plugin that adds structured logging for requests and responses
 *
 * Uses legacy plugin pattern to work around Elysia bug where
 * onAfterHandle doesn't fire in plugin instances.
 *
 * Lifecycle execution order:
 * 1. onRequest - Log incoming request and capture start time
 * 2. onAfterHandle - Log response with calculated duration
 *
 * Logs incoming requests with:
 * - Method, URL, IP address
 * - User-Agent, Origin, Referer headers
 *
 * Logs completed requests with:
 * - Method, URL, status code
 * - Response time
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1382 | GitHub Issue #1382}
 *
 * @example
 * ```ts
 * import { loggingPlugin } from './plugins/logging'
 *
 * new Elysia()
 *   .use(loggingPlugin)
 *   .get('/', () => 'Hello')
 * ```
 */
export const loggingPlugin = (app: Elysia) =>
  app
    .onRequest(({ request }) => {
      // Note: start time is set by metricsPlugin to avoid duplication
      logger.info(
        {
          method: request.method,
          url: request.url,
          ip: request.headers.get("x-forwarded-for") || "unknown",
          headers: {
            "user-agent": request.headers.get("user-agent"),
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
          },
        },
        "Incoming request",
      );
    })
    .onAfterHandle(({ request, set }) => {
      // Calculate duration from request start time
      const duration = (Date.now() - getRequestStartTime(request)) / 1000;

      logger.info(
        {
          method: request.method,
          url: request.url,
          statusCode: set.status,
          responseTime: duration,
        },
        "Request completed",
      );
    });
