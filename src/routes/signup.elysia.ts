/**
 * Elysia routes for email signup API
 *
 * Follows Elysia best practices:
 * - Elysia instance as controller
 * - Decoupled service functions (handlers)
 * - Type-safe Zod validation for requests
 * - Request destructuring (not passing entire Context)
 *
 * @see {@link https://elysiajs.com/essential/best-practice | Elysia Best Practices}
 * @see {@link https://elysiajs.com/essential/validation | Elysia Validation}
 */

import type { ElysiaConfig } from "elysia";
import { createApp } from "../app";
import { bulkSignupSchema, extendedSignupSchema, signupSchema } from "../schemas/signup";
import { register } from "../services/metrics";
import { getEmbedScript } from "../static/embed-script";
import { HTML_FORM_CONTENT } from "../static/html-form";
import {
  createDefaultContext,
  handleBulkSignup,
  handleExtendedSignup,
  handleHealthCheck,
  handleSignup,
  type SignupContext,
} from "./handlers";

/**
 * Type guard to check if value is an object with a set property
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard to check if object has a set property that is an object
 */
function hasSetProperty(obj: Record<string, unknown>): obj is { set: Record<string, unknown> } {
  return "set" in obj && isObject(obj["set"]);
}

/**
 * Type guard to check if set has a status property that is a number
 */
function hasStatusProperty(
  set: Record<string, unknown>,
): set is { status: number } & Record<string, unknown> {
  return "status" in set && typeof set["status"] === "number";
}

/**
 * Type for a beforeHandle guard function
 * Uses unknown for context to accept Elysia's full context type
 */
type GuardFunction = (context: unknown) => { error: string };

/**
 * Create a beforeHandle guard that returns 404 when feature is disabled
 * @param isEnabled - Whether the feature is enabled
 * @returns undefined if enabled, or an array of guard functions if disabled
 */
function createFeatureGuard(isEnabled: boolean): undefined | GuardFunction[] {
  return isEnabled
    ? undefined
    : [
        (context: unknown) => {
          // Use type guards to safely access nested properties
          if (isObject(context) && hasSetProperty(context) && hasStatusProperty(context["set"])) {
            context["set"]["status"] = 404;
          }
          return { error: "Not found" };
        },
      ];
}

/**
 * Create Elysia app with all signup routes
 * @param context - Optional context for dependency injection (for testing)
 * @param elysiaOptions - Optional Elysia configuration options (e.g., { adapter: CloudflareAdapter })
 */
export const createSignupRoutes = (
  context?: SignupContext,
  elysiaOptions?: Partial<ElysiaConfig<"">>,
) => {
  const ctx = context ?? createDefaultContext();
  const config = ctx.config;

  return (
    createApp(elysiaOptions)
      .derive(() => ({ context: ctx }))
      // HTML form
      .get(
        "/",
        () =>
          new Response(HTML_FORM_CONTENT, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      )
      // Embed script
      .get("/embed.js", ({ request }) => {
        const url = new URL(request.url);
        const apiBaseUrl = `${url.protocol}//${url.host}`;
        return new Response(getEmbedScript(apiBaseUrl), {
          headers: { "Content-Type": "application/javascript; charset=utf-8" },
        });
      })
      .group("/api", (app) =>
        app
          // Health check
          .get("/health", () => handleHealthCheck().data)
          // Config endpoint
          .get("/config", () => ({
            turnstileSiteKey: config.turnstileSiteKey ?? null,
            turnstileEnabled: !!config.turnstileSiteKey,
            defaultSheetTab: config.defaultSheetTab,
          }))
          // Metrics endpoint (conditional on feature flag)
          .get(
            "/metrics",
            async () =>
              new Response(await register.metrics(), { headers: { "Content-Type": "text/plain" } }),
            {
              beforeHandle: createFeatureGuard(config.enableMetrics),
            },
          )
          // Basic signup
          .post(
            "/signup",
            async ({ body, context, set }) => {
              const result = await handleSignup(body, context);
              if (result.statusCode) set.status = result.statusCode;
              return result;
            },
            {
              body: signupSchema,
            },
          )
          // Extended signup (conditional on feature flag)
          .post(
            "/signup/extended",
            async ({ body, context, set }) => {
              const result = await handleExtendedSignup(body, context);
              if (result.statusCode) set.status = result.statusCode;
              return result;
            },
            {
              body: extendedSignupSchema,
              beforeHandle: createFeatureGuard(config.enableExtendedSignup),
            },
          )
          // Bulk signup (conditional on feature flag)
          .post(
            "/signup/bulk",
            async ({ body, context, set }) => {
              const result = await handleBulkSignup(body, context);
              if (result.statusCode) set.status = result.statusCode;
              return result;
            },
            {
              body: bulkSignupSchema,
              beforeHandle: createFeatureGuard(config.enableBulkSignup),
            },
          ),
      )
  );
};
