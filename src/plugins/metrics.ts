/**
 * Elysia plugin for request metrics and timing
 *
 * Extracts timing and metrics logic into a reusable plugin
 * following Elysia plugin architecture best practices.
 *
 * @see {@link https://elysiajs.com/plugins/overview | Elysia Plugin Overview}
 */

import type { Elysia } from "elysia";
import { recordHttpRequest } from "../services/metrics";

/**
 * Request-scoped state using WeakMap
 * This is the recommended Elysia pattern for request lifecycle data
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1476 | Request-scoped state discussion}
 */
const requestStartTimes = new WeakMap<Request, number>();

/**
 * Helper to get request start time
 */
function getRequestStartTime(request: Request): number {
  return requestStartTimes.get(request) ?? Date.now();
}

/**
 * Helper to set request start time
 */
function setRequestStartTime(request: Request, startTime: number): void {
  requestStartTimes.set(request, startTime);
}

/**
 * Plugin that adds request timing and metrics recording
 *
 * Uses legacy plugin pattern to work around Elysia bug where
 * onAfterHandle doesn't fire in plugin instances.
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1382 | GitHub Issue #1382}
 *
 * @example
 * ```ts
 * import { metricsPlugin } from './plugins/metrics'
 *
 * new Elysia()
 *   .use(metricsPlugin)
 *   .get('/', () => 'Hello')
 * ```
 */
export const metricsPlugin = (app: Elysia) =>
  app
    .onRequest(({ request }) => {
      setRequestStartTime(request, Date.now());
    })
    .onAfterHandle(({ request, set }) => {
      const duration = (Date.now() - getRequestStartTime(request)) / 1000;
      const url = new URL(request.url);
      const route = url.pathname || "unknown";
      recordHttpRequest(request.method, route, Number(set.status), duration);
    })
    .onError(({ code, set, request }) => {
      const url = new URL(request.url);
      const route = url.pathname || "unknown";
      const duration = (Date.now() - getRequestStartTime(request)) / 1000;

      // Record metrics for all errors
      if (code === "VALIDATION") {
        recordHttpRequest(request.method, route, 400, duration);
      } else {
        const statusCode = set.status || 500;
        recordHttpRequest(
          request.method,
          route,
          typeof statusCode === "number" ? statusCode : 500,
          duration,
        );
      }
    });
