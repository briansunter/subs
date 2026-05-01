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
import { isValidOrigin } from "../utils/origin";

export { isValidOrigin } from "../utils/origin";

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
    const frameAncestors = validOrigins.includes("*")
      ? "*"
      : `'self' ${validOrigins.filter((o: string) => o !== "*").join(" ")}`.trim();
    const turnstileEnabled = !!(config.turnstileSecretKey || config.turnstileSiteKey);
    const turnstileSource = "https://challenges.cloudflare.com";

    // Set Content Security Policy
    const csp = [
      `frame-ancestors ${frameAncestors}`,
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${turnstileEnabled ? ` ${turnstileSource}` : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `frame-src 'self'${turnstileEnabled ? ` ${turnstileSource}` : ""}`,
      `connect-src 'self'${turnstileEnabled ? ` ${turnstileSource}` : ""}`,
    ].join("; ");

    set.headers["Content-Security-Policy"] = csp;
    set.headers["X-Content-Type-Options"] = "nosniff";

    // Add Referrer-Policy header for privacy
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Add HSTS header in non-development environments
    if (config.nodeEnv !== "development") {
      set.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }
  });
