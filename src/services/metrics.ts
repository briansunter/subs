/**
 * Prometheus metrics service
 */

import { Counter, collectDefaultMetrics, Histogram, Registry } from "prom-client";

// Create a Registry for our metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.) only in Node.js/Bun environment
// Skip in Cloudflare Workers where these APIs are not available
try {
  // Try to access a Node.js-specific API to detect environment
  if (typeof process === "object" && process !== null) {
    collectDefaultMetrics({ register });
  }
} catch {
  // Running in Cloudflare Workers, skip default metrics
}

// HTTP request metrics
export const httpRequestDurationMicroseconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Signup metrics
export const signupRequestsTotal = new Counter({
  name: "signup_requests_total",
  help: "Total number of signup requests",
  labelNames: ["endpoint", "status"],
  registers: [register],
});

export const signupDurationSeconds = new Histogram({
  name: "signup_duration_seconds",
  help: "Duration of signup processing in seconds",
  labelNames: ["endpoint"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Google Sheets metrics
export const sheetsRequestsTotal = new Counter({
  name: "sheets_requests_total",
  help: "Total number of Google Sheets API requests",
  labelNames: ["operation", "status"],
  registers: [register],
});

export const sheetsRequestDurationSeconds = new Histogram({
  name: "sheets_request_duration_seconds",
  help: "Duration of Google Sheets API requests in seconds",
  labelNames: ["operation"],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Turnstile metrics
export const turnstileRequestsTotal = new Counter({
  name: "turnstile_requests_total",
  help: "Total number of Turnstile verification requests",
  labelNames: ["status"],
  registers: [register],
});

export const turnstileValidationDurationSeconds = new Histogram({
  name: "turnstile_validation_duration_seconds",
  help: "Duration of Turnstile token validation in seconds",
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Record HTTP request metrics
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
): void {
  httpRequestsTotal.inc({ method, route, status_code: statusCode });
  httpRequestDurationMicroseconds.observe({ method, route, status_code: statusCode }, duration);
}

/**
 * Record signup metrics
 */
export function recordSignup(endpoint: string, success: boolean, duration: number): void {
  signupRequestsTotal.inc({ endpoint, status: success ? "success" : "error" });
  signupDurationSeconds.observe({ endpoint }, duration);
}

/**
 * Record Google Sheets API metrics
 */
export function recordSheetsRequest(operation: string, success: boolean, duration: number): void {
  sheetsRequestsTotal.inc({ operation, status: success ? "success" : "error" });
  sheetsRequestDurationSeconds.observe({ operation }, duration);
}

/**
 * Record Turnstile verification metrics
 */
export function recordTurnstileVerification(success: boolean, duration: number): void {
  turnstileRequestsTotal.inc({ status: success ? "success" : "error" });
  turnstileValidationDurationSeconds.observe(duration);
}
