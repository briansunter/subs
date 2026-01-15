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
import {
  getRequestFlag,
  getRequestStartTime,
  setRequestFlag,
  setRequestStartTime,
} from "../utils/request-state";

/**
 * Flag name for tracking if metrics have been recorded
 */
const METRICS_RECORDED_FLAG = "__metricsRecorded";

/**
 * Check if metrics were already recorded for this request
 */
function hasRecordedMetrics(request: Request): boolean {
  return getRequestFlag(request, METRICS_RECORDED_FLAG);
}

/**
 * Mark metrics as recorded for this request
 */
function markMetricsRecorded(request: Request): void {
  setRequestFlag(request, METRICS_RECORDED_FLAG, true);
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
      // Initialize metrics recorded flag
      setRequestFlag(request, METRICS_RECORDED_FLAG, false);
    })
    .onAfterHandle(({ request, set }) => {
      // Skip if already recorded (e.g., in onError)
      if (hasRecordedMetrics(request)) {
        return;
      }

      const duration = (Date.now() - getRequestStartTime(request)) / 1000;
      const url = new URL(request.url);
      const route = url.pathname || "unknown";
      recordHttpRequest(request.method, route, Number(set.status), duration);
      markMetricsRecorded(request);
    })
    .onError(({ code, set, request }) => {
      // Skip if already recorded in onAfterHandle
      if (hasRecordedMetrics(request)) {
        return;
      }

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
      markMetricsRecorded(request);
    });
