/**
 * Elysia application factory
 * Provides base app with CORS, security, logging, and metrics plugins
 *
 * Follows Elysia plugin architecture for modular, reusable middleware.
 *
 * @see {@link https://elysiajs.com/plugins/overview | Elysia Plugin Overview}
 * @see {@link https://elysiajs.com/essential/best-practice | Elysia Best Practices}
 */

import { cors } from "@elysiajs/cors";
import { Elysia, type ElysiaConfig } from "elysia";
import { getConfig } from "./config";
import { loggingPlugin } from "./plugins/logging";
import { metricsPlugin } from "./plugins/metrics";
import { securityPlugin } from "./plugins/security";
import { hasValueError, hasValueErrors } from "./utils/type-guards";

const config = getConfig();

/**
 * Extract validation error details from Elysia ValidationError
 *
 * @param error - The validation error from Elysia
 * @returns Array of human-readable error messages
 */
function extractValidationDetails(error: unknown): string[] {
  const details: string[] = [];

  // Check for valueErrors (array)
  if (hasValueErrors(error)) {
    for (const err of error.valueErrors) {
      const path = Array.isArray(err.path) ? err.path.join(".") : err.path || "field";
      details.push(`${path}: ${err.message}`);
    }
  }
  // Fallback: check for single valueError
  else if (hasValueError(error)) {
    const singleError = error.valueError;
    const path = Array.isArray(singleError.path)
      ? singleError.path.join(".")
      : singleError.path || "field";
    details.push(`${path}: ${singleError.message}`);
  }

  return details;
}

/**
 * Create a base Elysia app with all middleware configured
 *
 * Uses plugin architecture for:
 * - CORS handling
 * - Security headers
 * - Request/response logging
 * - Metrics recording
 * - Error handling
 *
 * @param elysiaOptions - Optional Elysia configuration options (e.g., { adapter: CloudflareAdapter })
 */
export const createApp = (elysiaOptions?: Partial<ElysiaConfig<"">>) => {
  return (
    new Elysia(elysiaOptions || undefined)
      // CORS plugin
      .use(
        cors({
          origin: config.allowedOrigins,
          // Only enable credentials if not using wildcard origin
          // Browsers block credentials with wildcard origins
          credentials: config.allowedOrigins.length === 1 && config.allowedOrigins[0] !== "*",
          methods: ["GET", "POST", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization"],
          maxAge: 86400, // 24 hours
        }),
      )
      // Security headers plugin
      .use((app) => securityPlugin(app, config))
      // Logging plugin
      .use((app) => loggingPlugin(app))
      // Metrics plugin
      .use((app) => metricsPlugin(app))
      // Error handling
      .onError(({ error, code, set }) => {
        // Handle validation errors (from Zod/Standard Schema)
        if (code === "VALIDATION") {
          set.status = 400;
          const details = extractValidationDetails(error);
          return {
            success: false,
            statusCode: 400,
            error: "Validation failed",
            details,
          };
        }

        // Handle other errors
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        const statusCode = set.status || 500;
        return {
          success: false,
          statusCode,
          error: errorMessage,
        };
      })
  );
};
