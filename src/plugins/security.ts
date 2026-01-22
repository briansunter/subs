/**
 * Elysia plugin for security headers
 *
 * Provides CSP, X-Content-Type-Options, and iframe embedding support
 * following Elysia plugin architecture best practices.
 *
 * @see {@link https://elysiajs.com/plugins/overview | Elysia Plugin Overview}
 */

import type { Elysia } from "elysia";
import type { SignupConfig } from "../config";

/**
 * Validate that an origin string is safe to include in CSP headers
 * Prevents CSP injection attacks by validating origin format
 *
 * @param origin - Origin string to validate
 * @returns true if origin is safe, false otherwise
 */
export function isValidOrigin(origin: string): boolean {
  // Allow wildcard (handled separately)
  if (origin === "*") {
    return true;
  }

  // Allow 'self' and 'none' CSP keywords
  if (origin === "'self'" || origin === "'none'") {
    return true;
  }

  // Validate origin format: only http/https schemes with valid hostname[:port]
  // This prevents injection of malicious CSP directives and restricts to web protocols
  // Hostname must start with alphanumeric, can contain dots/hyphens, no spaces or special CSP chars
  const originRegex =
    /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(?::\d{1,5})?$/;

  return originRegex.test(origin);
}

/**
 * Plugin that adds security headers to all responses
 *
 * Uses legacy plugin pattern to work around Elysia bug where
 * onAfterHandle doesn't fire in plugin instances.
 *
 * Features:
 * - Removes X-Frame-Options to allow iframe embedding
 * - Sets Content Security Policy with configurable origins
 * - Sets X-Content-Type-Options: nosniff
 *
 * @param app - Elysia instance to decorate
 * @param config - Signup configuration with allowed origins
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1382 | GitHub Issue #1382}
 *
 * @example
 * ```ts
 * import { securityPlugin } from './plugins/security'
 * import { getConfig } from './config'
 *
 * new Elysia()
 *   .use((app) => securityPlugin(app, getConfig()))
 *   .get('/', () => 'Hello')
 * ```
 */
export const securityPlugin = (app: Elysia, config: SignupConfig) =>
  app.onBeforeHandle(({ set }) => {
    // Remove X-Frame-Options to allow iframe embedding
    delete set.headers["X-Frame-Options"];

    // Filter and validate origins to prevent CSP injection
    const validOrigins = config.allowedOrigins.filter(isValidOrigin);

    // Set Content Security Policy
    const csp = [
      `frame-ancestors 'self' ${validOrigins.filter((o: string) => o !== "*").join(" ")}`,
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
    ].join("; ");

    set.headers["Content-Security-Policy"] = csp;
    set.headers["X-Content-Type-Options"] = "nosniff";

    // Add Referrer-Policy header for privacy
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Add HSTS header if enabled (recommended for production)
    if (config.enableHsts) {
      set.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }
  });
